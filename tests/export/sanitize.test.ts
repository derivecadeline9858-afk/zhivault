import { describe, expect, it } from 'vitest'
import { sanitizeHtml, stripTrackingParams } from '@/core/export/sanitize'

describe('导出内容清洗（PRD §8-4：内联清除脚本与事件属性）', () => {
  it('清除 script 标签及其内容', () => {
    const out = sanitizeHtml('<p>前</p><script>alert(1)</script><p>后</p>')
    expect(out).toBe('<p>前</p><p>后</p>')
  })

  it('清除事件属性 on*', () => {
    const out = sanitizeHtml('<img src="a.jpg" onerror="x()" onclick="y()"><p onmouseover="z()">文</p>')
    expect(out).not.toContain('onerror')
    expect(out).not.toContain('onclick')
    expect(out).not.toContain('onmouseover')
    expect(out).toContain('src="a.jpg"')
    expect(out).toContain('<p>文</p>')
  })

  it('清除 javascript: 链接', () => {
    const out = sanitizeHtml('<a href="javascript:alert(1)">坏</a><a href="https://ok.com">好</a>')
    expect(out).not.toContain('javascript:')
    expect(out).toContain('href="https://ok.com"')
  })

  it('保留正文与常用标签', () => {
    const html = '<h1>标题</h1><p><strong>粗</strong><em>斜</em><code>x</code></p><blockquote>引</blockquote>'
    expect(sanitizeHtml(html)).toBe(html)
  })

  it('去除跟踪参数（PRD §5.5 Markdown 规则）', () => {
    expect(stripTrackingParams('https://a.com/x?utm_source=zhihu&id=1&spm=2')).toBe('https://a.com/x?id=1')
    expect(stripTrackingParams('https://a.com/x?id=1')).toBe('https://a.com/x?id=1')
  })
})
