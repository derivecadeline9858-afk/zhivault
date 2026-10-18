// 知乎页面上下文代理（Ruling-61/62）：隐藏 WebviewWindow（Rust 创建）加载 www.zhihu.com，
// 其 document-start 初始化脚本在主世界装轮询运行器（签名配方经运行时互操作知乎 webpack 模块，
// 零知乎 JS 入库，2026-10-18 实测校准）。本模块经隔离 eval 写 data-zv-job 属性派单，
// 运行器签名 + fetch 后经 __TAURI_INTERNALS__.invoke → Rust 命令 → 主窗口事件回传。
// WebView2 ExecuteScript 属隔离世界，直接 eval 访问不到页面全局——此为 v1/v2 两代签名桥失败的根因。
import { invoke } from '@tauri-apps/api/core'
import { listen } from '@tauri-apps/api/event'

import { NETWORK_ERROR, SIGNATURE_UNAVAILABLE, TIMEOUT, ZhiVaultError } from './errors'
import type { Transport, TransportRequest, TransportResponse } from './kernel'

export const ZHIHU_PROXY_LABEL = 'zhihu-proxy'
export const ZHIHU_PROXY_URL = 'https://www.zhihu.com/'
export const PROXY_RESULT_EVENT = 'zhivault:proxy-result'
export const ZHIHU_API_V4 = 'https://www.zhihu.com/api/v4'
export const ZHIHU_QR_API = 'https://www.zhihu.com/api/v3/account/api/login/qrcode'
export const ZHIHU_LOGOUT_URL = 'https://www.zhihu.com/logout'

const REQUEST_TIMEOUT_MS = 25_000
const PAGE_READY_TIMEOUT_MS = 30_000
const HANDSHAKE_TIMEOUT_MS = 2_000
const HANDSHAKE_INTERVAL_MS = 600

export interface ProxyResultPayload {
  seq: number
  ok: boolean
  status?: number
  body?: string
  /** 以 SIGNATURE_UNAVAILABLE: 开头时主侧映射为签名失效（知乎页面结构漂移信号） */
  error?: string
}

/** 派发给主世界运行器的任务（经 data-zv-job 属性传输） */
interface ProxyJob {
  seq: number
  type: 'probe' | 'fetch'
  url?: string
  method?: string
  body?: string
}

export interface ZhihuProxyDeps {
  /** 注入 eval 通道（测试优先） */
  evalFn?: (js: string) => Promise<unknown>
  /** 窗口工厂：默认 Rust 命令创建（生产 = Tauri） */
  windowFactory?: () => Promise<unknown>
  /** 事件订阅：默认主窗口 listen（生产 = Tauri） */
  eventListen?: (fn: (p: ProxyResultPayload) => void) => Promise<() => void>
  windowLabel?: string
  bridgeUrl?: string
}

export type QrStatus = 'pending' | 'scanned' | 'confirmed' | 'expired'

export interface QrTicket {
  token: string
  link: string
  /** 秒级 Unix 时间戳（知乎返回 expires_at） */
  expiresAt: number
}

/** 隔离世界派单脚本：写属性即返回（主世界运行器轮询取走执行） */
function buildPushScript(job: ProxyJob): string {
  return `document.documentElement.setAttribute('data-zv-job', ${JSON.stringify(JSON.stringify(job))})`
}

/**
 * 知乎请求代理：懒创建隐藏知乎窗口，属性派单，事件回传结果。
 * 同时承载扫码登录（创建票据/轮询）与会话探测（/api/v4/me）。
 * 所有任务经内部互斥串行化（属性队列不保证并发安全）。
 */
export class ZhihuProxy {
  private windowPromise: Promise<unknown> | null = null
  private channelPromise: Promise<void> | null = null
  private pending = new Map<number, (p: ProxyResultPayload) => void>()
  private jobChain: Promise<unknown> = Promise.resolve()
  private seq = 0

  constructor(private readonly deps: ZhihuProxyDeps = {}) {}

  /** 确保隐藏窗口与事件回传通道就绪（幂等）；就绪 = 页面 complete 且 d_c0 落 Cookie */
  private async ensureReady(): Promise<void> {
    this.windowPromise ??= (this.deps.windowFactory ?? (() =>
      invoke<void>('create_zhihu_proxy_window', {
        label: this.deps.windowLabel ?? ZHIHU_PROXY_LABEL,
        url: this.deps.bridgeUrl ?? ZHIHU_PROXY_URL,
      })))()

    this.channelPromise ??= (async () => {
      const subscribe =
        this.deps.eventListen ??
        ((fn: (p: ProxyResultPayload) => void) =>
          listen<ProxyResultPayload>(PROXY_RESULT_EVENT, (e) => fn(e.payload)).then((un) => un))
      await subscribe((p) => {
        this.pending.get(p.seq)?.(p)
      })
      await this.windowPromise
      await this.waitPageReady()
    })()
    return this.channelPromise
  }

  /** 页面就绪探测：派 probe 任务直至 readyState=complete 且 d_c0 存在（上限 PAGE_READY_TIMEOUT_MS） */
  private async waitPageReady(): Promise<void> {
    const deadline = Date.now() + PAGE_READY_TIMEOUT_MS
    let lastError: string | undefined
    for (;;) {
      const r = await this.dispatch({ type: 'probe' }, HANDSHAKE_TIMEOUT_MS).catch((e) => {
        lastError = (e as Error).message ?? String(e)
        return null
      })
      const body = r?.body ?? ''
      if (body.startsWith('ready:complete') && body.includes(':dc0=1:')) return
      if (Date.now() > deadline) {
        throw new ZhiVaultError(
          NETWORK_ERROR,
          `知乎代理页面就绪超时（最后回传=${body || '无'}；最后错误=${lastError ?? '无'}）`,
        )
      }
      await new Promise((r2) => setTimeout(r2, HANDSHAKE_INTERVAL_MS))
    }
  }

  /** 串行派单：写属性 → 等待事件回传（签名/fetch/探测共用） */
  private dispatch(job: Omit<ProxyJob, 'seq'>, timeoutMs: number): Promise<TransportResponse> {
    const run = async (): Promise<TransportResponse> => {
      const seq = ++this.seq
      const full: ProxyJob = { ...job, seq }
      const evalFn =
        this.deps.evalFn ??
        ((js: string) =>
          invoke<void>('eval_in_webview', { label: this.deps.windowLabel ?? ZHIHU_PROXY_LABEL, js }))

      return new Promise<TransportResponse>((resolve, reject) => {
        const timer = setTimeout(() => {
          this.pending.delete(seq)
          reject(new ZhiVaultError(TIMEOUT, `TIMEOUT：知乎代理回传超时（${timeoutMs}ms）`))
        }, timeoutMs)
        this.pending.set(seq, (p) => {
          clearTimeout(timer)
          this.pending.delete(seq)
          if (!p.ok) {
            const msg = p.error ?? '未知错误'
            if (msg.startsWith(`${SIGNATURE_UNAVAILABLE}:`)) {
              reject(new ZhiVaultError(SIGNATURE_UNAVAILABLE, msg))
              return
            }
            reject(new ZhiVaultError(NETWORK_ERROR, `NETWORK_ERROR：${msg}`))
            return
          }
          resolve({ status: p.status ?? 0, headers: {}, body: p.body ?? '' })
        })
        evalFn(buildPushScript(full)).catch((e) => {
          clearTimeout(timer)
          this.pending.delete(seq)
          reject(new ZhiVaultError(NETWORK_ERROR, `NETWORK_ERROR：派单失败（${(e as Error).message ?? String(e)}）`, { cause: e }))
        })
      })
    }
    const result = this.jobChain.then(run, run)
    this.jobChain = result.then(
      () => undefined,
      () => undefined,
    )
    return result
  }

  /** eval 注入"签名 + fetch"并等待回传（transport 适配器与 QR/会话探测共用） */
  async request(url: string, init: { method?: string; body?: string } = {}): Promise<TransportResponse> {
    await this.ensureReady()
    return this.dispatch({ type: 'fetch', url, method: init.method ?? 'GET', body: init.body }, REQUEST_TIMEOUT_MS)
  }

  /** 会话探测：GET /api/v4/me（200 且含 id = 已登录） */
  async probeLoggedIn(): Promise<boolean> {
    const r = await this.request(`${ZHIHU_API_V4}/me`).catch(() => null)
    if (!r || r.status !== 200) return false
    try {
      const j = JSON.parse(r.body) as { id?: unknown }
      return typeof j.id === 'number' || typeof j.id === 'string'
    } catch {
      return false
    }
  }

  /** 创建扫码登录票据 */
  async qrCreate(): Promise<QrTicket> {
    const r = await this.request(ZHIHU_QR_API, { method: 'POST' })
    if (r.status !== 200) {
      throw new ZhiVaultError(NETWORK_ERROR, `扫码票据创建失败（HTTP ${r.status}）`, { httpStatus: r.status, url: ZHIHU_QR_API })
    }
    try {
      const j = JSON.parse(r.body) as { token?: string; link?: string; expires_at?: number }
      if (!j.token || !j.link || !j.expires_at) throw new Error('字段缺失')
      return { token: j.token, link: j.link, expiresAt: j.expires_at }
    } catch (e) {
      throw new ZhiVaultError(NETWORK_ERROR, `扫码票据响应异常（${(e as Error).message}）`, { url: ZHIHU_QR_API })
    }
  }

  /** 轮询扫码状态；status≠0 时用会话探测区分"已扫码待确认"与"已确认" */
  async qrCheck(token: string): Promise<QrStatus> {
    const r = await this.request(`${ZHIHU_QR_API}/${token}/scan_info`).catch(() => null)
    if (!r || r.status !== 200) return 'expired'
    let status: unknown
    try {
      status = (JSON.parse(r.body) as { status?: unknown }).status
    } catch {
      return 'expired'
    }
    if (status === 0) return 'pending'
    return (await this.probeLoggedIn()) ? 'confirmed' : 'scanned'
  }

  /** 注销：知乎 /logout 走 Set-Cookie 清理会话（fetch 响应链由浏览器处理） */
  async logout(): Promise<void> {
    await this.request(ZHIHU_LOGOUT_URL, { method: 'GET' }).catch(() => undefined)
  }
}

/** 内核 Transport 适配：签名与 Cookie 均由代理页面处理 */
export function createZhihuProxyTransport(proxy: ZhihuProxy): Transport {
  return async (req: TransportRequest): Promise<TransportResponse> => {
    return proxy.request(req.url, { method: req.method, body: req.body })
  }
}
