/** 会话状态（MVP 内存态；DPAPI 加密落盘属任务 6） */
class SessionStore {
  cookie: string | null = null
  private listeners = new Set<() => void>()

  get loggedIn(): boolean {
    return !!this.cookie
  }

  /** 匿名签名用的 d_c0（从登录 Cookie 提取；匿名采集任务 6 补全自动获取） */
  get dC0(): string {
    const m = /(?:^|;\s*)d_c0=([^;]+)/.exec(this.cookie ?? '')
    return m?.[1] ?? 'anonymous'
  }

  setCookie(cookie: string): void {
    this.cookie = cookie.trim() || null
    this.emit()
  }

  clear(): void {
    this.cookie = null
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

export const sessionStore = new SessionStore()
