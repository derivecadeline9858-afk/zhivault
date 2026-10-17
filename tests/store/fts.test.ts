import { beforeEach, describe, expect, it } from 'vitest'
import type { ContentStore } from '@/core/store/content-store'
import { createTestStore } from './helpers'

let store: ContentStore

beforeEach(async () => {
  store = await createTestStore()
})

describe('FTS5 中文检索（PRD §7.3，trigram 分词）', () => {
  beforeEach(async () => {
    await store.saveAnswer({ id: 'a1', contentHtml: '<p>知乎是一个中文问答社区，支持全文检索功能。</p>', authorId: 'u1', rawJson: '{}' })
    await store.saveArticle({ id: 'ar1', title: 'RAG 入门指南', contentHtml: '<p>向量数据库与 RAG 应用实践，全文检索是基座。</p>', authorId: 'u2', rawJson: '{}' })
    await store.savePin({ id: 'p1', contentHtml: '<p>今天的咖啡很好喝。</p>', authorId: 'u3', rawJson: '{}' })
  })

  it('中文内容命中', async () => {
    const rows = await store.searchContent('全文检索')
    const ids = rows.map((r) => r.entityId)
    expect(ids).toContain('a1')
    expect(ids).toContain('ar1')
  })

  it('英文混合词命中标题与正文', async () => {
    const rows = await store.searchContent('RAG')
    expect(rows.map((r) => r.entityId)).toContain('ar1')
  })

  it('entityTypes 过滤', async () => {
    const rows = await store.searchContent('全文检索', { entityTypes: ['article'] })
    expect(rows.map((r) => r.entityId)).toEqual(['ar1'])
    expect(rows.every((r) => r.entityType === 'article')).toBe(true)
  })

  it('不存在的词返回空', async () => {
    expect(await store.searchContent('不存在的词xyz')).toEqual([])
  })

  it('少于 3 字的查询抛错（trigram 限制）', async () => {
    await expect(store.searchContent('检索')).rejects.toThrow(/3/)
    await expect(store.searchContent('ab')).rejects.toThrow(/3/)
  })

  it('结果包含实体摘要信息', async () => {
    const rows = await store.searchContent('向量数据库')
    expect(rows[0]).toMatchObject({ entityType: 'article', entityId: 'ar1', title: 'RAG 入门指南' })
    expect(rows[0].snippet.length).toBeGreaterThan(0)
  })

  it('question 不进入全文索引（PRD 规定挂 answer/article/pin/comment）', async () => {
    await store.saveQuestion({ id: 'q1', title: '全文检索问题', contentHtml: '<p>全文检索</p>', rawJson: '{}' })
    const rows = await store.searchContent('全文检索')
    expect(rows.map((r) => r.entityId)).not.toContain('q1')
  })
})
