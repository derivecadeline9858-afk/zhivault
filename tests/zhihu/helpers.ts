/** 测试用：把 Fetcher 的 params 选项拼进 URL（模拟生产 kernel 行为） */
export function urlWithParams(
  url: string,
  params?: Record<string, string | number>,
): string {
  if (!params) return url
  const qs = Object.entries(params)
    .map(([k, v]) => `${k}=${encodeURIComponent(String(v))}`)
    .join('&')
  return url.includes('?') ? `${url}&${qs}` : `${url}?${qs}`
}
