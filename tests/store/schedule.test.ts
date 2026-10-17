import { describe, expect, it } from 'vitest'
import { createTestExecutor, createTestStore } from './helpers'
import { MIGRATIONS } from '@/core/store/migrator'

describe('迁移 v2：schedule 表（监控计划持久化）', () => {
  it('全新库按序应用全部迁移（v1+v2）', async () => {
    const exec = await createTestExecutor()
    const { migrate } = await import('@/core/store/migrator')
    await migrate(exec)
    const rows = await exec.all<{ version: number }>('SELECT version FROM _migrations ORDER BY version')
    expect(rows.map((r) => r.version)).toEqual(MIGRATIONS.map((m) => m.version))
    const names = await exec.all<{ name: string }>("SELECT name FROM sqlite_master WHERE type='table' AND name='schedule'")
    expect(names).toHaveLength(1)
  })

  it('调度增删改查与启停', async () => {
    const store = await createTestStore()
    await store.saveSchedule({ id: 's1', name: '每日备份', spec: { preset: 'daily' }, enabled: true })
    await store.saveSchedule({ id: 's2', name: '每周汇总', spec: { preset: 'weekly' }, enabled: false })

    const all = await store.listSchedules()
    expect(all).toHaveLength(2)
    expect(all[0]).toMatchObject({ id: 's1', name: '每日备份', enabled: true })
    expect(all[0].spec).toEqual({ preset: 'daily' })
    expect(all[1].enabled).toBe(false)

    await store.setScheduleEnabled('s2', true)
    await store.setScheduleLastRun('s1', '2026-10-17T03:00:00.000Z')
    const after = await store.listSchedules()
    expect(after.find((s) => s.id === 's2')?.enabled).toBe(true)
    expect(after.find((s) => s.id === 's1')?.lastRunAt).toBe('2026-10-17T03:00:00.000Z')

    await store.deleteSchedule('s1')
    expect(await store.listSchedules()).toHaveLength(1)
  })
})
