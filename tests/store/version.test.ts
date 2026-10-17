import { beforeEach, describe, expect, it } from 'vitest'
import type { ContentStore } from '@/core/store/content-store'
import { createTestStore } from './helpers'

let store: ContentStore

beforeEach(async () => {
  store = await createTestStore()
})

const answer = (id: string, html: string) => ({
  id,
  contentHtml: html,
  authorId: 'u1',
  rawJson: '{}',
})

describe('版本历史与哈希比对（PRD §5.4 / §7.4-4）', () => {
  it('首次入库产生 revision 1', async () => {
    const r = await store.saveAnswer(answer('a1', '<p>初版</p>'))
    expect(r.status).toBe('created')
    expect(r.revisionNo).toBe(1)
    const rev = await store.getLatestRevision('answer', 'a1')
    expect(rev?.revisionNo).toBe(1)
    expect(rev?.contentHtml).toBe('<p>初版</p>')
    expect(rev?.contentHash).toMatch(/^[0-9a-f]{64}$/)
  })

  it('内容变化产生新修订，旧版本保留', async () => {
    await store.saveAnswer(answer('a1', '<p>初版</p>'))
    const r2 = await store.saveAnswer(answer('a1', '<p>第二版</p>'))
    expect(r2.status).toBe('updated')
    expect(r2.revisionNo).toBe(2)
    const all = await store.getRevisions('answer', 'a1')
    expect(all).toHaveLength(2)
    expect(all[0].contentHtml).toBe('<p>初版</p>')
    expect(all[1].contentHtml).toBe('<p>第二版</p>')
  })

  it('内容未变化不产生新修订（幂等增量）', async () => {
    await store.saveAnswer(answer('a1', '<p>初版</p>'))
    await store.saveAnswer(answer('a1', '<p>第二版</p>'))
    const r3 = await store.saveAnswer(answer('a1', '<p>第二版</p>'))
    expect(r3.status).toBe('unchanged')
    expect(r3.revisionNo).toBeNull()
    expect(await store.getRevisions('answer', 'a1')).toHaveLength(2)
  })

  it('不同实体版本相互独立（版本挂实体级，PRD §0-4）', async () => {
    await store.saveAnswer(answer('a1', '<p>甲</p>'))
    await store.saveAnswer(answer('a2', '<p>乙</p>'))
    await store.saveAnswer(answer('a2', '<p>乙v2</p>'))
    expect(await store.getRevisions('answer', 'a1')).toHaveLength(1)
    expect((await store.getLatestRevision('answer', 'a2'))?.revisionNo).toBe(2)
  })

  it('同一内容哈希稳定，不同内容哈希不同', async () => {
    const r1 = await store.saveAnswer(answer('a1', '<p>同文</p>'))
    const r2 = await store.saveArticle({ id: 'ar1', title: '', contentHtml: '<p>同文</p>', authorId: 'u1', rawJson: '{}' })
    expect(r1.revisionNo).toBe(1)
    expect(r2.revisionNo).toBe(1)
    const rev1 = await store.getLatestRevision('answer', 'a1')
    const rev2 = await store.getLatestRevision('article', 'ar1')
    expect(rev1?.contentHash).toBe(rev2?.contentHash)
    await store.saveArticle({ id: 'ar2', title: '', contentHtml: '<p>异文</p>', authorId: 'u1', rawJson: '{}' })
    const rev3 = await store.getLatestRevision('article', 'ar2')
    expect(rev3?.contentHash).not.toBe(rev1?.contentHash)
  })

  it('question/comment 同样进版本历史', async () => {
    await store.saveQuestion({ id: 'q1', title: '标题', contentHtml: '<p>q1</p>', rawJson: '{}' })
    await store.saveQuestion({ id: 'q1', title: '标题改', contentHtml: '<p>q1改</p>', rawJson: '{}' })
    expect(await store.getRevisions('question', 'q1')).toHaveLength(2)
    await store.saveComment({ id: 'c1', entityType: 'answer', entityId: 'a1', contentHtml: '<p>c1</p>', authorId: 'u1', rawJson: '{}' })
    await store.saveComment({ id: 'c1', entityType: 'answer', entityId: 'a1', contentHtml: '<p>c1改</p>', authorId: 'u1', rawJson: '{}' })
    expect(await store.getRevisions('comment', 'c1')).toHaveLength(2)
  })
})
