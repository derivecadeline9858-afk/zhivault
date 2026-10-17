import { beforeEach, describe, expect, it } from 'vitest'
import { collectComments } from '@/core/zhihu/collectors/comments'
import { createTestStore } from '../store/helpers'
import { urlWithParams } from './helpers'
import type { ContentStore } from '@/core/store/content-store'
import type { Fetcher } from '@/core/zhihu/fetcher'

let store: ContentStore
let urls: string[]

const fetcher: Fetcher = {
  async fetchJson(url, opts) {
    const full = urlWithParams(url, opts?.params)
    urls.push(full)
    if (full.includes('/root_comment')) {
      return {
        data: [
          { id: 'r1', content: '<p>根1</p>', like_count: 100, child_comment_count: 2, created_time: 1700000000, author: { url_token: 'u1', name: '甲' } },
          { id: 'r2', content: '<p>根2</p>', like_count: 1, child_comment_count: 0, created_time: 1700000001, author: { url_token: 'u2', name: '乙' } },
        ],
        paging: { is_end: true },
      }
    }
    return {
      data: [
        { id: 'c1a', content: '<p>子A</p>', like_count: 5, created_time: 1700000002, author: { url_token: 'u3', name: '丙' } },
        { id: 'c1b', content: '<p>子B</p>', like_count: 500, created_time: 1700000003, author: { url_token: 'u4', name: '丁' } },
      ],
      paging: { is_end: true },
    }
  },
}

beforeEach(async () => {
  store = await createTestStore()
  urls = []
})

describe('评论树采集器（PRD §10-3：层级 + 赞数筛选）', () => {
  it('层级正确：child 挂 parent_id，赞数筛选生效', async () => {
    const r = await collectComments({ fetcher, store, taskId: 't1' }, { entityType: 'answer', entityId: 'a1' }, { likeMin: 10 })
    const comments = await store.listComments('answer', 'a1')
    const byId = Object.fromEntries(comments.map((c) => [c.id, c]))
    expect(Object.keys(byId).sort()).toEqual(['c1b', 'r1'])
    expect(byId.r1.parentId).toBeUndefined()
    expect(byId.c1b.parentId).toBe('r1')
    expect(r.stats.fetched).toBe(4)
  })

  it('排序参数传递 order_by=time', async () => {
    await collectComments({ fetcher, store, taskId: 't1' }, { entityType: 'answer', entityId: 'a1' }, { likeMin: 0, order: 'time' })
    expect(urls.some((u) => u.includes('order_by=time'))).toBe(true)
  })
})
