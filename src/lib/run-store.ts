import type { CollectStats } from '@/core/zhihu/collectors'
import { emptyStats } from '@/core/zhihu/collectors/shared'
import { getGlobalRateLimiter } from '@/core/fetch/rate-limiter'
import { redactLog } from '@/core/security/log-redact'
import type { StoreLike } from '@/core/zhihu/collectors'
import { BatchExecutor, type TaskState } from '@/core/task/executor'
import type { Fetcher } from '@/core/zhihu/fetcher'
import { parseZhihuUrl, type EntityType } from '@/core/zhihu/url-parser'

const TYPE_LABELS: Record<EntityType, string> = {
  answer: '回答',
  article: '文章',
  pin: '想法',
  question: '问题',
  collection: '收藏夹',
  column: '专栏',
  topic: '话题',
  user: '用户',
}

export type RunPhase = 'idle' | 'running' | 'paused'

export interface RunLogEntry {
  level: 'INFO' | 'WARN' | 'ERROR'
  text: string
  at: string
}

export interface RunTaskState {
  id: string
  url: string
  typeLabel: string
  status: 'pending' | 'running' | 'done' | 'failed' | 'paused'
  stats: CollectStats
  error?: string
}

export interface RunState {
  phase: RunPhase
  tasks: RunTaskState[]
  totals: CollectStats
  logs: RunLogEntry[]
  demoMode: boolean
  currentRate: number
}

const MAX_LOGS = 500

/**
 * 运行状态机（任务 5）：任务队列 → 执行器 → 计数/日志事件 → 订阅通知。
 * 日志经脱敏器出口（PRD §8-1 挂接点）。
 */
export class RunStore {
  state: RunState = {
    phase: 'idle',
    tasks: [],
    totals: emptyStats(),
    logs: [],
    demoMode: false,
    currentRate: getGlobalRateLimiter().getState().ratePerSecond,
  }

  private listeners = new Set<() => void>()
  private executor: BatchExecutor | null = null
  private seq = 0

  constructor(
    private deps: {
      store: StoreLike
      fetcherFactory: (demo: boolean) => Fetcher
      session?: { dC0: string; cookie?: string }
    },
  ) {}

  /** 应用内就绪后替换为真实便携库（浏览器演示环境保持内存库） */
  setStore(store: StoreLike): void {
    this.deps = { ...this.deps, store }
  }

  subscribe(fn: () => void): () => void {
    this.listeners.add(fn)
    return () => this.listeners.delete(fn)
  }

  private emit(): void {
    for (const fn of this.listeners) fn()
  }

  private patch(p: Partial<RunState>): void {
    Object.assign(this.state, p)
    this.emit()
  }

  log(level: RunLogEntry['level'], text: string): void {
    const logs = [...this.state.logs, { level, text: redactLog(text), at: new Date().toISOString() }]
    this.patch({ logs: logs.length > MAX_LOGS ? logs.slice(logs.length - MAX_LOGS) : logs })
  }

  addTask(url: string): { ok: boolean; error?: string } {
    let target: EntityType
    try {
      target = parseZhihuUrl(url).type
    } catch (e) {
      return { ok: false, error: (e as Error).message }
    }
    if (this.state.tasks.some((t) => t.url === url)) {
      return { ok: false, error: '任务已存在（跨任务自动去重合并）' }
    }
    this.seq++
    this.patch({
      tasks: [
        ...this.state.tasks,
        { id: `task-${Date.now()}-${this.seq}`, url, typeLabel: TYPE_LABELS[target], status: 'pending', stats: emptyStats() },
      ],
    })
    return { ok: true }
  }

  removeTask(id: string): void {
    this.patch({ tasks: this.state.tasks.filter((t) => t.id !== id) })
  }

  clearTasks(): void {
    this.patch({ tasks: [] })
  }

  setDemoMode(demo: boolean): void {
    this.patch({ demoMode: demo })
    this.log('INFO', demo ? '已切换到演示数据模式' : '已切换到真实采集模式')
  }

  async start(): Promise<void> {
    if (this.state.phase !== 'idle' || this.state.tasks.length === 0) return
    const tasks = this.state.tasks
    this.patch({ phase: 'running', totals: emptyStats() })
    this.log('INFO', `开始运行 ${tasks.length} 个任务${this.state.demoMode ? '（演示数据模式）' : ''}`)

    const executor = new BatchExecutor({
      fetcher: this.deps.fetcherFactory(this.state.demoMode),
      store: this.deps.store,
      session: this.deps.session ?? { dC0: 'anonymous' },
      maxConcurrency: 1,
      onTaskEvent: (s: TaskState) => this.onTaskEvent(s),
    })
    this.executor = executor

    const summary = await executor.run(tasks.map((t) => ({ id: t.id, url: t.url })))
    this.log(
      summary.status === 'done' ? 'INFO' : 'WARN',
      `运行结束：新增 ${summary.totals.created} / 更新 ${summary.totals.updated} / 未变 ${summary.totals.unchanged} / 失败 ${summary.totals.failed}`,
    )
    this.executor = null
    this.patch({ phase: 'idle', currentRate: getGlobalRateLimiter().getState().ratePerSecond })
  }

  pause(): void {
    if (this.state.phase !== 'running') return
    this.executor?.pause()
    this.patch({ phase: 'paused' })
    this.log('INFO', '已暂停（可从断点续抓）')
  }

  async resume(): Promise<void> {
    if (this.state.phase !== 'paused' || !this.executor) return
    this.patch({ phase: 'running' })
    this.log('INFO', '恢复运行')
    const summary = await this.executor.resume()
    if (summary.status !== 'paused') {
      this.executor = null
      this.patch({ phase: 'idle' })
    }
  }

  private onTaskEvent(s: TaskState): void {
    const tasks = this.state.tasks.map((t) =>
      t.id === s.taskId
        ? { ...t, status: s.status, stats: s.stats, error: s.error?.message }
        : t,
    )
    const totals = tasks.reduce((acc, t) => add(acc, t.stats), emptyStats())
    const limiterState = getGlobalRateLimiter().getState()
    this.patch({ tasks, totals, currentRate: limiterState.ratePerSecond })
    if (s.status === 'failed') {
      this.log('ERROR', `任务 ${s.taskId} 失败：${s.error?.message ?? '未知错误'}`)
    } else if (s.status === 'done') {
      this.log('INFO', `任务 ${s.taskId} 完成：新增 ${s.stats.created} / 更新 ${s.stats.updated}`)
    }
  }
}

function add(a: CollectStats, b: CollectStats): CollectStats {
  return {
    fetched: a.fetched + b.fetched,
    created: a.created + b.created,
    updated: a.updated + b.updated,
    unchanged: a.unchanged + b.unchanged,
    failed: a.failed + b.failed,
  }
}
