import { describe, expect, it, vi } from 'vitest'
import { SSRF_BLOCKED, createGuardedTransport, isAllowedUrl } from '@/core/fetch/url-guard'
import type { TransportRequest, TransportResponse } from '@/core/fetch/kernel'

describe('SSRF 白名单（PRD §8-3：TS 侧与 Rust 同规则表，请求必经守卫）', () => {
  it('规则表：知乎域与更新域放行，其余拒绝', () => {
    for (const u of ['https://www.zhihu.com/api/v4/x', 'https://pic1.zhimg.com/a.jpg', 'https://updates.zhivault.app/m.json']) {
      expect(isAllowedUrl(u)).toBe(true)
    }
    for (const u of ['https://evil.com/', 'https://zhihu.com.evil.com/x', 'http://127.0.0.1/', 'garbage']) {
      expect(isAllowedUrl(u)).toBe(false)
    }
  })

  it('守卫在传输前拦截：非白名单 URL 不触达传输层', async () => {
    const inner = vi.fn(async (_req: TransportRequest): Promise<TransportResponse> => ({ status: 200, headers: {}, body: '{}' }))
    const guarded = createGuardedTransport(inner, (url) => Promise.resolve(isAllowedUrl(url)))
    await expect(
      guarded({ url: 'https://evil.com/x', method: 'GET', headers: {} }),
    ).rejects.toMatchObject({ code: SSRF_BLOCKED })
    expect(inner).not.toHaveBeenCalled()

    await expect(
      guarded({ url: 'https://api.zhihu.com/ok', method: 'GET', headers: {} }),
    ).resolves.toBeDefined()
    expect(inner).toHaveBeenCalledTimes(1)
  })
})
