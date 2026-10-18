import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { TIMEOUT } from '@/core/fetch/errors'
import {
  createZhihuProxyTransport,
  PROXY_RESULT_EVENT,
  ZhihuProxy,
  type ProxyResultPayload,
} from '@/core/fetch/zhihu-proxy'

interface FakePage {
  proxy: ZhihuProxy
  jobs: { type: string; url?: string; method?: string; seq: number }[]
  fire: (p: ProxyResultPayload) => void
}

function decodeJob(js: string): { type: string; seq: number; url?: string; method?: string; body?: string } {
  const m = /setAttribute\('data-zv-job', "((?:[^"\\]|\\.)*)"\)/.exec(js)
  if (!m) throw new Error('not a push script: ' + js.slice(0, 60))
  return JSON.parse(JSON.parse(`"${m[1]}"`)) as { type: string; seq: number; url?: string; method?: string }
}

/** 模拟知乎页面（含主世界运行器语义）：evalFn 捕获派单；auto=false 时由测试手动 fire 回传 */
function fakePage(handler: (url: string, init: { method?: string }) => { status: number; body: string }, auto = true): FakePage {
  const jobs: FakePage['jobs'] = []
  let subscriber: ((p: ProxyResultPayload) => void) | null = null
  const proxy = new ZhihuProxy({
    windowFactory: async () => ({}),
    eventListen: async (fn) => {
      subscriber = fn
      return () => undefined
    },
    evalFn: async (js: string) => {
      const job = decodeJob(js)
      jobs.push(job)
      if (job.type === 'probe') {
        setTimeout(() => subscriber?.({ seq: job.seq, ok: true, status: 0, body: 'ready:complete:dc0=1:ua=fake' }), 0)
        return
      }
      if (auto) {
        setTimeout(() => {
          const r = handler(job.url ?? '', { method: job.method })
          subscriber?.({ seq: job.seq, ok: true, status: r.status, body: r.body })
        }, 0)
      }
    },
  })
  return { proxy, jobs, fire: (p) => subscriber?.(p) }
}

const SCAN_API = 'https://www.zhihu.com/api/v3/account/api/login/qrcode'

describe('知乎页面上下文代理（Ruling-61/62：属性派单 + 主世界运行器）', () => {
  it('request 经事件回传拿到响应（eval 无返回值，属性派单）', async () => {
    const { proxy, jobs } = fakePage((url) =>
      url.endsWith('/me') ? { status: 200, body: '{"id":"123456","name":"橙茶星"}' } : { status: 404, body: '{}' },
    )
    expect(await proxy.probeLoggedIn()).toBe(true)
    const fetchJob = jobs.find((j) => j.type === 'fetch')
    expect(fetchJob?.url).toBe('https://www.zhihu.com/api/v4/me')
  })

  it('匿名 /api/v4/me（401/无 id）判定未登录', async () => {
    const { proxy } = fakePage(() => ({ status: 401, body: '{"error":{"code":401}}' }))
    expect(await proxy.probeLoggedIn()).toBe(false)
  })

  it('qrCreate 解析 token/link/expires_at', async () => {
    const { proxy, jobs } = fakePage((url, init) => {
      if (url === SCAN_API && init.method === 'POST') {
        return { status: 200, body: '{"token":"abc123","link":"https://www.zhihu.com/account/scan/login/abc123","expires_at":1792292094}' }
      }
      return { status: 404, body: '{}' }
    })
    const t = await proxy.qrCreate()
    expect(t).toEqual({ token: 'abc123', link: 'https://www.zhihu.com/account/scan/login/abc123', expiresAt: 1792292094 })
    expect(jobs.find((j) => j.url === SCAN_API)?.method).toBe('POST')
  })

  it('qrCheck：status 0 → pending；非 0 且已登录 → confirmed；未登录 → scanned', async () => {
    const pending = fakePage((url) =>
      url.includes('/scan_info') ? { status: 200, body: '{"status":0}' } : { status: 401, body: '{}' },
    )
    expect(await pending.proxy.qrCheck('t1')).toBe('pending')

    const confirmed = fakePage((url) => {
      if (url.includes('/scan_info')) return { status: 200, body: '{"status":1}' }
      if (url.endsWith('/me')) return { status: 200, body: '{"id":"7"}' }
      return { status: 401, body: '{}' }
    })
    expect(await confirmed.proxy.qrCheck('t1')).toBe('confirmed')

    const scanned = fakePage((url) => {
      if (url.includes('/scan_info')) return { status: 200, body: '{"status":1}' }
      return { status: 401, body: '{}' }
    })
    expect(await scanned.proxy.qrCheck('t1')).toBe('scanned')
  })

  it('qrCheck：票据失效（非 200/坏 JSON）→ expired', async () => {
    const { proxy } = fakePage(() => ({ status: 404, body: '{"error":{}}' }))
    expect(await proxy.qrCheck('dead')).toBe('expired')
  })

  it('回传超时映射 TIMEOUT', async () => {
    vi.useFakeTimers()
    try {
      const page = fakePage(() => ({ status: 200, body: '{}' }), false)
      const p = page.proxy.request('https://www.zhihu.com/api/v4/answers/1')
      p.catch(() => {}) // 占位处理：拒绝稍后经 expect 断言，避免未处理拒绝告警
      await vi.advanceTimersByTimeAsync(5000) // 探测 + 派单 + 超时窗口
      await vi.advanceTimersByTimeAsync(26000)
      await expect(p).rejects.toMatchObject({ code: TIMEOUT })
    } finally {
      vi.useRealTimers()
    }
  })

  it('页面 fetch 异常映射 NETWORK_ERROR', async () => {
    const page = fakePage(() => ({ status: 200, body: '{}' }), false)
    const p = page.proxy.request('https://www.zhihu.com/api/v4/answers/1')
    await vi.waitFor(() => expect(page.jobs.some((j) => j.url?.endsWith('/answers/1'))).toBe(true))
    const req = page.jobs.find((j) => j.url?.endsWith('/answers/1'))!
    page.fire({ seq: req.seq, ok: false, error: 'Failed to fetch' })
    await expect(p).rejects.toMatchObject({ code: 'NETWORK_ERROR' })
  })

  it('transport 适配器：内核请求 → 代理响应', async () => {
    const { proxy } = fakePage(() => ({ status: 200, body: '{"ok":1}' }))
    const transport = createZhihuProxyTransport(proxy)
    const res = await transport({ url: 'https://www.zhihu.com/api/v4/answers/1', method: 'GET', headers: {} })
    expect(res.status).toBe(200)
    expect(JSON.parse(res.body)).toEqual({ ok: 1 })
  })

  it('任务串行化：第二个任务等第一个完成后才派发', async () => {
    const order: string[] = []
    const page = fakePage((url) => {
      order.push(url)
      return { status: 200, body: '{"ok":1}' }
    })
    const r1 = page.proxy.request('https://www.zhihu.com/api/v4/answers/1')
    const r2 = page.proxy.request('https://www.zhihu.com/api/v4/answers/2')
    await Promise.all([r1, r2])
    expect(order).toEqual([
      'https://www.zhihu.com/api/v4/answers/1',
      'https://www.zhihu.com/api/v4/answers/2',
    ])
  })
})

describe('事件名常量', () => {
  it('回传事件名稳定（前后端共享契约）', () => {
    expect(PROXY_RESULT_EVENT).toBe('zhivault:proxy-result')
  })
})

beforeEach(() => {
  vi.restoreAllMocks()
})

afterEach(() => {
  vi.useRealTimers()
})
