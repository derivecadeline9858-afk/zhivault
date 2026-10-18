export interface FetchJsonOptions {
  params?: Record<string, string | number>
}

/** 采集器依赖的取数边界：生产由 fetch kernel + 知乎代理传输，测试用 mock 路由 */
export interface Fetcher {
  fetchJson(url: string, opts?: FetchJsonOptions): Promise<unknown>
}

/** 采集器可见的会话面：仅登录布尔（会话本体在知乎代理窗口） */
export interface ZhihuSession {
  loggedIn: boolean
}

export function isLoggedIn(session?: ZhihuSession): boolean {
  return !!session?.loggedIn
}
