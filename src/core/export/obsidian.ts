import type { BookSource } from './book'
import { sanitizeHtml } from './sanitize'

const yamlScalar = (s: string): string => {
  // 含全角冒号/方括号等 YAML 特殊形态时加引号
  if (/[[\]{}":#]|^- |:$/.test(s) || s.includes('：') === false && s.includes(': ')) {
    return JSON.stringify(s)
  }
  return s
}

/**
 * Obsidian Vault 导出（PRD §5.1：front-matter + 双链）。
 * 图片保持 images/ 相对路径（导出中心统一搬运资产）。
 */
export function buildObsidianVault(book: BookSource): Record<string, string> {
  const files: Record<string, string> = {}
  for (const item of book.items) {
    const fm = [
      '---',
      `id: ${item.entityId}`,
      `type: ${item.entityType}`,
      `title: ${yamlScalar(item.title)}`,
      item.authorName ? `author: ${yamlScalar(item.authorName)}` : null,
      item.url ? `url: ${item.url}` : null,
      `captured_at: ${item.capturedAt}`,
      item.questionTitle ? `question: "${`[[${item.questionTitle}]]`}"` : null,
      '---',
      '',
      sanitizeHtml(item.contentHtml),
      '',
    ]
      .filter((line): line is string => line !== null)
      .join('\n')
    files[`${item.entityId}.md`] = fm
  }
  return files
}
