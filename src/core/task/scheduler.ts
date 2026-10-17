// cron 调度器（PRD §10-7/§6.2 页 8）：预设 + 自定义 cron + 自定义间隔 + 运行时段 + 补跑策略。
// 纯逻辑、虚拟时钟可注入；到点判定由应用侧 tick 驱动（应用运行期间调度）。
export interface TimeWindow {
  /** 'HH:MM'（含） */
  from: string
  /** 'HH:MM'（不含） */
  to: string
}

export interface ScheduleSpec {
  id?: string
  name?: string
  preset?: 'daily' | 'weekly' | 'monthly'
  /** 5 字段 cron：分 时 日 月 周（与 cron 表达式互斥优先） */
  cron?: string
  /** 自定义间隔（分钟） */
  intervalMin?: number
  window?: TimeWindow
  catchUp: 'on_start' | 'skip'
  enabled: boolean
  /** 监控目标 URL 列表 */
  urls?: string[]
  lastRunAt?: string | null
}

const MAX_SCAN_DAYS = 366
const MAX_MISSED = 100

type FieldSpec = { all: boolean } | { values: Set<number> }

function parseField(field: string, min: number, max: number): FieldSpec | null {
  if (field === '*') return { all: true }
  const values = new Set<number>()
  for (const part of field.split(',')) {
    const m = /^(\*|\d+)(?:-(\d+))?(?:\/(\d+))?$/.exec(part.trim())
    if (!m) return null
    const step = m[3] ? Number(m[3]) : 1
    if (step < 1) return null
    if (m[1] === '*') {
      const lo = m[2] ? Number(m[2]) : min
      for (let v = lo; v <= (m[2] ? Number(m[2]) : max); v += step) values.add(v)
    } else {
      const lo = Number(m[1])
      const hi = m[2] ? Number(m[2]) : lo
      if (lo < min || hi > max || lo > hi) return null
      for (let v = lo; v <= hi; v += step) values.add(v)
    }
  }
  return values.size > 0 ? { values } : null
}

function matches(spec: FieldSpec, value: number): boolean {
  return 'all' in spec || spec.values.has(value)
}

/** 下一触发时刻（严格晚于 after）；无匹配返回 null */
export function cronNext(expr: string, after: Date): Date | null {
  const fields = expr.trim().split(/\s+/)
  if (fields.length !== 5) return null
  const [minF, hourF, domF, _monF, dowF] = fields.map((f, i) =>
    parseField(f, i === 3 ? 1 : 0, [59, 23, 31, 12, 7][i]),
  ) as [FieldSpec | null, FieldSpec | null, FieldSpec | null, FieldSpec | null, FieldSpec | null]
  if (!minF || !hourF || !domF || !_monF || !dowF) return null

  const cursor = new Date(after.getTime())
  cursor.setSeconds(0, 0)
  cursor.setMinutes(cursor.getMinutes() + 1)

  for (let scanned = 0; scanned < MAX_SCAN_DAYS * 24 * 60; scanned++) {
    const dow = (cursor.getDay() + 7) % 7
    const dom = cursor.getDate()
    if (
      matches(minF, cursor.getMinutes()) &&
      matches(hourF, cursor.getHours()) &&
      matches(domF, dom) &&
      matches(dowF, dow === 0 ? 7 : dow)
    ) {
      return cursor
    }
    cursor.setMinutes(cursor.getMinutes() + 1)
  }
  return null
}

function nextDaily(after: Date, h = 3, m = 0): Date {
  const d = new Date(after.getTime())
  d.setHours(h, m, 0, 0)
  if (d.getTime() <= after.getTime()) d.setDate(d.getDate() + 1)
  return d
}

function nextWeekly(after: Date, h = 3, m = 0): Date {
  const d = nextDaily(after, h, m)
  while (d.getDay() !== 1) d.setDate(d.getDate() + 1)
  return d
}

function nextMonthly(after: Date, h = 3, m = 0): Date {
  const d = nextDaily(after, h, m)
  while (d.getDate() !== 1) d.setDate(d.getDate() + 1)
  return d
}

/** 下一触发时刻（表达式 > 预设 > 间隔） */
export function nextRun(spec: ScheduleSpec, after: Date): Date | null {
  if (spec.cron) return cronNext(spec.cron, after)
  if (spec.preset === 'daily') return nextDaily(after)
  if (spec.preset === 'weekly') return nextWeekly(after)
  if (spec.preset === 'monthly') return nextMonthly(after)
  if (spec.intervalMin && spec.intervalMin > 0) return new Date(after.getTime() + spec.intervalMin * 60_000)
  return null
}

/** 运行时段判定（跨午夜区间如 22:00-06:00 亦支持） */
export function inWindow(now: Date, window?: TimeWindow): boolean {
  if (!window) return true
  const [fh, fm] = window.from.split(':').map(Number)
  const [th, tm] = window.to.split(':').map(Number)
  const cur = now.getHours() * 60 + now.getMinutes()
  const from = fh * 60 + fm
  const to = th * 60 + tm
  if (from === to) return true
  return from < to ? cur >= from && cur < to : cur >= from || cur < to
}

export class Scheduler {
  specs: ScheduleSpec[] = []

  constructor(private readonly now: () => Date = () => new Date()) {}

  register(specs: ScheduleSpec[]): void {
    this.specs = specs
  }

  /** 到点且处于运行时段内的任务；触发即更新内存 lastRunAt（同刻不重复，持久化由调用方落库） */
  tick(): ScheduleSpec[] {
    const now = this.now()
    const due = this.specs.filter((s) => {
      if (!s.enabled) return false
      if (!inWindow(now, s.window)) return false
      if (s.lastRunAt && now.getTime() - Date.parse(s.lastRunAt) < 60_000) return false
      const next = nextRun(s, s.lastRunAt ? new Date(s.lastRunAt) : new Date(0))
      return next !== null && next.getTime() <= now.getTime()
    })
    for (const s of due) s.lastRunAt = now.toISOString()
    return due
  }

  /** 启动补跑：since（上次运行）到 until 错过的触发时刻列表（时段过滤后） */
  missedRuns(spec: ScheduleSpec, until: Date): Date[] {
    if (spec.catchUp !== 'on_start' || !spec.enabled) return []
    const start = spec.lastRunAt ? new Date(spec.lastRunAt) : new Date(0)
    const missed: Date[] = []
    let cursor = start
    for (let i = 0; i < MAX_MISSED; i++) {
      const next = nextRun(spec, cursor)
      // 当前时刻的触发归 tick 处理，不算"错过"
      if (!next || next.getTime() >= until.getTime()) break
      if (inWindow(next, spec.window)) missed.push(next)
      cursor = next
    }
    return missed
  }
}
