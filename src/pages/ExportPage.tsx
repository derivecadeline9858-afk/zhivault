import { FolderOpen } from 'lucide-react'
import { useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import type { BookSource, ExportFormat, ExportReport } from '@/core/export'
import { ExportEngine } from '@/core/export'
import { createEdgePdfRenderer } from '@/core/export/pdf-renderer'
import { createRustSink } from '@/core/export/rust-sink'
import { buildBookFromStore, getDb } from '@/lib/db'
import { loadExportHistory, pushExportHistory, type ExportHistoryEntry } from '@/lib/export-history'

const ALL_FORMATS: ExportFormat[] = ['html', 'epub', 'markdown', 'txt', 'docx', 'json', 'pdf']
const FORMAT_LABELS: Record<ExportFormat, string> = {
  html: 'HTML',
  epub: 'EPUB',
  markdown: 'Markdown',
  txt: 'TXT',
  docx: 'DOCX',
  json: 'JSON',
  pdf: 'PDF（任务 7 提供）',
}
const BOOK_SOURCES = [
  { id: 'all', label: '全部内容（合并成书）' },
  { id: 'answer', label: '仅回答' },
  { id: 'article', label: '仅文章' },
  { id: 'pin', label: '仅想法' },
  { id: 'question', label: '仅问题' },
]
const FORMATS_KEY = 'zhivault.export.formats'

/** 浏览器演示环境的内存 Sink（应用内经 Rust 落盘） */
function createMemorySink(): {
  sink: import('@/core/export').ExportSink
  files: Map<string, string | Uint8Array>
} {
  const files = new Map<string, string | Uint8Array>()
  return {
    files,
    sink: {
      writeText: async (p, c) => void files.set(p, c),
      writeBinary: async (p, d) => void files.set(p, d),
      exists: async () => false,
    },
  }
}

export function ExportPage() {
  const [bookSource, setBookSource] = useState('all')
  const [formats, setFormats] = useState<ExportFormat[]>(() => {
    try {
      return JSON.parse(localStorage.getItem(FORMATS_KEY) ?? '["html","markdown","json"]')
    } catch {
      return ['html', 'markdown', 'json']
    }
  })
  const [outputDir, setOutputDir] = useState('')
  const [busy, setBusy] = useState(false)
  const [report, setReport] = useState<ExportReport | null>(null)
  const [history, setHistory] = useState<ExportHistoryEntry[]>([])
  const [demoNote, setDemoNote] = useState('')

  useEffect(() => {
    setHistory(loadExportHistory())
  }, [])

  const toggleFormat = (f: ExportFormat) => {
    setFormats((prev) => {
      const next = prev.includes(f) ? prev.filter((x) => x !== f) : [...prev, f]
      localStorage.setItem(FORMATS_KEY, JSON.stringify(next))
      return next
    })
  }

  const pickDir = async () => {
    try {
      const { open } = await import('@tauri-apps/plugin-dialog')
      const dir = await open({ directory: true })
      if (typeof dir === 'string') setOutputDir(dir)
    } catch {
      setDemoNote('浏览器演示模式：导出到内存（不落盘）')
    }
  }

  const doExport = async () => {
    setBusy(true)
    setReport(null)
    setDemoNote('')
    try {
      const types = bookSource === 'all' ? ['answer', 'article', 'pin', 'question'] : [bookSource]
      const db = await getDb()
      let book: BookSource
      if (db) {
        book = await buildBookFromStore(db, types)
      } else {
        // 演示书：直接来自演示数据
        const { createDemoFetcher } = await import('@/lib/demo-fixtures')
        const f = createDemoFetcher()
        const raw = (await f.fetchJson('https://www.zhihu.com/api/v4/answers/demo-1')) as Record<string, string>
        book = {
          title: '知藏演示书',
          items: [
            {
              entityType: 'answer',
              entityId: 'demo-1',
              title: '演示回答',
              authorName: '演示答主',
              url: 'https://www.zhihu.com/question/q-demo/answer/demo-1',
              capturedAt: new Date().toISOString(),
              contentHtml: raw.content ?? '<p>演示</p>',
              rawJson: JSON.stringify(raw),
            },
          ],
        }
      }

      const inTauri = typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window
      let sink
      if (inTauri && outputDir) {
        sink = createRustSink(outputDir)
      } else {
        const mem = createMemorySink()
        sink = mem.sink
        if (!inTauri) setDemoNote('浏览器演示模式：文件写入内存，报告如下')
        else if (!outputDir) setDemoNote('未选择输出目录：文件写入内存，报告如下')
      }

      const engine = new ExportEngine({
        sink,
        appVersion: '0.1.0',
        pdfRenderer: inTauri && outputDir ? createEdgePdfRenderer(outputDir) : undefined,
      })
      const r = await engine.exportBook(book, formats)
      setReport(r)
      setHistory(
        pushExportHistory({
          at: new Date().toISOString(),
          bookTitle: book.title,
          formats: r.results.filter((x) => x.status === 'success').map((x) => x.format),
          status: r.status,
          outputDir: outputDir || '（内存）',
        }),
      )
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="flex h-full flex-col gap-6 overflow-y-auto p-8">
      <section className="rounded-lg border border-border bg-card p-6">
        <h2 className="mb-4 text-lg font-semibold">导出中心</h2>
        <div className="grid grid-cols-2 gap-6">
          <div>
            <h3 className="mb-2 text-sm font-medium">书源</h3>
            <div className="space-y-1">
              {BOOK_SOURCES.map((b) => (
                <label key={b.id} className="flex items-center gap-2 text-sm">
                  <input
                    type="radio"
                    name="book-source"
                    checked={bookSource === b.id}
                    onChange={() => setBookSource(b.id)}
                  />
                  {b.label}
                </label>
              ))}
            </div>
          </div>
          <div>
            <h3 className="mb-2 text-sm font-medium">格式（记住上次选择）</h3>
            <div className="grid grid-cols-2 gap-1">
              {ALL_FORMATS.map((f) => (
                <label key={f} className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    data-testid={`fmt-${f}`}
                    checked={formats.includes(f)}
                    onChange={() => toggleFormat(f)}
                  />
                  {FORMAT_LABELS[f]}
                </label>
              ))}
            </div>
          </div>
        </div>
        <div className="mt-4 flex items-center gap-3">
          <Button variant="outline" onClick={() => void pickDir()}>
            <FolderOpen /> 选择输出目录
          </Button>
          <span className="text-sm text-muted-foreground">{outputDir || '未选择（演示导出到内存）'}</span>
          <Button
            id="do-export"
            className="ml-auto"
            disabled={busy || formats.length === 0}
            onClick={() => void doExport()}
          >
            {busy ? '导出中…' : '开始导出'}
          </Button>
        </div>
        {demoNote && <p className="mt-2 text-xs text-amber-600">{demoNote}</p>}
      </section>

      {report && (
        <section data-testid="export-report" className="rounded-lg border border-border bg-card p-6">
          <h3 className="mb-3 font-semibold">
            导出报告：{report.bookTitle} · 总态 {report.status}
          </h3>
          <ul className="space-y-1 text-sm">
            {report.results.map((r) => (
              <li key={r.format} data-testid={`report-${r.format}`}>
                {r.status === 'success' ? '✅' : '❌'} {FORMAT_LABELS[r.format]} — {r.status === 'success' ? `${r.files.length} 个文件` : r.error?.message}
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="rounded-lg border border-border bg-card p-6">
        <h3 className="mb-3 font-semibold">导出历史</h3>
        {history.length === 0 ? (
          <p className="text-sm text-muted-foreground">还没有导出记录</p>
        ) : (
          <table className="w-full text-sm">
            <thead className="text-left text-xs text-muted-foreground">
              <tr>
                <th className="py-1">时间</th>
                <th>书</th>
                <th>格式</th>
                <th>结果</th>
                <th>目录</th>
              </tr>
            </thead>
            <tbody>
              {history.map((h, i) => (
                <tr key={i} className="border-t border-border">
                  <td className="py-2">{h.at.slice(0, 19).replace('T', ' ')}</td>
                  <td>{h.bookTitle}</td>
                  <td>{h.formats.join(', ')}</td>
                  <td>{h.status}</td>
                  <td>{h.outputDir}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
    </div>
  )
}
