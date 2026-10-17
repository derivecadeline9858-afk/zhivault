import { describe, expect, it } from 'vitest'
import { createTestStore } from './helpers'
import { MIGRATIONS } from '@/core/store/migrator'

describe('迁移 v3：run_record（变更报告数据源）', () => {
  it('迁移链 v1→v2→v3 完整', async () => {
    const store = await createTestStore()
    const rows = await store.listRunRecords()
    expect(rows).toEqual([])
    expect(MIGRATIONS.map((m) => m.version)).toEqual([1, 2, 3])
  })

  it('运行记录保存与倒序列举', async () => {
    const store = await createTestStore()
    await store.saveRunRecord({
      id: 'r1',
      source: 'manual',
      startedAt: '2026-10-17T08:00:00.000Z',
      finishedAt: '2026-10-17T08:01:00.000Z',
      totals: { fetched: 10, created: 5, updated: 2, unchanged: 3, failed: 0 },
    })
    await store.saveRunRecord({
      id: 'r2',
      source: 'monitor',
      startedAt: '2026-10-17T09:00:00.000Z',
      finishedAt: null,
      totals: { fetched: 1, created: 1, updated: 0, unchanged: 0, failed: 0 },
    })
    const rows = await store.listRunRecords()
    expect(rows.map((r) => r.id)).toEqual(['r2', 'r1'])
    expect(rows[1].totals).toMatchObject({ created: 5 })
    expect(rows[0].source).toBe('monitor')
  })

  it('listRevisionsBetween 返回时间窗内版本（变更清单）', async () => {
    const store = await createTestStore()
    await store.saveAnswer({ id: 'a1', contentHtml: '<p>v1</p>', rawJson: '{}' })
    await new Promise((r) => setTimeout(r, 5))
    await store.saveAnswer({ id: 'a1', contentHtml: '<p>v2</p>', rawJson: '{}' })
    const all = await store.getRevisions('answer', 'a1')
    const since = all[0].capturedAt
    const window = await store.listRevisionsBetween(since, new Date(Date.parse(since) + 1000).toISOString())
    expect(window).toHaveLength(1)
    expect(window[0].revisionNo).toBe(2)
  })
})
