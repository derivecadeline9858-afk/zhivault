import { describe, expect, it } from 'vitest'
import { buildObsidianVault } from '@/core/export/obsidian'
import { makeBook } from './helpers'

describe('Obsidian Vault 导出（PRD §5.1：双链 + front-matter）golden test', () => {
  it('文件树与内容精确匹配', () => {
    const book = makeBook()
    const files = buildObsidianVault(book)
    const names = Object.keys(files).sort()
    expect(names).toEqual(['a1.md', 'ar1.md'])

    expect(files['a1.md']).toBe(
      [
        '---',
        'id: a1',
        'type: answer',
        'title: 回答：如何评价 RAG？',
        'author: 答主甲',
        'url: https://www.zhihu.com/question/1/answer/a1',
        'captured_at: 2026-01-02T03:04:05.000Z',
        'question: "[[如何评价 RAG？]]"',
        '---',
        '',
        '<p>回答正文</p><img src="images/h1.jpg">',
        '',
      ].join('\n'),
    )

    expect(files['ar1.md']).toContain('type: article')
    expect(files['ar1.md']).toContain('title: 文章：RAG 入门')
    expect(files['ar1.md']).not.toContain('question:')
  })
})
