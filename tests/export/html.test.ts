import { describe, expect, it } from 'vitest'
import { renderBookHtml } from '@/core/export/html'
import { makeBook } from './helpers'

describe('HTML 导出（PRD §5.5：单文件 + 页脚署名 + 清除脚本）', () => {
  it('包含内容、无脚本、署名页脚', () => {
    const book = makeBook()
    const html = renderBookHtml(book)
    expect(html).toContain('<title>测试书</title>')
    expect(html).toContain('回答正文')
    expect(html).toContain('文章内容')
    expect(html).not.toContain('<script')
    expect(html).not.toContain('onerror')
    expect(html).not.toContain('javascript:')
    expect(html).toContain('由 橙茶星 · 知藏 ZhiVault 生成')
    // 代码高亮/公式资源引用（CDN，离线降级可读）
    expect(html).toContain('katex')
    expect(html).toContain('highlight')
  })

  it('作者与来源链接可见', () => {
    const html = renderBookHtml(makeBook())
    expect(html).toContain('答主甲')
    expect(html).toContain('https://www.zhihu.com/question/1/answer/a1')
  })
})
