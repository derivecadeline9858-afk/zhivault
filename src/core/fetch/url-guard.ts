// SSRF 白名单守卫（PRD §8-3）：与 Rust network_guard 同规则表；应用内经 guard_url 命令由壳裁决。
// 采集传输层出网前必过此守卫——测试可注入本地裁决函数。
import { ZhiVaultError } from './errors'
import type { Transport, TransportRequest, TransportResponse } from './kernel'

export const SSRF_BLOCKED = 'SSRF_BLOCKED'

export const UPDATES_HOST = 'updates.zhivault.app'

export function isAllowedUrl(url: string): boolean {
  try {
    const u = new URL(url)
    if (u.protocol !== 'https:' && u.protocol !== 'http:') return false
    const host = u.hostname.toLowerCase().replace(/\.$/, '')
    return (
      host === 'zhihu.com' ||
      host.endsWith('.zhihu.com') ||
      host === 'zhimg.com' ||
      host.endsWith('.zhimg.com') ||
      host === UPDATES_HOST
    )
  } catch {
    return false
  }
}

export type UrlVerdict = (url: string) => Promise<boolean>

/** 包装传输层：URL 非白名单直接拒绝且不触达内层传输 */
export function createGuardedTransport(inner: Transport, verdict: UrlVerdict): Transport {
  return async (req: TransportRequest): Promise<TransportResponse> => {
    const ok = await verdict(req.url).catch(() => false)
    if (!ok) {
      throw new ZhiVaultError(SSRF_BLOCKED, `SSRF_BLOCKED：非白名单域名（${req.url}）`, { url: req.url })
    }
    return inner(req)
  }
}
