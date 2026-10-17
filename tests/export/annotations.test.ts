import { describe, expect, it } from 'vitest'
import { exportAnnotations, type AnnotationExportItem } from '@/core/export/annotations'

const items: AnnotationExportItem[] = [
  {
    entityTitle: '回答：如何评价 RAG？',
    entityUrl: 'https://www.zhihu.com/question/1/answer/a1',
    selectedText: '关键句一',
    note: '重要',
    color: 'emerald',
    createdAt: '2026-01-02T03:04:05.000Z',
  },
  {
    entityTitle: '文章：RAG 入门',
    entityUrl: 'https://zhuanlan.zhihu.com/p/ar1',
    selectedText: '关键句二',
    note: null,
    color: 'yellow',
    createdAt: '2026-01-03T03:04:05.000Z',
  },
]

describe('标注集导出（PRD §5.2 用户故事 7）', () => {
  it('Markdown 格式', () => {
    const md = exportAnnotations(items, 'markdown')
    expect(md).toContain('# 标注集')
    expect(md).toContain('> 关键句一')
    expect(md).toContain('重要')
    expect(md).toContain('emerald')
    expect(md).toContain('关键句二')
    expect(md).toContain('https://zhuanlan.zhihu.com/p/ar1')
  })

  it('JSON 格式', () => {
    const json = JSON.parse(exportAnnotations(items, 'json'))
    expect(json.schema).toBe('zhivault.annotations.v1')
    expect(json.annotations).toHaveLength(2)
    expect(json.annotations[0]).toMatchObject({ selectedText: '关键句一', color: 'emerald' })
  })
})
