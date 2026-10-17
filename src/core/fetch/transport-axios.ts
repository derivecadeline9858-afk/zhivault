import axios from 'axios'

import { NETWORK_ERROR, TIMEOUT, ZhiVaultError } from './errors'
import type { Transport, TransportRequest } from './kernel'

/** 生产传输层：axios 适配为 Transport；状态码全量放行由内核分类 */
export function createAxiosTransport(timeoutMs = 15_000): Transport {
  return async (req: TransportRequest) => {
    try {
      const res = await axios.request<string>({
        url: req.url,
        method: req.method as 'GET' | 'POST',
        headers: req.headers,
        data: req.body,
        timeout: timeoutMs,
        responseType: 'text',
        transformResponse: [(d: unknown) => d],
        validateStatus: () => true,
      })
      const headers: Record<string, string> = {}
      for (const [k, v] of Object.entries(res.headers as Record<string, unknown>)) {
        headers[k] = Array.isArray(v) ? v.join(', ') : String(v)
      }
      return {
        status: res.status,
        headers,
        body: typeof res.data === 'string' ? res.data : JSON.stringify(res.data),
      }
    } catch (e) {
      const err = e as { code?: string; message?: string }
      const isTimeout = err.code === 'ECONNABORTED' || /timeout/i.test(err.message ?? '')
      const code = isTimeout ? TIMEOUT : NETWORK_ERROR
      throw new ZhiVaultError(code, `${code}：${err.message ?? '请求失败'}`, { url: req.url, cause: e })
    }
  }
}
