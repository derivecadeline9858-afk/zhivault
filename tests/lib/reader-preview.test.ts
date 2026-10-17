import { describe, expect, it } from 'vitest'
import { buildReaderPreviewDoc } from '@/lib/reader-preview'

describe('阅读器预览 sandbox 文档（PRD §8-4：阅读器 iframe 无脚本渲染）', () => {
  it('正文脚本与事件属性被清除', () => {
    const doc = buildReaderPreviewDoc(
      '标题',
      '<p>正文</p><script>alert(1)</script><img src="x.jpg" onerror="pwn()"><a href="javascript:evil()">链</a>',
    )
    expect(doc).not.toContain('<script')
    expect(doc).not.toContain('onerror')
    expect(doc).not.toContain('javascript:')
    expect(doc).toContain('<p>正文</p>')
    expect(doc).toContain('x.jpg')
  })

  it('文档为完整 HTML 且含标题', () => {
    const doc = buildReaderPreviewDoc('我的标题', '<p>内容</p>')
    expect(doc).toContain('<title>我的标题</title>')
    expect(doc.startsWith('<!doctype html>')).toBe(true)
  })
})
