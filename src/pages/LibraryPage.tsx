import { Search } from 'lucide-react'
import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import type { ContentStore } from '@/core/store/content-store'
import type { SearchHit } from '@/core/store/types'
import { extractTerms, highlightText } from '@/core/search/highlight'
import { getDb } from '@/lib/db'
import { buildReaderPreviewDoc } from '@/lib/reader-preview'

const TYPE_LABELS: Record<string, string> = {
  answer: '回答',
  article: '文章',
  pin: '想法',
  comment: '评论',
}

async function fetchEntity(db: ContentStore, hit: SearchHit): Promise<unknown> {
  if (hit.entityType === 'answer') return db.getAnswer(hit.entityId)
  if (hit.entityType === 'article') return db.getArticle(hit.entityId)
  if (hit.entityType === 'pin') return db.getPin(hit.entityId)
  return db.getComment(hit.entityId)
}

export function LibraryPage() {
  const [db, setDb] = useState<ContentStore | null>(null)
  const [query, setQuery] = useState('')
  const [error, setError] = useState('')
  const [results, setResults] = useState<SearchHit[]>([])
  const [filter, setFilter] = useState<string>('all')
  const [timeFrom, setTimeFrom] = useState('')
  const [timeTo, setTimeTo] = useState('')
  const [preview, setPreview] = useState<{ title: string; html: string } | null>(null)

  useEffect(() => {
    void getDb().then(setDb)
  }, [])

  const search = async () => {
    if (!db) return
    setError('')
    try {
      let hits = await db.searchContent(query.trim(), {
        entityTypes: filter === 'all' ? undefined : [filter],
        limit: 50,
      })
      // 时间范围组合筛选（PRD §6.2 页 4）
      if (timeFrom || timeTo) {
        const createdAts = await Promise.all(
          hits.map(async (h) => {
            const row = await fetchEntity(db, h)
            return (row as { createdAt?: string } | undefined)?.createdAt
          }),
        )
        hits = hits.filter((_, i) => {
          const t = createdAts[i] ? Date.parse(createdAts[i]!) : null
          if (t === null) return false
          if (timeFrom && t < Date.parse(timeFrom)) return false
          if (timeTo && t > Date.parse(timeTo) + 24 * 3600 * 1000 - 1) return false
          return true
        })
      }
      setResults(hits)
    } catch (e) {
      setError((e as Error).message)
      setResults([])
    }
  }

  const openPreview = async (hit: SearchHit) => {
    if (!db) return
    const row = await fetchEntity(db, hit)
    const html = (row as { contentHtml?: string } | undefined)?.contentHtml
    setPreview({ title: hit.title || `${TYPE_LABELS[hit.entityType]} ${hit.entityId}`, html: html ?? hit.snippet })
  }

  if (!db) {
    return (
      <div className="flex h-full items-center justify-center p-8 text-center text-sm text-muted-foreground">
        书架需要在知藏应用内打开（便携 SQLite 由壳提供）。当前环境：演示/浏览器模式。
      </div>
    )
  }

  return (
    <div className="flex h-full flex-col gap-4 p-8">
      <div className="flex gap-2">
        <input
          id="search-input"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && search()}
          placeholder="全文检索（中文 ≥3 字，trigram 分词）"
          className="w-full rounded-lg border border-input bg-background px-4 py-2 text-sm outline-none focus:ring-1 focus:ring-ring"
        />
        <Button id="search-btn" onClick={() => void search()}>
          <Search /> 检索
        </Button>
        <select
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          className="rounded-lg border border-input bg-background px-3 text-sm"
        >
          <option value="all">全部类型</option>
          <option value="answer">回答</option>
          <option value="article">文章</option>
          <option value="pin">想法</option>
          <option value="comment">评论</option>
        </select>
        <input
          type="date"
          value={timeFrom}
          onChange={(e) => setTimeFrom(e.target.value)}
          title="创建时间起于"
          className="rounded-lg border border-input bg-background px-3 text-sm"
        />
        <input
          type="date"
          value={timeTo}
          onChange={(e) => setTimeTo(e.target.value)}
          title="创建时间止于"
          className="rounded-lg border border-input bg-background px-3 text-sm"
        />
      </div>
      {error && <p className="text-sm text-destructive">{error}</p>}

      <div className="grid min-h-0 flex-1 grid-cols-[1fr_360px] gap-4">
        <div className="overflow-y-auto rounded-lg border border-border bg-card p-4" data-testid="search-results">
          {results.length === 0 ? (
            <p className="text-sm text-muted-foreground">无结果。输入关键词开始检索（时间范围等组合筛选 P1 提供）。</p>
          ) : (
            <ul className="space-y-2">
              {results.map((r) => (
                <li key={`${r.entityType}-${r.entityId}`}>
                  <div
                    className="w-full cursor-pointer rounded border border-transparent p-3 hover:border-border hover:bg-accent"
                    onClick={() => void openPreview(r)}
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium">
                        {r.title || `${TYPE_LABELS[r.entityType]} ${r.entityId}`}
                      </span>
                      <Link
                        className="text-xs text-primary underline-offset-2 hover:underline"
                        to={`/reader/${r.entityType}/${r.entityId}`}
                        onClick={(e) => e.stopPropagation()}
                      >
                        打开阅读
                      </Link>
                    </div>
                    {/* highlightText 输出为转义后文本+mark 标签，可安全内联 */}
                    <div
                      className="mt-1 text-xs text-muted-foreground"
                      dangerouslySetInnerHTML={{ __html: highlightText(r.snippet, extractTerms(query.trim())) }}
                    />
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
        <div className="overflow-hidden rounded-lg border border-border bg-card" data-testid="preview-drawer">
          {preview ? (
            <>
              <h3 className="border-b border-border p-4 font-semibold">{preview.title}</h3>
              {/* sandbox iframe（无脚本）渲染，正文经导出级清洗（PRD §8-4） */}
              <iframe
                title="内容预览"
                sandbox=""
                className="h-full w-full bg-background"
                srcDoc={buildReaderPreviewDoc(preview.title, preview.html)}
              />
            </>
          ) : (
            <p className="p-4 text-sm text-muted-foreground">点击左侧结果查看预览</p>
          )}
        </div>
      </div>
    </div>
  )
}
