import { Search } from 'lucide-react'
import { useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import type { ContentStore } from '@/core/store/content-store'
import type { SearchHit } from '@/core/store/types'
import { getDb } from '@/lib/db'

const TYPE_LABELS: Record<string, string> = {
  answer: '回答',
  article: '文章',
  pin: '想法',
  comment: '评论',
}

export function LibraryPage() {
  const [db, setDb] = useState<ContentStore | null>(null)
  const [query, setQuery] = useState('')
  const [error, setError] = useState('')
  const [results, setResults] = useState<SearchHit[]>([])
  const [filter, setFilter] = useState<string>('all')
  const [preview, setPreview] = useState<{ title: string; html: string } | null>(null)

  useEffect(() => {
    void getDb().then(setDb)
  }, [])

  const search = async () => {
    if (!db) return
    setError('')
    try {
      const hits = await db.searchContent(query.trim(), {
        entityTypes: filter === 'all' ? undefined : [filter],
        limit: 50,
      })
      setResults(hits)
    } catch (e) {
      setError((e as Error).message)
      setResults([])
    }
  }

  const openPreview = async (hit: SearchHit) => {
    if (!db) return
    const row =
      hit.entityType === 'answer'
        ? await db.getAnswer(hit.entityId)
        : hit.entityType === 'article'
          ? await db.getArticle(hit.entityId)
          : hit.entityType === 'pin'
            ? await db.getPin(hit.entityId)
            : await db.getComment(hit.entityId)
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
                  <button
                    className="w-full rounded border border-transparent p-3 text-left hover:border-border hover:bg-accent"
                    onClick={() => void openPreview(r)}
                  >
                    <div className="text-sm font-medium">{r.title || `${TYPE_LABELS[r.entityType]} ${r.entityId}`}</div>
                    <div className="mt-1 text-xs text-muted-foreground">{r.snippet}</div>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
        <div className="overflow-y-auto rounded-lg border border-border bg-card p-4" data-testid="preview-drawer">
          {preview ? (
            <>
              <h3 className="mb-2 font-semibold">{preview.title}</h3>
              <article
                className="prose-sm text-sm leading-relaxed"
                dangerouslySetInnerHTML={{ __html: preview.html }}
              />
            </>
          ) : (
            <p className="text-sm text-muted-foreground">点击左侧结果查看预览</p>
          )}
        </div>
      </div>
    </div>
  )
}
