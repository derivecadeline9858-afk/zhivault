import { describe, expect, it } from 'vitest'
import { Scheduler, cronNext, inWindow, nextRun, type ScheduleSpec } from '@/core/task/scheduler'

const D = (s: string) => new Date(s)

const base: Omit<ScheduleSpec, 'id' | 'name'> = { catchUp: 'skip', enabled: true }

describe('cron 表达式（5 字段：分 时 日 月 周）', () => {
  it('固定时刻', () => {
    expect(cronNext('30 8 * * *', D('2026-10-17T08:29:00'))).toEqual(D('2026-10-17T08:30:00'))
    expect(cronNext('30 8 * * *', D('2026-10-17T08:30:00'))).toEqual(D('2026-10-18T08:30:00'))
  })

  it('步进 */n', () => {
    expect(cronNext('*/15 * * * *', D('2026-10-17T08:07:00'))).toEqual(D('2026-10-17T08:15:00'))
    expect(cronNext('0 */6 * * *', D('2026-10-17T08:00:00'))).toEqual(D('2026-10-17T12:00:00'))
  })

  it('列表与区间', () => {
    expect(cronNext('0 9,18 * * *', D('2026-10-17T10:00:00'))).toEqual(D('2026-10-17T18:00:00'))
    expect(cronNext('0 9-11 * * *', D('2026-10-17T11:00:00'))).toEqual(D('2026-10-18T09:00:00'))
  })

  it('周字段（0/7=周日）', () => {
    // 2026-10-17 是周六；下一个周一是 10-19
    expect(cronNext('0 3 * * 1', D('2026-10-17T12:00:00'))).toEqual(D('2026-10-19T03:00:00'))
  })

  it('非法表达式返回 null', () => {
    expect(cronNext('bad', D('2026-10-17T00:00:00'))).toBeNull()
    expect(cronNext('99 99 * * *', D('2026-10-17T00:00:00'))).toBeNull()
  })
})

describe('预设与自定义间隔', () => {
  it('每天 03:00', () => {
    expect(nextRun({ ...base, preset: 'daily' }, D('2026-10-17T04:00:00'))).toEqual(D('2026-10-18T03:00:00'))
  })

  it('每周一 03:00（2026-10-17 周六 → 10-19 周一）', () => {
    expect(nextRun({ ...base, preset: 'weekly' }, D('2026-10-17T12:00:00'))).toEqual(D('2026-10-19T03:00:00'))
  })

  it('每月 1 日 03:00（跨月钳制：1/31 → 2/1）', () => {
    expect(nextRun({ ...base, preset: 'monthly' }, D('2026-01-31T04:00:00'))).toEqual(D('2026-02-01T03:00:00'))
  })

  it('自定义间隔（分钟）', () => {
    expect(nextRun({ ...base, intervalMin: 30 }, D('2026-10-17T08:10:00'))).toEqual(D('2026-10-17T08:40:00'))
  })

  it('cron 表达式优先', () => {
    expect(nextRun({ ...base, cron: '0 6 * * *', preset: 'daily' }, D('2026-10-17T04:00:00'))).toEqual(D('2026-10-17T06:00:00'))
  })
})

describe('运行时段限制', () => {
  it('时段内放行，时段外拒绝', () => {
    expect(inWindow(D('2026-10-17T09:00:00'), { from: '08:00', to: '23:00' })).toBe(true)
    expect(inWindow(D('2026-10-17T07:59:00'), { from: '08:00', to: '23:00' })).toBe(false)
  })

  it('tick 跳过时段外到期任务', () => {
    const now = D('2026-10-17T03:00:00')
    const sched = new Scheduler(() => now)
    sched.register([{ id: 's', name: 'n', ...base, preset: 'daily', window: { from: '08:00', to: '23:00' } }])
    expect(sched.tick()).toHaveLength(0)
  })

  it('时段内到点触发并更新 lastRun', () => {
    const now = D('2026-10-17T09:00:00')
    const sched = new Scheduler(() => now)
    sched.register([{ id: 's', name: 'n', ...base, preset: 'daily', window: { from: '08:00', to: '23:00' } }])
    const due = sched.tick()
    expect(due.map((s) => s.id)).toEqual(['s'])
    expect(sched.tick()).toHaveLength(0) // 同刻不重复触发
  })
})

describe('补跑策略', () => {
  const hourly = { ...base, cron: '0 * * * *' as const }

  it('skip：错过不补', () => {
    const sched = new Scheduler(() => D('2026-10-17T10:00:00'))
    sched.register([{ id: 's', name: 'n', ...hourly, catchUp: 'skip', lastRunAt: '2026-10-16T23:00:00.000Z' }])
    expect(sched.missedRuns(sched.specs[0], D('2026-10-17T10:00:00'))).toHaveLength(0)
  })

  it('on_start：启动补跑错过次数（08/09 两次）', () => {
    const sched = new Scheduler(() => D('2026-10-17T10:00:00'))
    // lastRunAt 用 ISO-Z（应用侧 toISOString 格式）：本地 07:00 = UTC 前一日 23:00
    sched.register([{ id: 's', name: 'n', ...hourly, catchUp: 'on_start', lastRunAt: '2026-10-16T23:00:00.000Z' }])
    const missed = sched.missedRuns(sched.specs[0], D('2026-10-17T10:00:00'))
    expect(missed.map((d) => d.getHours())).toEqual([8, 9])
  })

  it('禁用任务不触发', () => {
    const sched = new Scheduler(() => D('2026-10-17T09:00:00'))
    sched.register([{ id: 's', name: 'n', ...base, preset: 'daily', enabled: false }])
    expect(sched.tick()).toHaveLength(0)
  })
})
