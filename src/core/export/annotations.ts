/** 标注集导出（PRD §5.2 用户故事 7：阅读器高亮批注一键导出） */

export interface AnnotationExportItem {
  entityTitle: string
  entityUrl?: string
  selectedText: string
  note: string | null
  color: string
  createdAt: string
}

export function exportAnnotations(items: AnnotationExportItem[], format: 'markdown' | 'json'): string {
  if (format === 'json') {
    return JSON.stringify(
      {
        schema: 'zhivault.annotations.v1',
        exportedAt: new Date().toISOString(),
        annotations: items,
      },
      null,
      2,
    )
  }

  const sections = new Map<string, { url?: string; lines: string[] }>()
  for (const item of items) {
    const section = sections.get(item.entityTitle) ?? { url: item.entityUrl, lines: [] }
    const line = [`- [${item.color}]`, `> ${item.selectedText}`]
    if (item.note) line.push(`  批注：${item.note}`)
    if (item.entityUrl) line.push(`  链接：${item.entityUrl}`)
    section.lines.push(line.join('\n'))
    sections.set(item.entityTitle, section)
  }

  const out: string[] = ['# 标注集', '']
  for (const [title, section] of sections) {
    out.push(`## ${title}`, ...section.lines, '')
  }
  return out.join('\n')
}
