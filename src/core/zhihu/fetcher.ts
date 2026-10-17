export interface FetchJsonOptions {
  params?: Record<string, string | number>
}

/** 采集器依赖的取数边界：生产由 fetch kernel + 会话绑定，测试用 mock 路由 */
export interface Fetcher {
  fetchJson(url: string, opts?: FetchJsonOptions): Promise<unknown>
}

export interface ZhihuSession {
  dC0: string
  /** 登录态 Cookie（存在即视为已登录，可见性矩阵据此判断） */
  cookie?: string
}

export function isLoggedIn(session?: ZhihuSession): boolean {
  return !!session?.cookie
}
