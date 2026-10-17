import { sanitizeHtml } from '@/core/export/sanitize'

const escapeHtml = (s: string): string =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')

/** 阅读器预览文档：正文经导出级清洗（PRD §8-4），由 sandbox iframe 渲染（无脚本） */
export function buildReaderPreviewDoc(title: string, contentHtml: string): string {
  return `<!doctype html>
<html lang="zh-CN">
<head>
<meta charset="utf-8">
<title>${escapeHtml(title)}</title>
<style>
body{font-family:'Source Han Sans SC','Noto Sans CJK SC','Microsoft YaHei',sans-serif;line-height:1.75;padding:1rem;color:#1f2937}
img{max-width:100%}
blockquote{border-left:4px solid #d1d5db;margin-left:0;padding-left:1rem;color:#4b5563}
pre{background:#f3f4f6;padding:.75rem;border-radius:.375rem;overflow-x:auto}
</style>
</head>
<body>
${sanitizeHtml(contentHtml)}
</body>
</html>
`
}
