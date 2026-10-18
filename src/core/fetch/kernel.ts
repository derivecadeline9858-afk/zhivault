import {
  INVALID_RESPONSE,
  RATE_LIMITED,
  RISK_CONTROL,
  ZhiVaultError,
  classifyHttpError,
  isRiskControlText,
} from './errors'
import type { LruCache } from './lru-cache'
import type { RateLimiter } from './rate-limiter'

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

export interface FetchKernelDeps {
  limiter: RateLimiter
  cache: LruCache<unknown>
  transport: Transport
}

export interface FetchJsonOptions {
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
 * 采集内核（PRD §10-2）：缓存 → 限速 → 传输 → 错误分类。
 * 签名与 Cookie 由传输层自理（生产 = 知乎页面上下文代理，见 zhihu-proxy.ts）；
 * 传输层实现必须保证请求串与签名串一致——该不变量封装在代理内部。
 */
export function createFetchKernel(deps: FetchKernelDeps): FetchKernel {
  const { limiter, cache, transport } = deps

  return {
    async fetchJson(url: string, opts: FetchJsonOptions = {}): Promise<unknown> {
      const method = opts.method ?? 'GET'
      const cacheKey = cacheKeyOf(url, opts.params)

      if (method === 'GET' && !opts.skipCache) {
        const hit = cache.get(cacheKey)
        if (hit !== undefined) return hit
      }

      await limiter.acquire()

      const finalUrl = withParams(url, opts.params)
      const res = await transport({
        url: finalUrl,
        method,
        headers: {},
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
