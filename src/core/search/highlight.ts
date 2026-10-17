// 检索高亮：转义优先（防注入），trigram 语义下查询词整体命中（中文整词高亮）

const escapeHtml = (s: string): string =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')

const escapeRegExp = (s: string): string => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

/** 查询词提取：空白切分，过滤短词（trigram 下限 3） */
export function extractTerms(query: string, opts: { minLength?: number } = {}): string[] {
  const min = opts.minLength ?? 3
  return query
    .split(/\s+/)
    .map((t) => t.trim())
    .filter((t) => t.length >= min)
}

/** 命中片段包 <mark>；无命中返回转义后原文 */
export function highlightText(text: string, terms: string[]): string {
  const escaped = escapeHtml(text)
  const pattern = terms.map(escapeRegExp).filter(Boolean).join('|')
  if (!pattern) return escaped
  return escaped.replace(new RegExp(`(${pattern})`, 'gi'), '<mark>$1</mark>')
}
