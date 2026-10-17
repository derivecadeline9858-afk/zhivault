import type { CredentialBridge } from './credential-bridge'

/**
 * 会话状态：内存仅会话副本（PRD §8-1）；
 * 登录写桥接层（应用内 DPAPI 密文落盘），注销全链路 = 清内存 + 删密文 + 复位匿名。
 */
export class SessionStore {
  cookie: string | null = null
  private listeners = new Set<() => void>()

  constructor(private readonly bridge?: CredentialBridge) {}

  get loggedIn(): boolean {
    return !!this.cookie
  }

  /** 匿名签名用的 d_c0（从登录 Cookie 提取；匿名自动获取见任务 6 后序迭代） */
  get dC0(): string {
    const m = /(?:^|;\s*)d_c0=([^;]+)/.exec(this.cookie ?? '')
    return m?.[1] ?? 'anonymous'
  }

  async login(cookie: string): Promise<void> {
    this.cookie = cookie.trim() || null
    if (this.cookie) await this.bridge?.save(this.cookie)
    this.emit()
  }

  /** 启动时从桥接层恢复会话 */
  async hydrate(): Promise<void> {
    if (this.cookie) return
    try {
      this.cookie = (await this.bridge?.load()) ?? null
    } catch {
      this.cookie = null
    }
    this.emit()
  }

  /** 注销全链路（PRD §8-1） */
  async logout(): Promise<void> {
    this.cookie = null
    await this.bridge?.clear()
    this.emit()
  }

  subscribe(fn: () => void): () => void {
    this.listeners.add(fn)
    return () => this.listeners.delete(fn)
  }

  private emit(): void {
    for (const fn of this.listeners) fn()
  }
}
