import { beforeEach, describe, expect, it, vi } from 'vitest'
import { INVALID_RESPONSE, RATE_LIMITED, RISK_CONTROL, ZhiVaultError } from '@/core/fetch/errors'
import { LruCache } from '@/core/fetch/lru-cache'
import { createFetchKernel, type TransportRequest, type TransportResponse } from '@/core/fetch/kernel'

interface RecordedRequest extends TransportRequest {
  order: number
}

function makeTransport(responses: TransportResponse[]) {
  const requests: RecordedRequest[] = []
  let order = 0
  const transport = vi.fn(async (req: TransportRequest) => {
    requests.push({ ...req, order: order++ })
    const r = responses.shift()
    if (!r) throw new Error('no queued response')
    return r
  })
  return { transport, requests }
}

function makeLimiter() {
  return {
    acquire: vi.fn(async () => {}),
    handleRateLimitSignal: vi.fn(),
    onBackoff: vi.fn(),
    setRate: vi.fn(),
    getState: vi.fn(() => ({ ratePerSecond: 1, burst: 1, tokens: 1 })),
  }
}

const URL1 = 'https://www.zhihu.com/api/v4/answers/1'

let cache: LruCache<unknown>
let limiter: ReturnType<typeof makeLimiter>

beforeEach(() => {
  cache = new LruCache({ capacity: 10 })
  limiter = makeLimiter()
})

describe('采集内核编排（签名/Cookie 由传输层自理，Ruling-61）', () => {
  it('传输层收到带参最终 URL，请求/签名串一致的不变量封装在传输层内部', async () => {
    const { transport, requests } = makeTransport([{ status: 200, headers: {}, body: '{"ok":1}' }])
    const kernel = createFetchKernel({ limiter, cache, transport })
    const data = await kernel.fetchJson(URL1, { params: { offset: 1, q: '知 藏' } })
    expect(data).toEqual({ ok: 1 })
    expect(requests[0].url).toBe('https://www.zhihu.com/api/v4/answers/1?offset=1&q=%E7%9F%A5%20%E8%97%8F')
    expect(requests[0].method).toBe('GET')
    expect(requests[0].headers).toEqual({})
  })

  it('URL 已有 query 时参数以 & 追加', async () => {
    const { transport, requests } = makeTransport([{ status: 200, headers: {}, body: '{}' }])
    const kernel = createFetchKernel({ limiter, cache, transport })
    await kernel.fetchJson(`${URL1}?include=x`, { params: { page: 2 } })
    expect(requests[0].url).toBe(`${URL1}?include=x&page=2`)
  })

  it('POST 以 JSON 体发送', async () => {
    const { transport, requests } = makeTransport([{ status: 200, headers: {}, body: '{}' }])
    const kernel = createFetchKernel({ limiter, cache, transport })
    await kernel.fetchJson(URL1, { method: 'POST', body: { a: 1 } })
    expect(requests[0].body).toBe('{"a":1}')
  })

  it('每次请求先过限速器', async () => {
    const { transport } = makeTransport([
      { status: 200, headers: {}, body: '{}' },
      { status: 200, headers: {}, body: '{}' },
    ])
    const kernel = createFetchKernel({ limiter, cache, transport })
    await kernel.fetchJson(URL1)
    await kernel.fetchJson(URL1 + '?page=2')
    expect(limiter.acquire).toHaveBeenCalledTimes(2)
  })

  it('429 触发 RATE_LIMITED 并通知限速器退避', async () => {
    const { transport } = makeTransport([{ status: 429, headers: {}, body: '{}' }])
    const kernel = createFetchKernel({ limiter, cache, transport })
    await expect(kernel.fetchJson(URL1)).rejects.toMatchObject({ code: RATE_LIMITED })
    expect(limiter.handleRateLimitSignal).toHaveBeenCalledTimes(1)
  })

  it('风控文案（200）触发 RISK_CONTROL 并退避', async () => {
    const { transport } = makeTransport([{ status: 200, headers: {}, body: '系统检测到你的操作存在异常，请完成安全验证' }])
    const kernel = createFetchKernel({ limiter, cache, transport })
    await expect(kernel.fetchJson(URL1)).rejects.toMatchObject({ code: RISK_CONTROL })
    expect(limiter.handleRateLimitSignal).toHaveBeenCalledTimes(1)
  })

  it('非法 JSON 报 INVALID_RESPONSE', async () => {
    const { transport } = makeTransport([{ status: 200, headers: {}, body: 'not-json{{' }])
    const kernel = createFetchKernel({ limiter, cache, transport })
    await expect(kernel.fetchJson(URL1)).rejects.toMatchObject({ code: INVALID_RESPONSE })
  })

  it('4xx/5xx 透传 HTTP 分类（403 → FORBIDDEN）', async () => {
    const { transport } = makeTransport([{ status: 403, headers: {}, body: '{}' }])
    const kernel = createFetchKernel({ limiter, cache, transport })
    const err: unknown = await kernel.fetchJson(URL1).catch((e) => e)
    expect(err).toBeInstanceOf(ZhiVaultError)
    expect((err as ZhiVaultError).code).toBe('FORBIDDEN')
  })

  it('GET 命中缓存不再走传输层', async () => {
    const { transport } = makeTransport([{ status: 200, headers: {}, body: '{"n":1}' }])
    const kernel = createFetchKernel({ limiter, cache, transport })
    const first = await kernel.fetchJson(URL1)
    const second = await kernel.fetchJson(URL1)
    expect(transport).toHaveBeenCalledTimes(1)
    expect(second).toEqual(first)
    expect(limiter.acquire).toHaveBeenCalledTimes(1)
  })

  it('带不同参数视为不同缓存键', async () => {
    const { transport } = makeTransport([
      { status: 200, headers: {}, body: '{"p":1}' },
      { status: 200, headers: {}, body: '{"p":2}' },
    ])
    const kernel = createFetchKernel({ limiter, cache, transport })
    await kernel.fetchJson(URL1, { params: { page: 1 } })
    await kernel.fetchJson(URL1, { params: { page: 2 } })
    expect(transport).toHaveBeenCalledTimes(2)
  })

  it('POST 不读写缓存', async () => {
    const { transport } = makeTransport([
      { status: 200, headers: {}, body: '{"ok":1}' },
      { status: 200, headers: {}, body: '{"ok":2}' },
    ])
    const kernel = createFetchKernel({ limiter, cache, transport })
    await kernel.fetchJson(URL1, { method: 'POST', body: { a: 1 } })
    await kernel.fetchJson(URL1, { method: 'POST', body: { a: 2 } })
    expect(transport).toHaveBeenCalledTimes(2)
  })
})
