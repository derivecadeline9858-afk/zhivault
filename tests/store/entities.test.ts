import { beforeEach, describe, expect, it } from 'vitest'
import type { ContentStore } from '@/core/store/content-store'
import { createTestStore } from './helpers'

let store: ContentStore

beforeEach(async () => {
  store = await createTestStore()
})

describe('仓储 CRUD（PRD §7.3 全量实体）', () => {
  it('author 存取', async () => {
    await store.saveAuthor({ id: 'u1', username: 'zhang-3', name: '张三', avatarUrl: 'https://pic.example/zh.png' })
    const a = await store.getAuthor('u1')
    expect(a).toMatchObject({ id: 'u1', username: 'zhang-3', name: '张三', avatarUrl: 'https://pic.example/zh.png' })
    expect(a?.capturedAt).toBeTruthy()
    expect(a?.updatedAt).toBeTruthy()
  })

  it('question 存取', async () => {
    const r = await store.saveQuestion({ id: 'q1', title: '如何评价 RAG？', contentHtml: '<p>详情</p>', authorId: 'u1', createdAt: '2026-01-01', answerCount: 3, followerCount: 10, rawJson: '{"id":"q1"}' })
    expect(r.status).toBe('created')
    const q = await store.getQuestion('q1')
    expect(q).toMatchObject({ id: 'q1', title: '如何评价 RAG？', answerCount: 3, followerCount: 10 })
  })

  it('answer 存取且原样保留 raw_json', async () => {
    const raw = JSON.stringify({ id: 'a1', content: '<p>你好</p>', extra: { k: 1 } })
    await store.saveAnswer({
      id: 'a1',
      questionId: 'q1',
      contentHtml: '<p>你好</p>',
      authorId: 'u1',
      createdAt: '2026-01-02',
      voteupCount: 42,
      commentCount: 3,
      rawJson: raw,
    })
    const a = await store.getAnswer('a1')
    expect(a?.rawJson).toBe(raw)
    expect(a?.questionId).toBe('q1')
    expect(a?.voteupCount).toBe(42)
  })

  it('article 存取', async () => {
    await store.saveArticle({ id: 'ar1', title: 'RAG 入门', contentHtml: '<p>正文</p>', authorId: 'u2', createdAt: '2026-01-03', voteupCount: 7, commentCount: 1, columnId: 'cl1', rawJson: '{}' })
    const ar = await store.getArticle('ar1')
    expect(ar).toMatchObject({ id: 'ar1', title: 'RAG 入门', columnId: 'cl1' })
  })

  it('pin（想法）存取', async () => {
    await store.savePin({ id: 'p1', contentHtml: '<p>想法内容</p>', authorId: 'u3', createdAt: '2026-01-04', likeCount: 9, commentCount: 0, rawJson: '{}' })
    const p = await store.getPin('p1')
    expect(p).toMatchObject({ id: 'p1', likeCount: 9 })
  })

  it('comment 支持 parent_id 树层级与 like_count', async () => {
    await store.saveComment({ id: 'c1', entityType: 'answer', entityId: 'a1', contentHtml: '<p>根评论</p>', authorId: 'u2', likeCount: 5, createdAt: '2026-01-05', rawJson: '{}' })
    await store.saveComment({ id: 'c2', entityType: 'answer', entityId: 'a1', parentId: 'c1', contentHtml: '<p>子评论</p>', authorId: 'u3', likeCount: 1, createdAt: '2026-01-06', rawJson: '{}' })
    const list = await store.listComments('answer', 'a1')
    expect(list).toHaveLength(2)
    const child = list.find((c) => c.id === 'c2')
    expect(child?.parentId).toBe('c1')
    expect(child?.likeCount).toBe(1)
    expect(await store.getComment('c1')).toMatchObject({ id: 'c1', contentHtml: '<p>根评论</p>' })
  })

  it('collection + items 存取，items 按 order_idx 排序', async () => {
    await store.saveCollection({ id: 'col1', title: '我的收藏', description: 'desc', creatorId: 'u1', itemCount: 2 })
    await store.replaceCollectionItems('col1', [
      { itemType: 'answer', itemId: 'a1', orderIdx: 1 },
      { itemType: 'article', itemId: 'ar1', orderIdx: 0 },
    ])
    const items = await store.getCollectionItems('col1')
    expect(items.map((i) => i.itemId)).toEqual(['ar1', 'a1'])
    expect(await store.getCollection('col1')).toMatchObject({ title: '我的收藏', itemCount: 2 })
  })

  it('replaceCollectionItems 整体替换而非追加', async () => {
    await store.saveCollection({ id: 'col1', title: '我的收藏', creatorId: 'u1', itemCount: 1 })
    await store.replaceCollectionItems('col1', [{ itemType: 'answer', itemId: 'a1', orderIdx: 0 }])
    await store.replaceCollectionItems('col1', [{ itemType: 'pin', itemId: 'p1', orderIdx: 0 }])
    const items = await store.getCollectionItems('col1')
    expect(items).toHaveLength(1)
    expect(items[0].itemId).toBe('p1')
  })

  it('column + items 存取', async () => {
    await store.saveColumn({ id: 'cl1', title: '专栏', description: '', creatorId: 'u2', articleCount: 2 })
    await store.replaceColumnItems('cl1', [
      { articleId: 'ar2', orderIdx: 1 },
      { articleId: 'ar1', orderIdx: 0 },
    ])
    const items = await store.getColumnItems('cl1')
    expect(items.map((i) => i.articleId)).toEqual(['ar1', 'ar2'])
    expect(await store.getColumn('cl1')).toMatchObject({ title: '专栏', articleCount: 2 })
  })

  it('topic + items 存取', async () => {
    await store.saveTopic({ id: 't1', name: '人工智能', description: '', questionCount: 100, followerCount: 1000 })
    await store.replaceTopicItems('t1', [
      { itemType: 'question', itemId: 'q1' },
      { itemType: 'answer', itemId: 'a1' },
    ])
    const items = await store.getTopicItems('t1')
    expect(items).toHaveLength(2)
    expect(await store.getTopic('t1')).toMatchObject({ name: '人工智能' })
  })

  it('activity 存取并按作者列举', async () => {
    await store.saveActivity({ id: 'act1', authorId: 'u1', activityType: 'voteup_answer', entityType: 'answer', entityId: 'a1', createdAt: '2026-01-07', rawJson: '{}' })
    await store.saveActivity({ id: 'act2', authorId: 'u1', activityType: 'create_answer', entityType: 'answer', entityId: 'a2', createdAt: '2026-01-08', rawJson: '{}' })
    const list = await store.listActivities('u1')
    expect(list.map((x) => x.id)).toEqual(['act2', 'act1'])
    expect(await store.getActivity('act1')).toMatchObject({ activityType: 'voteup_answer' })
  })

  it('重复保存保留 captured_at、刷新 updated_at', async () => {
    await store.saveAuthor({ id: 'u9', name: '初名' })
    const first = await store.getAuthor('u9')
    await new Promise((r) => setTimeout(r, 5))
    await store.saveAuthor({ id: 'u9', name: '新名' })
    const second = await store.getAuthor('u9')
    expect(second?.name).toBe('新名')
    expect(second?.capturedAt).toBe(first?.capturedAt)
    expect(second!.updatedAt >= first!.updatedAt).toBe(true)
  })

  it('不存在时 get 返回 undefined', async () => {
    expect(await store.getAnswer('nope')).toBeUndefined()
    expect(await store.getAuthor('nope')).toBeUndefined()
  })
})
