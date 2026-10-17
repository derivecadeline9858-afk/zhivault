import type { BookSource } from './book'
import { sanitizeHtml, stripTrackingParams } from './sanitize'

const escapeHtml = (s: string): string =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')

/**
 * 单文件 HTML 导出（PRD §5.5）。
 * 不内嵌任何脚本：公式/代码高亮由知藏阅读器内渲染（KaTeX/highlight.js），
 * 导出文件离线可读且零脚本面（§8-4）。
 */
export function renderBookHtml(book: BookSource): string {
  const articles = book.items
    .map((item) => {
      const meta = [
        item.authorName ? escapeHtml(item.authorName) : '',
        item.url
          ? `<a href="${escapeHtml(stripTrackingParams(item.url))}">来源</a>`
          : '',
        `收录于 ${escapeHtml(item.capturedAt)}`,
      ]
        .filter(Boolean)
        .join(' · ')
      return `<article data-type="${item.entityType}" data-id="${escapeHtml(item.entityId)}">
<h2>${escapeHtml(item.title)}</h2>
<p class="meta">${meta}</p>
<div class="content">
${sanitizeHtml(item.contentHtml)}
</div>
</article>`
    })
    .join('\n<hr>\n')

  return `<!doctype html>
<html lang="zh-CN">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${escapeHtml(book.title)}</title>
<!-- 公式与代码高亮在知藏阅读器内渲染（KaTeX / highlight.js）；本文件无脚本，离线可读 -->
<link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/katex@0.16.11/dist/katex.min.css">
<link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/highlight.js@11.10.0/styles/github.min.css">
<style>
body{max-width:760px;margin:0 auto;padding:2rem 1.5rem;font-family:'Source Han Sans SC','Noto Sans CJK SC','Microsoft YaHei',sans-serif;line-height:1.75;color:#1f2937}
h1{border-bottom:2px solid #059669;padding-bottom:.5rem}
.meta{color:#6b7280;font-size:.875rem}
blockquote{color:#4b5563;border-left:4px solid #d1d5db;margin-left:0;padding-left:1rem}
img{max-width:100%}
footer{margin-top:3rem;padding-top:1rem;border-top:1px solid #e5e7eb;color:#9ca3af;font-size:.8125rem;text-align:center}
</style>
</head>
<body>
<h1>${escapeHtml(book.title)}</h1>
${articles}
<footer>由 橙茶星 · 知藏 ZhiVault 生成</footer>
</body>
</html>
`
}
