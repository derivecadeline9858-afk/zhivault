// @vitest-environment node
import { describe, expect, it } from 'vitest'
import { ExportEngine } from '@/core/export/engine'
import { MemorySink, makeBook } from './helpers'

describe('导出引擎编排（PRD §10-4：目录布局 + partial 语义）', () => {
  it('单书全格式：六格式成功 + PDF 记 partial（任务 7 接入）', async () => {
    const sink = new MemorySink()
    const engine = new ExportEngine({ sink, appVersion: '0.1.0' })
    const report = await engine.exportBook(makeBook(), ['html', 'epub', 'markdown', 'txt', 'docx', 'json', 'pdf'])
    expect(report.status).toBe('partial_success')

    const byFormat = Object.fromEntries(report.results.map((r) => [r.format, r]))
    expect(byFormat.html.status).toBe('success')
    expect(byFormat.epub.status).toBe('success')
    expect(byFormat.markdown.status).toBe('success')
    expect(byFormat.txt.status).toBe('success')
    expect(byFormat.docx.status).toBe('success')
    expect(byFormat.json.status).toBe('success')
    expect(byFormat.pdf.status).toBe('failed')
    expect(byFormat.pdf.error?.code).toBe('PDF_DEFERRED')

    // 目录布局：输出目录/<书名>/{format}/
    expect(sink.files.has('测试书/html/index.html')).toBe(true)
    expect([...sink.files.keys()].some((k) => k.startsWith('测试书/epub/') && k.endsWith('.epub'))).toBe(true)
    expect(sink.files.has('测试书/markdown/a1.md')).toBe(true)
    expect([...sink.files.keys()].some((k) => k.startsWith('测试书/txt/') && k.endsWith('.txt'))).toBe(true)
    expect([...sink.files.keys()].some((k) => k.startsWith('测试书/docx/') && k.endsWith('.docx'))).toBe(true)
    expect(sink.files.has('测试书/json/export.json')).toBe(true)

    // markdown 图片改写 + 资产引用清单
    const md = sink.text('测试书/markdown/a1.md')
    expect(md).toContain('assets/h1.jpg')
    expect(md).not.toContain('images/h1.jpg')
    expect(report.referencedAssets).toContain('h1.jpg')
  }, 60_000)

  it('单格式失败不影响其他格式（partial 语义）', async () => {
    const sink = new MemorySink()
    const engine = new ExportEngine({
      sink,
      appVersion: '0.1.0',
      pandoc: {
        convertText: async () => {
          throw new Error('pandoc 崩溃')
        },
        convertBinary: async () => {
          throw new Error('pandoc 崩溃')
        },
      },
    })
    const report = await engine.exportBook(makeBook(), ['markdown', 'docx', 'html'])
    expect(report.status).toBe('partial_success')
    const byFormat = Object.fromEntries(report.results.map((r) => [r.format, r]))
    expect(byFormat.markdown.status).toBe('failed')
    expect(byFormat.docx.status).toBe('failed')
    expect(byFormat.html.status).toBe('success')
  })

  it('路径穿越被拒绝（PRD §8-5 输出目录校验）', async () => {
    const { resolveSafe } = await import('@/core/export/paths')
    expect(resolveSafe('输出', 'a/b.txt')).toBe('输出/a/b.txt')
    expect(() => resolveSafe('输出', '../evil.txt')).toThrowError(/路径穿越/)
    expect(() => resolveSafe('输出', 'a/../../evil.txt')).toThrowError(/路径穿越/)
  })
})
