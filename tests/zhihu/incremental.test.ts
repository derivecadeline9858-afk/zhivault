import { beforeEach, describe, expect, it } from 'vitest'
import { collectAnswer, collectQuestion } from '@/core/zhihu/collectors'
import { createTestStore } from '../store/helpers'
import { urlWithParams } from './helpers'
import type { ContentStore } from '@/core/store/content-store'
import type { Fetcher } from '@/core/zhihu/fetcher'

let store: ContentStore

const mkAnswerFetcher = (content: string): Fetcher => ({
  async fetchJson() {
    return {
      id: 'a1',
      content,
      created_time: 1700000000,
      voteup_count: 1,
      comment_count: 0,
      question: { id: 'q1', title: 't', detail: '', created_time: 1, answer_count: 1, follower_count: 0, author: { url_token: 'uq', name: 'q' } },
      author: { url_token: 'ua', name: 'a' },
    }
  },
})

const QUESTION_META = { id: 'q9', title: 't', detail: '', created_time: 1, answer_count: 2, follower_count: 0, author: { url_token: 'u', name: 'u' } }

beforeEach(async () => {
  store = await createTestStore()
})

describe('增量 diff + 版本入库 + 断点续抓（PRD §10-3 验收）', () => {
  it('二次运行内容变化 → 产生新版本记录', async () => {
    const r1 = await collectAnswer({ fetcher: mkAnswerFetcher('<p>第一版</p>'), store, taskId: 't1' }, { id: 'a1' })
    expect(r1.stats.created).toBeGreaterThanOrEqual(1)
    const r2 = await collectAnswer({ fetcher: mkAnswerFetcher('<p>第二版</p>'), store, taskId: 't1' }, { id: 'a1' })
    expect(r2.stats.updated).toBeGreaterThanOrEqual(1)
    const revs = await store.getRevisions('answer', 'a1')
    expect(revs).toHaveLength(2)
    expect(revs[0].contentHtml).toBe('<p>第一版</p>')
    expect(revs[1].contentHtml).toBe('<p>第二版</p>')
  })

  it('二次运行内容未变 → 幂等，不产生新版本', async () => {
    await collectAnswer({ fetcher: mkAnswerFetcher('<p>同版</p>'), store, taskId: 't1' }, { id: 'a1' })
    const r2 = await collectAnswer({ fetcher: mkAnswerFetcher('<p>同版</p>'), store, taskId: 't1' }, { id: 'a1' })
    expect(r2.stats.unchanged).toBeGreaterThanOrEqual(1)
    expect(await store.getRevisions('answer', 'a1')).toHaveLength(1)
  })

  it('断点续抓：暂停保存游标，恢复后不重复抓取已完成页', async () => {
    const page1 = { data: [{ id: 'x1', content: '<p>1</p>', created_time: 1, voteup_count: 0, comment_count: 0, author: { url_token: 'u', name: 'u' } }], paging: { is_end: false } }
    const page2 = { data: [{ id: 'x2', content: '<p>2</p>', created_time: 2, voteup_count: 0, comment_count: 0, author: { url_token: 'u', name: 'u' } }], paging: { is_end: true } }
    const pages = [page1, page2]
    const answerPageUrls: string[] = []
    const fetcher: Fetcher = {
      async fetchJson(url: string, opts?: { params?: Record<string, string | number> }) {
        const full = urlWithParams(url, opts?.params)
        if (full.includes('/answers?')) {
          answerPageUrls.push(full)
          return pages.shift() ?? { data: [], paging: { is_end: true } }
        }
        return QUESTION_META
      },
    }
    let checkCount = 0
    const isPaused = () => ++checkCount >= 2 // 第 1 页完成后暂停

    const r1 = await collectQuestion({ fetcher, store, taskId: 't1', isPaused }, { id: 'q9' })
    expect(r1.status).toBe('paused')
    expect(answerPageUrls).toHaveLength(1)
    expect(await store.getCaptureMeta('t1', 'question.q9.answers.offset')).toBe('1')
    expect(await store.getAnswer('x2')).toBeUndefined()

    const r2 = await collectQuestion({ fetcher, store, taskId: 't1', isPaused: () => false }, { id: 'q9' })
    expect(r2.status).toBe('done')
    expect(answerPageUrls).toHaveLength(2)
    expect(answerPageUrls[1]).toContain('offset=1')
    expect((await store.getAnswer('x1'))?.id).toBe('x1')
    expect((await store.getAnswer('x2'))?.id).toBe('x2')
  })

  it('时间窗与游标叠加：同一份数据按不同窗口过滤出不同子集（PRD §0-2 正交语义）', async () => {
    const mk = (id: string, created: string) => ({
      id,
      content: `<p>${id}</p>`,
      created_time: Math.floor(new Date(created).getTime() / 1000),
      voteup_count: 0,
      comment_count: 0,
      author: { url_token: 'u', name: 'u' },
    })
    const page = {
      data: [mk('x1', '2026-01-01T00:00:00Z'), mk('x2', '2026-06-01T00:00:00Z'), mk('x3', '2026-12-01T00:00:00Z')],
      paging: { is_end: true },
    }
    const fetcher: Fetcher = {
      async fetchJson(url: string) {
        if (url.includes('/answers')) return page
        return QUESTION_META
      },
    }
    const r1 = await collectQuestion({ fetcher, store, taskId: 't-win' }, { id: 'q9' }, { timeWindow: { createdAfter: '2026-03-01' } })
    expect(r1.stats.fetched).toBe(3)
    expect(await store.getAnswer('x1')).toBeUndefined()
    expect((await store.getAnswer('x2'))?.id).toBe('x2')
    expect((await store.getAnswer('x3'))?.id).toBe('x3')

    // 时间窗只决定"采哪些"，不删除已入库内容（PRD §0-2 正交语义）
    const r2 = await collectQuestion({ fetcher, store, taskId: 't-win' }, { id: 'q9' }, { timeWindow: { createdAfter: '2026-01-01', createdBefore: '2026-08-01' } })
    expect(r2.stats.fetched).toBe(3)
    expect((await store.getAnswer('x1'))?.id).toBe('x1')
    expect((await store.getAnswer('x3'))?.id).toBe('x3')
  })
})
