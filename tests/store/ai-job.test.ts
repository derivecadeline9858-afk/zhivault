import { describe, expect, it } from 'vitest'
import { usageStats } from '@/core/ai/usage'
import { createTestStore } from './helpers'

describe('AI 用量统计（PRD §10-9）', () => {
  it('按模型聚合 token 与次数', () => {
    const stats = usageStats([
      { model: 'deepseek-chat', promptTokens: 100, completionTokens: 20 },
      { model: 'deepseek-chat', promptTokens: 50, completionTokens: 10 },
      { model: 'gpt-4o-mini', promptTokens: 10, completionTokens: 5 },
      { model: 'm', promptTokens: null, completionTokens: undefined },
    ])
    expect(stats.jobs).toBe(4)
    expect(stats.promptTokens).toBe(160)
    expect(stats.completionTokens).toBe(35)
    expect(stats.byModel['deepseek-chat']).toEqual({ jobs: 2, promptTokens: 150, completionTokens: 30 })
    expect(stats.byModel['gpt-4o-mini']).toEqual({ jobs: 1, promptTokens: 10, completionTokens: 5 })
    expect(stats.byModel['m']).toEqual({ jobs: 1, promptTokens: 0, completionTokens: 0 })
  })

  it('ai_job 迁移 v4：记录写回与枚举（可回溯）', async () => {
    const store = await createTestStore()
    await store.saveAiJob({
      id: 'j1',
      entityType: 'answer',
      entityId: 'a1',
      kind: 'summary',
      model: 'deepseek-chat',
      promptTokens: 100,
      completionTokens: 20,
      result: { summary: 's', tags: ['t'] },
    })
    await store.saveAiJob({
      id: 'j2',
      entityType: 'answer',
      entityId: 'a1',
      kind: 'tags',
      model: 'deepseek-chat',
      promptTokens: 60,
      completionTokens: 12,
      result: { tags: ['x'] },
    })
    const all = await store.listAiJobs()
    expect(all).toHaveLength(2)
    expect(all[0].result).toEqual({ tags: ['x'] })
    const forEntity = await store.listAiJobsForEntity('answer', 'a1')
    expect(forEntity).toHaveLength(2)
    expect((await store.listAiJobsForEntity('article', 'a1'))).toHaveLength(0)
  })
})
