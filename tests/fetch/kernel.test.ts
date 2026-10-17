import { beforeEach, describe, expect, it, vi } from 'vitest'
import { INVALID_RESPONSE, RATE_LIMITED, RISK_CONTROL, SIGNATURE_UNAVAILABLE, ZhiVaultError } from '@/core/fetch/errors'
import { LruCache } from '@/core/fetch/lru-cache'
import { createFetchKernel, type TransportRequest, type TransportResponse } from '@/core/fetch/kernel'
import type { SignatureBridge } from '@/core/fetch/signature'

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

const bridge: SignatureBridge = {
  sign: vi.fn(async (url: string, dC0: string) => `sig(${url},${dC0})`),
}

const URL1 = 'https://www.zhihu.com/api/v4/answers/1'

let cache: LruCache<unknown>
let limiter: ReturnType<typeof makeLimiter>

beforeEach(() => {
  cache = new LruCache({ capacity: 10 })
  limiter = makeLimiter()
  vi.mocked(bridge.sign).mockClear()
})

describe('采集内核编排（mock 签名桥，PRD §10-2 验收）', () => {
  it('默认仅 UA/Referer/x-zse-96，无凭据头', async () => {
    const { transport, requests } = makeTransport([{ status: 200, headers: {}, body: '{"ok":1}' }])
    const kernel = createFetchKernel({ bridge, limiter, cache, transport })
    const data = await kernel.fetchJson(URL1, { dC0: 'd0' })
    expect(data).toEqual({ ok: 1 })
    const headers = requests[0].headers
    expect(headers['User-Agent']).toMatch(/Mozilla\/5.0/)
    expect(headers['Referer']).toBe('https://www.zhihu.com/')
    expect(headers['x-zse-96']).toBe(`sig(${URL1},d0)`)
    expect(Object.keys(headers)).not.toContain('Cookie')
    expect(Object.keys(headers)).not.toContain('Authorization')
  })

  it('签名桥以 (url, d_c0) 调用', async () => {
    const { transport } = makeTransport([{ status: 200, headers: {}, body: '{}' }])
    const kernel = createFetchKernel({ bridge, limiter, cache, transport })
    await kernel.fetchJson(URL1, { dC0: 'dc0-value' })
    expect(bridge.sign).toHaveBeenCalledWith(URL1, 'dc0-value')
  })

  it('每次请求先过限速器', async () => {
    const { transport } = makeTransport([
      { status: 200, headers: {}, body: '{}' },
      { status: 200, headers: {}, body: '{}' },
    ])
    const kernel = createFetchKernel({ bridge, limiter, cache, transport })
    await kernel.fetchJson(URL1, { dC0: 'd' })
    await kernel.fetchJson(URL1 + '?page=2', { dC0: 'd' })
    expect(limiter.acquire).toHaveBeenCalledTimes(2)
  })

  it('缺少 d_c0 直接报 SIGNATURE_UNAVAILABLE（不调用签名桥）', async () => {
    const { transport } = makeTransport([])
    const kernel = createFetchKernel({ bridge, limiter, cache, transport })
    const err: unknown = await kernel.fetchJson(URL1).catch((e) => e)
    expect(err).toBeInstanceOf(ZhiVaultError)
    expect((err as ZhiVaultError).code).toBe(SIGNATURE_UNAVAILABLE)
    expect(bridge.sign).not.toHaveBeenCalled()
    expect(transport).not.toHaveBeenCalled()
  })

  it('签名桥失败透传 SIGNATURE_UNAVAILABLE（UI 引导更新版本的信号）', async () => {
    const failingBridge: SignatureBridge = {
      sign: vi.fn(async () => {
        throw new Error('eval not ready')
      }),
    }
    const { transport } = makeTransport([])
    const kernel = createFetchKernel({ bridge: failingBridge, limiter, cache, transport })
    await expect(kernel.fetchJson(URL1, { dC0: 'd' })).rejects.toMatchObject({
      code: SIGNATURE_UNAVAILABLE,
    })
    expect(transport).not.toHaveBeenCalled()
  })

  it('429 触发 RATE_LIMITED 并通知限速器退避', async () => {
    const { transport } = makeTransport([{ status: 429, headers: {}, body: '{}' }])
    const kernel = createFetchKernel({ bridge, limiter, cache, transport })
    await expect(kernel.fetchJson(URL1, { dC0: 'd' })).rejects.toMatchObject({ code: RATE_LIMITED })
    expect(limiter.handleRateLimitSignal).toHaveBeenCalledTimes(1)
  })

  it('风控文案（200）触发 RISK_CONTROL 并退避', async () => {
    const { transport } = makeTransport([{ status: 200, headers: {}, body: '系统检测到你的操作存在异常，请完成安全验证' }])
    const kernel = createFetchKernel({ bridge, limiter, cache, transport })
    await expect(kernel.fetchJson(URL1, { dC0: 'd' })).rejects.toMatchObject({ code: RISK_CONTROL })
    expect(limiter.handleRateLimitSignal).toHaveBeenCalledTimes(1)
  })

  it('非法 JSON 报 INVALID_RESPONSE', async () => {
    const { transport } = makeTransport([{ status: 200, headers: {}, body: 'not-json{{' }])
    const kernel = createFetchKernel({ bridge, limiter, cache, transport })
    await expect(kernel.fetchJson(URL1, { dC0: 'd' })).rejects.toMatchObject({ code: INVALID_RESPONSE })
  })

  it('GET 命中缓存不再走传输层', async () => {
    const { transport } = makeTransport([{ status: 200, headers: {}, body: '{"n":1}' }])
    const kernel = createFetchKernel({ bridge, limiter, cache, transport })
    const first = await kernel.fetchJson(URL1, { dC0: 'd' })
    const second = await kernel.fetchJson(URL1, { dC0: 'd' })
    expect(transport).toHaveBeenCalledTimes(1)
    expect(second).toEqual(first)
    expect(limiter.acquire).toHaveBeenCalledTimes(1)
  })

  it('带不同参数视为不同缓存键', async () => {
    const { transport } = makeTransport([
      { status: 200, headers: {}, body: '{"p":1}' },
      { status: 200, headers: {}, body: '{"p":2}' },
    ])
    const kernel = createFetchKernel({ bridge, limiter, cache, transport })
    await kernel.fetchJson(URL1, { dC0: 'd', params: { page: 1 } })
    await kernel.fetchJson(URL1, { dC0: 'd', params: { page: 2 } })
    expect(transport).toHaveBeenCalledTimes(2)
  })

  it('POST 不读写缓存', async () => {
    const { transport } = makeTransport([
      { status: 200, headers: {}, body: '{"ok":1}' },
      { status: 200, headers: {}, body: '{"ok":2}' },
    ])
    const kernel = createFetchKernel({ bridge, limiter, cache, transport })
    await kernel.fetchJson(URL1, { dC0: 'd', method: 'POST', body: { a: 1 } })
    await kernel.fetchJson(URL1, { dC0: 'd', method: 'POST', body: { a: 2 } })
    expect(transport).toHaveBeenCalledTimes(2)
  })
})
