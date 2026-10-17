import {
  INVALID_RESPONSE,
  RATE_LIMITED,
  RISK_CONTROL,
  SIGNATURE_UNAVAILABLE,
  ZhiVaultError,
  classifyHttpError,
  isRiskControlText,
} from './errors'
import type { LruCache } from './lru-cache'
import type { RateLimiter } from './rate-limiter'
import type { SignatureBridge } from './signature'

export interface TransportRequest {
  url: string
  method: string
  headers: Record<string, string>
  body?: string
}

export interface TransportResponse {
  status: number
  headers: Record<string, string>
  body: string
}

export type Transport = (req: TransportRequest) => Promise<TransportResponse>

/** 真实浏览器 UA（PRD §8-8）；Referer 固定知乎源站 */
export const ZHIHU_UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36'
export const ZHIHU_REFERER = 'https://www.zhihu.com/'

export interface FetchKernelDeps {
  bridge: SignatureBridge
  limiter: RateLimiter
  cache: LruCache<unknown>
  transport: Transport
}

export interface FetchJsonOptions {
  dC0?: string
  method?: 'GET' | 'POST'
  body?: unknown
  params?: Record<string, string | number>
  skipCache?: boolean
}

export interface FetchKernel {
  fetchJson(url: string, opts?: FetchJsonOptions): Promise<unknown>
}

function cacheKeyOf(url: string, params?: Record<string, string | number>): string {
  if (!params) return url
  const qs = Object.entries(params)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([k, v]) => `${k}=${encodeURIComponent(String(v))}`)
    .join('&')
  return `${url}?${qs}`
}

function withParams(url: string, params?: Record<string, string | number>): string {
  if (!params) return url
  const qs = Object.entries(params)
    .map(([k, v]) => `${k}=${encodeURIComponent(String(v))}`)
    .join('&')
  return url.includes('?') ? `${url}&${qs}` : `${url}?${qs}`
}

/**
 * 采集内核（PRD §10-2）：缓存 → 限速 → 签名 → 仅 UA/Referer/x-zse-96 头发送 → 错误分类。
 * 无凭据默认头（PRD §10-2）；Cookie 等敏感头由上层会话显式注入传输层之外不做。
 */
export function createFetchKernel(deps: FetchKernelDeps): FetchKernel {
  const { bridge, limiter, cache, transport } = deps

  return {
    async fetchJson(url: string, opts: FetchJsonOptions = {}): Promise<unknown> {
      const method = opts.method ?? 'GET'
      const cacheKey = cacheKeyOf(url, opts.params)

      if (method === 'GET' && !opts.skipCache) {
        const hit = cache.get(cacheKey)
        if (hit !== undefined) return hit
      }

      const dC0 = opts.dC0
      if (!dC0) {
        throw new ZhiVaultError(SIGNATURE_UNAVAILABLE, 'SIGNATURE_UNAVAILABLE：缺少 d_c0，无法签名', { url })
      }

      await limiter.acquire()

      let signature: string
      try {
        signature = await bridge.sign(url, dC0)
      } catch (e) {
        if (e instanceof ZhiVaultError) throw e
        throw new ZhiVaultError(
          SIGNATURE_UNAVAILABLE,
          `SIGNATURE_UNAVAILABLE：签名失败（${(e as Error).message ?? String(e)}）`,
          { url, cause: e },
        )
      }

      const finalUrl = withParams(url, opts.params)
      const res = await transport({
        url: finalUrl,
        method,
        headers: {
          'User-Agent': ZHIHU_UA,
          Referer: ZHIHU_REFERER,
          'x-zse-96': signature,
        },
        body: opts.body === undefined ? undefined : JSON.stringify(opts.body),
      })

      if (res.status >= 400) {
        const err = classifyHttpError(res.status, finalUrl)
        if (err.code === RATE_LIMITED) limiter.handleRateLimitSignal()
        throw err
      }

      if (isRiskControlText(res.body)) {
        limiter.handleRateLimitSignal()
        throw new ZhiVaultError(RISK_CONTROL, 'RISK_CONTROL：触发知乎风控验证', {
          httpStatus: res.status,
          url: finalUrl,
        })
      }

      let data: unknown
      try {
        data = JSON.parse(res.body)
      } catch {
        throw new ZhiVaultError(INVALID_RESPONSE, `INVALID_RESPONSE：响应非 JSON（${finalUrl}）`, {
          httpStatus: res.status,
          url: finalUrl,
        })
      }

      if (method === 'GET') cache.set(cacheKey, data)
      return data
    },
  }
}
