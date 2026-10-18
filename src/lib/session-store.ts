/**
 * 会话状态（Ruling-61）：登录态由隐藏知乎窗口（WebView2 profile）承载并跨启动持久，
 * 本类只维护"已登录/匿名"布尔状态；探测与注销经知乎代理（扫码登录 / 知乎 /logout）。
 * v1 的"Cookie 字符串 + DPAPI 落盘"模型随签名桥一并退役（粘贴 Cookie 入口由扫码登录取代）。
 */
export class SessionStore {
  private loggedInValue = false
  private listeners = new Set<() => void>()

  constructor(
    private readonly deps: {
      probe: () => Promise<boolean>
      logout: () => Promise<void>
    },
  ) {}

  get loggedIn(): boolean {
    return this.loggedInValue
  }

  /** 启动/扫码后探测当前会话（幂等；失败按匿名处理） */
  async hydrate(): Promise<void> {
    try {
      this.loggedInValue = await this.deps.probe()
    } catch {
      this.loggedInValue = false
    }
    this.emit()
  }

  /** 注销全链路：知乎 /logout 清服务端会话 + 本机窗口 Cookie；代理失败也复位本地（下次 hydrate 重新探测校准） */
  async logout(): Promise<void> {
    try {
      await this.deps.logout()
    } catch {
      // 网络失败不阻断本地复位；真实登录态以 hydrate 探测为准
    } finally {
      this.loggedInValue = false
      this.emit()
    }
  }

  subscribe(fn: () => void): () => void {
    this.listeners.add(fn)
    return () => this.listeners.delete(fn)
  }

  private emit(): void {
    for (const fn of this.listeners) fn()
  }
}
