/** 导出内容清洗（PRD §8-4/§5.5：内联清除脚本与事件属性，导出后无残留） */

export function sanitizeHtml(html: string): string {
  return (
    html
      // script 标签（含内容）
      .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script\s*>/gi, '')
      // 事件属性 on*（双引号/单引号/裸值）
      .replace(/\s+on[a-zA-Z]+\s*=\s*"[^"]*"/g, '')
      .replace(/\s+on[a-zA-Z]+\s*=\s*'[^']*'/g, '')
      .replace(/\s+on[a-zA-Z]+\s*=\s*[^\s>]+/g, '')
      // javascript: 伪协议
      .replace(/(\s(?:href|src|xlink:href)\s*=\s*["']?)\s*javascript:[^"'>\s]*/gi, '$1#')
  )
}

const TRACKING_PARAMS = new Set(['spm', 'si', 'gclid', 'fbclid', 'dclid', 'mc_cid', 'mc_eid'])

/** 去除跟踪参数（utm_* 与常见追踪键），保留业务参数（PRD §5.5） */
export function stripTrackingParams(url: string): string {
  try {
    const u = new URL(url)
    for (const key of [...u.searchParams.keys()]) {
      if (key.startsWith('utm_') || TRACKING_PARAMS.has(key)) u.searchParams.delete(key)
    }
    return u.toString()
  } catch {
    return url
  }
}
