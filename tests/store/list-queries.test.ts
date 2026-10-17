import { beforeEach, describe, expect, it } from 'vitest'
import { ContentStore } from '@/core/store/content-store'
import { createTestStore } from './helpers'

let store: ContentStore

beforeEach(async () => {
  store = await createTestStore()
  await store.saveAnswer({ id: 'a1', contentHtml: '<p>一</p>', authorId: 'u1', rawJson: '{}' })
  await store.saveAnswer({ id: 'a2', contentHtml: '<p>二</p>', authorId: 'u1', rawJson: '{}' })
  await store.saveArticle({ id: 'ar1', title: '文', contentHtml: '<p>文</p>', rawJson: '{}' })
})

describe('书架/导出所需的列表查询（任务 5 挂接）', () => {
  it('listAnswers 按收录时间倒序分页', async () => {
    const page = await store.listAnswers(0, 10)
    expect(page).toHaveLength(2)
    expect(page[0].id).toBe('a2')
    const empty = await store.listAnswers(2, 10)
    expect(empty).toHaveLength(0)
  })

  it('listArticles / listPins / listQuestions', async () => {
    expect(await store.listArticles(0, 10)).toHaveLength(1)
    expect(await store.listPins(0, 10)).toHaveLength(0)
    await store.saveQuestion({ id: 'q1', title: '问', rawJson: '{}' })
    expect(await store.listQuestions(0, 10)).toHaveLength(1)
  })
})
