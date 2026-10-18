import { beforeEach, describe, expect, it } from 'vitest'
import { LruCache } from '@/core/fetch/lru-cache'
import { TokenBucketRateLimiter } from '@/core/fetch/rate-limiter'
import { createFetchKernel } from '@/core/fetch/kernel'
import { BatchExecutor } from '@/core/task/executor'
import { createTestStore } from '../store/helpers'
import type { ContentStore } from '@/core/store/content-store'
import type { TransportRequest } from '@/core/fetch/kernel'

function makeVirtual() {
  let t = 0
  const timers: { at: number; resolve: () => void }[] = []
  return {
    now: () => t,
    sleep: (ms: number) =>
      new Promise<void>((resolve) => {
        timers.push({ at: t + ms, resolve })
      }),
    /** 排空微任务队列（深层 await 链需多次让出），再把虚拟时间推进到最近到期的定时器 */
    async runTimers() {
      for (;;) {
        for (let i = 0; i < 1000; i++) await Promise.resolve()
        if (timers.length === 0) break
        timers.sort((a, b) => a.at - b.at)
        const next = timers.shift()!
        t = next.at
        next.resolve()
      }
    },
  }
}

const mkAnswer = (id: string) => ({
  id,
  content: `<p>${id}</p>`,
  created_time: 1700000000,
  voteup_count: 1,
  comment_count: 0,
  question: { id: `q-${id}`, title: 't', detail: '', created_time: 1, answer_count: 1, follower_count: 0, author: { url_token: 'u', name: 'u' } },
  author: { url_token: 'u', name: 'u' },
})

let store: ContentStore

beforeEach(async () => {
  store = await createTestStore()
})

describe('多用户批量执行器（PRD §10-3：共享限速桶、断点续抓）', () => {
  it('三任务并发下总请求速率不超额（真实令牌桶 + 虚拟时钟）', async () => {
    const v = makeVirtual()
    const limiter = new TokenBucketRateLimiter({ ratePerSecond: 1, burst: 1, now: v.now, sleep: v.sleep })
    const callTimes: number[] = []
    const transport = async (req: TransportRequest) => {
      callTimes.push(v.now())
      const m = /answers\/(\w+)/.exec(req.url)
      return { status: 200, headers: {}, body: JSON.stringify(mkAnswer(m![1])) }
    }
    const kernel = createFetchKernel({
      limiter,
      cache: new LruCache({ capacity: 100 }),
      transport,
    })
    const executor = new BatchExecutor({
      fetcher: { fetchJson: (url, o) => kernel.fetchJson(url, o) },
      store,
      session: { loggedIn: true },
      maxConcurrency: 3,
    })
    const runPromise = executor.run([
      { id: 't1', url: 'https://www.zhihu.com/question/q1/answer/a1' },
      { id: 't2', url: 'https://www.zhihu.com/question/q2/answer/a2' },
      { id: 't3', url: 'https://www.zhihu.com/question/q3/answer/a3' },
    ])
    await v.runTimers()
    const summary = await runPromise
    expect(summary.status).toBe('done')
    expect(summary.totals.created).toBeGreaterThanOrEqual(3)
    expect(callTimes.length).toBeGreaterThanOrEqual(3)
    // 突发 1：相邻请求间隔必须 >= 1000ms（1 req/s）
    for (let i = 1; i < callTimes.length; i++) {
      expect(callTimes[i] - callTimes[i - 1]).toBeGreaterThanOrEqual(1000)
    }
  })

  it('默认并发 1 顺序执行；单任务失败不拖垮整批', async () => {
    const v = makeVirtual()
    const limiter = new TokenBucketRateLimiter({ ratePerSecond: 100, burst: 100, now: v.now, sleep: v.sleep })
    const transport = async (req: TransportRequest) => {
      if (req.url.includes('a2')) return { status: 404, headers: {}, body: '{}' }
      const m = /answers\/(\w+)/.exec(req.url)
      return { status: 200, headers: {}, body: JSON.stringify(mkAnswer(m![1])) }
    }
    const kernel = createFetchKernel({
      limiter,
      cache: new LruCache({ capacity: 100 }),
      transport,
    })
    const executor = new BatchExecutor({
      fetcher: { fetchJson: (url, o) => kernel.fetchJson(url, o) },
      store,
      session: { loggedIn: true },
    })
    const summary = await executor.run([
      { id: 't1', url: 'https://www.zhihu.com/question/q1/answer/a1' },
      { id: 't2', url: 'https://www.zhihu.com/question/q2/answer/a2' },
      { id: 't3', url: 'https://www.zhihu.com/question/q3/answer/a3' },
    ])
    expect(summary.tasks.find((t) => t.taskId === 't1')?.status).toBe('done')
    expect(summary.tasks.find((t) => t.taskId === 't2')?.status).toBe('failed')
    expect(summary.tasks.find((t) => t.taskId === 't3')?.status).toBe('done')
    expect(summary.totals.failed).toBe(1)
  })

  it('批量级暂停/恢复：剩余任务断点续跑', async () => {
    const v = makeVirtual()
    const limiter = new TokenBucketRateLimiter({ ratePerSecond: 100, burst: 100, now: v.now, sleep: v.sleep })
    const transport = async (req: TransportRequest) => {
      const m = /answers\/(\w+)/.exec(req.url)
      return { status: 200, headers: {}, body: JSON.stringify(mkAnswer(m![1])) }
    }
    const kernel = createFetchKernel({
      limiter,
      cache: new LruCache({ capacity: 100 }),
      transport,
    })
    const executor = new BatchExecutor({
      fetcher: { fetchJson: (url, o) => kernel.fetchJson(url, o) },
      store,
      session: { loggedIn: true },
    })
    executor.pause()
    const s1 = await executor.run([{ id: 't1', url: 'https://www.zhihu.com/question/q1/answer/a1' }])
    expect(s1.status).toBe('paused')
    expect(s1.tasks[0].status).toBe('pending')

    const s2 = await executor.resume()
    expect(s2.status).toBe('done')
    expect(s2.tasks[0].status).toBe('done')
    expect((await store.getAnswer('a1'))?.id).toBe('a1')
  })
})
