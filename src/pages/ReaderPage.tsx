import { GitCompareArrows } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { useParams } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import type { ContentStore } from '@/core/store/content-store'
import type { AnnotationRow, RevisionRow } from '@/core/store/types'
import { locateAnchor } from '@/core/reader/anchor'
import { diffBlocks } from '@/core/reader/diff'
import { getDb } from '@/lib/db'
import { buildReaderInteractiveDoc } from '@/lib/reader-preview'

type EntityType = 'answer' | 'article' | 'pin' | 'comment' | 'question'

interface EntityDoc {
  title: string
  html: string
}

const COLORS = ['yellow', 'emerald', 'blue', 'rose'] as const

async function loadEntity(db: ContentStore, type: EntityType, id: string): Promise<EntityDoc | null> {
  const asDoc = (row: unknown, fallback: string): EntityDoc | null => {
    const r = row as { title?: unknown; contentHtml?: unknown } | undefined
    if (!r) return null
    return {
      title: typeof r.title === 'string' ? r.title : fallback,
      html: typeof r.contentHtml === 'string' ? r.contentHtml : '',
    }
  }
  if (type === 'answer') return asDoc(await db.getAnswer(id), `回答 ${id}`)
  if (type === 'article') return asDoc(await db.getArticle(id), `文章 ${id}`)
  if (type === 'pin') return asDoc(await db.getPin(id), `想法 ${id}`)
  if (type === 'comment') return asDoc(await db.getComment(id), `评论 ${id}`)
  return asDoc(await db.getQuestion(id), `问题 ${id}`)
}

export function ReaderPage() {
  const { type = 'answer', id = '' } = useParams<{ type: EntityType; id: string }>()
  const [db, setDb] = useState<ContentStore | null>(null)
  const [doc, setDoc] = useState<EntityDoc | null>(null)
  const [annotations, setAnnotations] = useState<AnnotationRow[]>([])
  const [revisions, setRevisions] = useState<RevisionRow[]>([])
  const [tab, setTab] = useState<'annotations' | 'versions'>('annotations')
  const [selection, setSelection] = useState('')
  const [note, setNote] = useState('')
  const [color, setColor] = useState<(typeof COLORS)[number]>('yellow')
  const [selected, setSelected] = useState<number[]>([])

  useEffect(() => {
    void getDb().then(setDb)
  }, [])

  useEffect(() => {
    if (!db) return
    void (async () => {
      const d = await loadEntity(db, type, id)
      setDoc(d)
      setAnnotations(await db.listAnnotations(type, id))
      setRevisions(await db.getRevisions(type, id))
    })()
  }, [db, type, id])

  // 划词选择桥（iframe 内受信脚本 postMessage；opaque origin 隔离）
  useEffect(() => {
    const onMessage = (e: MessageEvent) => {
      const data = e.data as { type?: string; text?: string } | null
      if (data?.type === 'zhivault:selection' && typeof data.text === 'string') {
        setSelection(data.text.slice(0, 2000))
      }
    }
    window.addEventListener('message', onMessage)
    return () => window.removeEventListener('message', onMessage)
  }, [])

  const diff = useMemo(() => {
    if (selected.length !== 2) return null
    const [a, b] = [...selected].sort((x, y) => x - y).map((i) => revisions[i])
    if (!a || !b) return null
    return diffBlocks(a.contentHtml, b.contentHtml)
  }, [selected, revisions])

  if (!db) {
    return (
      <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
        阅读器需要在知藏应用内打开。
      </div>
    )
  }
  if (!doc) {
    return (
      <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
        未找到该内容（{type}/{id}）
      </div>
    )
  }

  const saveAnnotation = async () => {
    if (!db || !selection.trim()) return
    await db.saveAnnotation({ entityType: type, entityId: id, selectedText: selection, note: note || undefined, color })
    setAnnotations(await db.listAnnotations(type, id))
    setSelection('')
    setNote('')
  }

  return (
    <div className="grid h-full grid-cols-[1fr_340px]">
      <div className="flex min-h-0 flex-col">
        <div className="border-b border-border px-6 py-3">
          <h2 className="font-semibold">{doc.title}</h2>
          <p className="text-xs text-muted-foreground">
            {type}/{id} · 选中文本即可添加标注
          </p>
        </div>
        <iframe
          title="阅读器"
          sandbox="allow-scripts"
          data-testid="reader-frame"
          className="min-h-0 flex-1 bg-background"
          srcDoc={buildReaderInteractiveDoc(doc.title, doc.html)}
        />
        {selection && (
          <div data-testid="annotation-bubble" className="flex items-center gap-2 border-t border-border bg-card px-4 py-2">
            <span className="max-w-md truncate text-xs text-muted-foreground">「{selection.slice(0, 40)}…」</span>
            {COLORS.map((c) => (
              <button
                key={c}
                aria-label={c}
                onClick={() => setColor(c)}
                className={`h-5 w-5 rounded-full border-2 ${color === c ? 'border-foreground' : 'border-transparent'} bg-${c}-400`}
                style={{
                  backgroundColor:
                    c === 'yellow' ? '#facc15' : c === 'emerald' ? '#34d399' : c === 'blue' ? '#60a5fa' : '#fb7185',
                }}
              />
            ))}
            <input
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="批注（可空）"
              className="flex-1 rounded border border-input bg-background px-2 py-1 text-xs"
            />
            <Button size="sm" onClick={() => void saveAnnotation()}>
              保存标注
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setSelection('')}>
              取消
            </Button>
          </div>
        )}
      </div>

      <aside className="flex min-h-0 flex-col border-l border-border">
        <div className="flex border-b border-border">
          {(
            [
              ['annotations', '标注'],
              ['versions', '版本时间线'],
            ] as const
          ).map(([k, label]) => (
            <button
              key={k}
              data-testid={`tab-${k}`}
              onClick={() => setTab(k)}
              className={`flex-1 py-2 text-sm ${tab === k ? 'border-b-2 border-primary font-medium' : 'text-muted-foreground'}`}
            >
              {label}
            </button>
          ))}
        </div>

        {tab === 'annotations' ? (
          <div className="min-h-0 flex-1 space-y-2 overflow-y-auto p-4" data-testid="annotation-list">
            {annotations.length === 0 ? (
              <p className="text-sm text-muted-foreground">暂无标注。在正文中划词即可添加。</p>
            ) : (
              annotations.map((a) => {
                const loc = locateAnchor(doc.html, a.anchorPrefix, a.anchorSuffix)
                return (
                  <div key={a.id} className="rounded border border-border p-3 text-sm">
                    <div className="text-xs text-muted-foreground">
                      [{a.color}] {loc.status === 'exact' ? '锚定命中' : loc.status === 'paragraph' ? '段落级降级' : '内容已被大幅修改'}
                    </div>
                    <blockquote className="mt-1 border-l-2 border-primary/40 pl-2">{a.selectedText.slice(0, 80)}</blockquote>
                    {a.note && <p className="mt-1 text-xs">批注：{a.note}</p>}
                    {loc.message && <p className="mt-1 text-xs text-amber-600">{loc.message}</p>}
                    <Button
                      size="sm"
                      variant="ghost"
                      className="mt-1 h-6 px-2 text-xs"
                      onClick={async () => {
                        await db.deleteAnnotation(a.id)
                        setAnnotations(await db.listAnnotations(type, id))
                      }}
                    >
                      删除
                    </Button>
                  </div>
                )
              })
            )}
          </div>
        ) : (
          <div className="flex min-h-0 flex-1 flex-col">
            <div className="min-h-0 flex-1 space-y-1 overflow-y-auto p-4" data-testid="revision-timeline">
              <p className="mb-2 text-xs text-muted-foreground">勾选任意两个版本查看并排 diff</p>
              {revisions.map((r, i) => (
                <label key={r.revisionNo} className="flex items-center gap-2 rounded border border-border px-3 py-2 text-sm">
                  <input
                    type="checkbox"
                    checked={selected.includes(i)}
                    onChange={(e) => {
                      setSelected((prev) => {
                        const next = e.target.checked ? [...prev, i] : prev.filter((x) => x !== i)
                        return next.slice(-2)
                      })
                    }}
                  />
                  v{r.revisionNo} · {r.capturedAt.slice(0, 19).replace('T', ' ')}
                </label>
              ))}
              {revisions.length === 0 && <p className="text-sm text-muted-foreground">暂无版本记录</p>}
            </div>
            {diff && (
              <div className="max-h-[45%] overflow-auto border-t border-border p-4" data-testid="diff-view">
                <div className="mb-2 flex items-center gap-2 text-xs text-muted-foreground">
                  <GitCompareArrows className="h-4 w-4" /> 并排 diff（左：旧 右：新）
                </div>
                <div className="grid grid-cols-2 gap-2 font-mono text-xs">
                  <div>
                    {diff.filter((d) => d.type !== 'add').map((d, i) => (
                      <div key={i} className={d.type === 'del' ? 'bg-rose-100 text-rose-800 line-through' : ''}>
                        {d.text.replace(/<[^>]+>/g, '')}
                      </div>
                    ))}
                  </div>
                  <div>
                    {diff.filter((d) => d.type !== 'del').map((d, i) => (
                      <div key={i} className={d.type === 'add' ? 'bg-emerald-100 text-emerald-800' : ''}>
                        {d.text.replace(/<[^>]+>/g, '')}
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </aside>
    </div>
  )
}
