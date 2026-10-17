import { ZhiVaultError } from '@/core/fetch/errors'
import type { BookSource, ExportFormat } from './book'
import { buildEpub } from './epub'
import { renderBookHtml } from './html'
import { buildJsonExport } from './json'
import { PandocQueue, createPandocRunner, type PandocRunner } from './pandoc'
import { resolveSafe } from './paths'
import { sanitizeHtml } from './sanitize'
import type { ExportSink } from './sink'

export const PDF_DEFERRED = 'PDF_DEFERRED'

export interface ExportResultEntry {
  format: ExportFormat
  status: 'success' | 'failed'
  files: string[]
  error?: { code: string; message: string }
}

export interface ExportReport {
  bookTitle: string
  /** partial 语义（PRD §7.4-6）：单格式失败不影响其他格式，总态如实汇报 */
  status: 'success' | 'partial_success' | 'failed'
  results: ExportResultEntry[]
  /** markdown 引用的图片资产（由导出中心从图片池搬运） */
  referencedAssets: string[]
}

const IMG_POOL_RE = /images\/([\w.-]+)/g

function frontMatter(fields: [string, string | undefined][]): string {
  const lines = fields.filter(([, v]) => v !== undefined).map(([k, v]) => `${k}: ${JSON.stringify(v)}`)
  return `---\n${lines.join('\n')}\n---\n\n`
}

/**
 * 导出引擎（PRD §10-4）：目录布局 输出目录/<书名>/{format}/；
 * pandoc 走串行队列；PDF 由任务 7 注册 renderer 后接入。
 */
export class ExportEngine {
  private readonly pandoc: PandocRunner

  constructor(
    private readonly deps: {
      sink: ExportSink
      appVersion: string
      pandoc?: PandocRunner
      /** 任务 7 注入：Edge 无头打印；未注入时 PDF 记 PDF_DEFERRED partial */
      pdfRenderer?: (book: BookSource) => Promise<string[]>
    },
  ) {
    this.pandoc = new PandocQueue(deps.pandoc ?? createPandocRunner())
  }

  async exportBook(book: BookSource, formats: ExportFormat[]): Promise<ExportReport> {
    const results: ExportResultEntry[] = []
    const referencedAssets = new Set<string>()

    for (const format of formats) {
      try {
        const files = await this.exportFormat(book, format, referencedAssets)
        results.push({ format, status: 'success', files })
      } catch (e) {
        const err = e as Partial<ZhiVaultError>
        results.push({
          format,
          status: 'failed',
          files: [],
          error: { code: err.code ?? 'EXPORT_FAILED', message: (e as Error).message ?? String(e) },
        })
      }
    }

    const ok = results.filter((r) => r.status === 'success').length
    const status: ExportReport['status'] =
      ok === results.length ? 'success' : ok === 0 ? 'failed' : 'partial_success'
    return { bookTitle: book.title, status, results, referencedAssets: [...referencedAssets] }
  }

  private async exportFormat(
    book: BookSource,
    format: ExportFormat,
    referencedAssets: Set<string>,
  ): Promise<string[]> {
    const dir = book.title
    switch (format) {
      case 'html': {
        const path = resolveSafe(dir, 'html/index.html')
        await this.deps.sink.writeText(path, renderBookHtml(book))
        return [path]
      }
      case 'epub': {
        const volumes = buildEpub(book)
        const written: string[] = []
        for (let i = 0; i < volumes.length; i++) {
          const name = volumes.length > 1 ? `${book.title}-${i + 1}.epub` : `${book.title}.epub`
          const path = resolveSafe(dir, `epub/${name}`)
          await this.deps.sink.writeBinary(path, volumes[i])
          written.push(path)
        }
        return written
      }
      case 'markdown': {
        const written: string[] = []
        for (const item of book.items) {
          for (const m of item.contentHtml.matchAll(IMG_POOL_RE)) {
            referencedAssets.add(m[1])
          }
          const html = sanitizeHtml(item.contentHtml).replace(IMG_POOL_RE, 'assets/$1')
          const body = await this.pandoc.convertText(html, 'gfm')
          const fm = frontMatter([
            ['title', item.title],
            ['author', item.authorName],
            ['url', item.url],
            ['captured_at', item.capturedAt],
            ['id', item.entityId],
          ])
          const path = resolveSafe(dir, `markdown/${item.entityId}.md`)
          await this.deps.sink.writeText(path, fm + body)
          written.push(path)
        }
        return written
      }
      case 'txt': {
        const sections: string[] = []
        for (const item of book.items) {
          const text = await this.pandoc.convertText(sanitizeHtml(item.contentHtml), 'plain')
          sections.push(`${item.title}\n\n${text.trimEnd()}`)
        }
        const path = resolveSafe(dir, `txt/${book.title}.txt`)
        await this.deps.sink.writeText(path, sections.join('\n\n———\n\n'))
        return [path]
      }
      case 'docx': {
        const combined = book.items
          .map((item) => `<h1>${item.title}</h1>${sanitizeHtml(item.contentHtml)}`)
          .join('\n')
        const bytes = await this.pandoc.convertBinary(combined, 'docx')
        const path = resolveSafe(dir, `docx/${book.title}.docx`)
        await this.deps.sink.writeBinary(path, bytes)
        return [path]
      }
      case 'json': {
        const data = buildJsonExport(book, { appVersion: this.deps.appVersion })
        const path = resolveSafe(dir, 'json/export.json')
        await this.deps.sink.writeText(path, JSON.stringify(data, null, 2))
        return [path]
      }
      case 'pdf': {
        if (!this.deps.pdfRenderer) {
          throw new ZhiVaultError(PDF_DEFERRED, 'PDF_DEFERRED：当前环境未注册 PDF 渲染器（应用内经系统 Edge 打印）')
        }
        return this.deps.pdfRenderer(book)
      }
    }
  }
}
