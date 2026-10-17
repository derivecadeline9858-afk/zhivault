import { beforeEach, describe, expect, it } from 'vitest'
import { collectAnswer, collectArticle, collectCollection, collectColumn, collectPin, collectQuestion, collectSearch, collectTopic, collectUser } from '@/core/zhihu/collectors'
import { createTestStore } from '../store/helpers'
import { urlWithParams } from './helpers'
import type { ContentStore } from '@/core/store/content-store'
import type { Fetcher } from '@/core/zhihu/fetcher'
import { LOGIN_REQUIRED } from '@/core/zhihu/errors'

let store: ContentStore
let urls: string[]

function router(routes: [RegExp, unknown[]][]): Fetcher {
  return {
    async fetchJson(url: string, opts?: { params?: Record<string, string | number> }) {
      const full = urlWithParams(url, opts?.params)
      urls.push(full)
      for (const [re, queue] of routes) {
        if (re.test(full)) {
          const next = queue.shift()
          if (next === undefined) throw new Error(`路由 ${re} 数据耗尽: ${full}`)
          if (next instanceof Error) throw next
          return next
        }
      }
      throw new Error(`未匹配路由: ${full}`)
    },
  }
}

const author = (token: string, name: string) => ({ id: `id-${token}`, url_token: token, name, avatar_url: `https://pic/${token}` })

const ANSWER_FIXTURE = {
  id: 'a1',
  content: '<p>回答正文</p>',
  created_time: 1700000000,
  voteup_count: 10,
  comment_count: 0,
  question: { id: 'q1', title: '问题一', detail: '<p>问题详情</p>', created_time: 1699999999, answer_count: 1, follower_count: 5, author: author('uq', '提问者') },
  author: author('ua', '答主'),
}

beforeEach(async () => {
  store = await createTestStore()
  urls = []
})

describe('七类采集器 mock API 端到端（PRD §10-3）', () => {
  it('answer：入库回答+问题+作者，raw_json 保留', async () => {
    const fetcher = router([[/answers\/a1/, [ANSWER_FIXTURE]]])
    const r = await collectAnswer({ fetcher, store, taskId: 't-ans' }, { id: 'a1' })
    expect(r.stats).toMatchObject({ fetched: 1, created: 1 })
    const a = await store.getAnswer('a1')
    expect(a?.contentHtml).toBe('<p>回答正文</p>')
    expect(a?.voteupCount).toBe(10)
    expect(a?.createdAt).toBe(new Date(1700000000 * 1000).toISOString())
    expect(JSON.parse(a!.rawJson).content).toBe('<p>回答正文</p>')
    expect((await store.getQuestion('q1'))?.title).toBe('问题一')
    expect((await store.getAuthor('ua'))?.name).toBe('答主')
  })

  it('article / pin 入库', async () => {
    const fetcher = router([
      [/articles\/ar1/, [{ id: 'ar1', title: '文章', content: '<p>文</p>', created: 1700000000, voteup_count: 3, comment_count: 1, author: author('uw', '作者') }]],
      [/pins\/p1/, [{ id: 'p1', content: '<p>想法</p>', created: 1700000001, like_count: 8, comment_count: 2, author: author('ux', '想者') }]],
    ])
    await collectArticle({ fetcher, store, taskId: 't1' }, { id: 'ar1' })
    await collectPin({ fetcher, store, taskId: 't1' }, { id: 'p1' })
    expect((await store.getArticle('ar1'))?.title).toBe('文章')
    expect((await store.getPin('p1'))?.likeCount).toBe(8)
  })

  it('整问题：赞同/时间排序参数 + 截断 maxItems', async () => {
    const mk = (id: string) => ({ id, content: `<p>${id}</p>`, created_time: 1700000000, voteup_count: 1, comment_count: 0, author: author('u', 'u'), question: { id: 'q2' } })
    const fetcher = router([
      [/questions\/q2(?:[?]|$)/, [{ id: 'q2', title: '整问题', detail: '', created_time: 1, answer_count: 3, follower_count: 0, author: author('u0', '提问') }]],
      [/questions\/q2\/answers/, [{ data: [mk('x1'), mk('x2'), mk('x3')], paging: { is_end: true } }]],
    ])
    const r = await collectQuestion({ fetcher, store, taskId: 't-q' }, { id: 'q2' }, { sort: 'created', maxItems: 2 })
    expect(r.stats.fetched).toBe(2)
    expect((await store.getAnswer('x1'))?.questionId).toBe('q2')
    expect(await store.getAnswer('x3')).toBeUndefined()
    expect(urls.some((u) => u.includes('sort_by=created'))).toBe(true)
  })

  it('collection：元信息 + items 整体替换 + 内联实体入库', async () => {
    const fetcher = router([
      [/collections\/c1(?:[?]|$)/, [{ id: 'c1', title: '收藏夹', description: '', item_count: 2, creator: author('uc', '收藏者') }]],
      [/collections\/c1\/items/, [{ data: [
        { content_type: 'Answer', content: ANSWER_FIXTURE },
        { content_type: 'Article', content: { id: 'ar9', title: '藏文', content: '<p>x</p>', created: 1700000000, voteup_count: 0, comment_count: 0, author: author('u', 'u') } },
      ], paging: { is_end: true } }]],
    ])
    const r = await collectCollection({ fetcher, store, taskId: 't-c' }, { id: 'c1' })
    expect(r.stats.fetched).toBe(2)
    expect(r.stats.created).toBe(3) // 回答 + 内嵌问题 + 文章
    expect((await store.getCollection('c1'))?.title).toBe('收藏夹')
    const items = await store.getCollectionItems('c1')
    expect(items).toHaveLength(2)
    expect((await store.getAnswer('a1'))?.id).toBe('a1')
    expect((await store.getArticle('ar9'))?.title).toBe('藏文')
  })

  it('column / topic 入库', async () => {
    const fetcher = router([
      [/columns\/cl1(?:[?]|$)/, [{ id: 'cl1', title: '专栏', description: '', items_count: 1, creator: author('um', '专栏主') }]],
      [/columns\/cl1\/items/, [{ data: [{ content: { id: 'ar8', title: '专文', content: '<p>x</p>', created: 1700000000, voteup_count: 0, comment_count: 0, author: author('u', 'u') } }], paging: { is_end: true } }]],
      [/topics\/t1(?:[?]|$)/, [{ id: 't1', name: '话题', description: '', questions_count: 1, followers_count: 2 }]],
      [/topics\/t1\/questions/, [{ data: [{ question: { id: 'q9', title: '话题问题', detail: '', created_time: 1700000000, answer_count: 0, follower_count: 0, author: author('u', 'u') } }], paging: { is_end: true } }]],
    ])
    await collectColumn({ fetcher, store, taskId: 't1' }, { id: 'cl1' })
    await collectTopic({ fetcher, store, taskId: 't1' }, { id: 't1' })
    expect((await store.getColumn('cl1'))?.title).toBe('专栏')
    expect((await store.getColumnItems('cl1'))[0].articleId).toBe('ar8')
    expect((await store.getTopic('t1'))?.name).toBe('话题')
    expect((await store.getTopicItems('t1'))[0].itemId).toBe('q9')
  })

  it('user.created（匿名）：公开创作入库', async () => {
    const fetcher = router([
      [/members\/tok\/answers/, [{ data: [ANSWER_FIXTURE], paging: { is_end: true } }]],
      [/members\/tok\/articles/, [{ data: [], paging: { is_end: true } }]],
      [/members\/tok\/pins/, [{ data: [], paging: { is_end: true } }]],
    ])
    const r = await collectUser({ fetcher, store, taskId: 't-u', session: { dC0: 'd' } }, { id: 'tok' }, { subMode: 'created' })
    expect(r.stats.created).toBe(2) // 回答 + 问题
    expect((await store.getAuthor('tok'))).toBeDefined()
  })

  it('user.activities 匿名抛 LOGIN_REQUIRED，登录后入库且游标推进', async () => {
    const actPage = {
      data: [{ id: 'act1', type: 'member_voteup_answer', created_time: 1700000100, target: { ...ANSWER_FIXTURE, type: 'answer' } }],
      paging: { is_end: true, after_id: '1700000100' },
    }
    const anonymous = router([[/activities/, [actPage]]])
    await expect(
      collectUser({ fetcher: anonymous, store, taskId: 't-u', session: { dC0: 'd' } }, { id: 'tok' }, { subMode: 'activities' }),
    ).rejects.toMatchObject({ code: LOGIN_REQUIRED })

    const logged = router([[/activities/, [actPage]]])
    const r = await collectUser({ fetcher: logged, store, taskId: 't-u', session: { dC0: 'd', cookie: 'z_c0=xxx' } }, { id: 'tok' }, { subMode: 'activities' })
    expect(r.stats.created).toBeGreaterThanOrEqual(2) // activity + 目标回答(+问题+作者)
    expect((await store.getActivity('act1'))?.activityType).toBe('member_voteup_answer')
    expect(await store.getCaptureMeta('t-u', 'user.tok.activities.after_id')).toBe('1700000100')
  })

  it('关键词搜索：结果批量入库，q 参数传递', async () => {
    const fetcher = router([
      [/search_v3/, [{ items: [
        { type: 'answer', object: ANSWER_FIXTURE },
        { type: 'article', object: { id: 'ar7', title: '搜索结果文', content: '<p>s</p>', created: 1700000000, voteup_count: 0, comment_count: 0, author: author('u', 'u') } },
      ], paging: { is_end: true } }]],
    ])
    const r = await collectSearch({ fetcher, store, taskId: 't-s' }, { query: 'RAG 架构' })
    expect(r.stats.fetched).toBe(2)
    expect((await store.getAnswer('a1'))?.id).toBe('a1')
    expect((await store.getArticle('ar7'))?.title).toBe('搜索结果文')
    expect(urls.some((u) => u.includes('q=RAG'))).toBe(true)
  })
})
