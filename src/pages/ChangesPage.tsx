import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import type { ContentStore } from '@/core/store/content-store'
import type { RevisionRow } from '@/core/store/types'
import { getDb } from '@/lib/db'

interface RunRow {
  id: string
  source: string
  startedAt: string
  finishedAt: string | null
  totals: { fetched: number; created: number; updated: number; unchanged: number; failed: number }
}

const TYPE_LABELS: Record<string, string> = {
  answer: '回答',
  article: '文章',
  pin: '想法',
  question: '问题',
  comment: '评论',
}

/** 变更报告页（PRD §6.2 页 7）：每次运行一行，展开看变更清单直达 diff */
export function ChangesPage() {
  const [db, setDb] = useState<ContentStore | null>(null)
  const [rows, setRows] = useState<RunRow[]>([])
  const [expanded, setExpanded] = useState<string | null>(null)
  const [detail, setDetail] = useState<RevisionRow[]>([])

  useEffect(() => {
    void getDb().then(async (d) => {
      setDb(d)
      if (d) setRows((await d.listRunRecords()) as RunRow[])
    })
  }, [])

  const toggle = async (row: RunRow) => {
    if (!db) return
    if (expanded === row.id) {
      setExpanded(null)
      return
    }
    setExpanded(row.id)
    setDetail(
      row.finishedAt
        ? await db.listRevisionsBetween(row.startedAt, row.finishedAt)
        : [],
    )
  }

  if (!db) {
    return (
      <div className="flex h-full items-center justify-center p-8 text-center text-sm text-muted-foreground">
        变更报告需要在知藏应用内打开（运行记录存于便携库）。
      </div>
    )
  }

  return (
    <div className="flex h-full flex-col gap-4 overflow-y-auto p-8">
      <h2 className="text-lg font-semibold">变更报告</h2>
      {rows.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          暂无运行记录。运行采集任务或监控计划后，这里会显示每次的更新/修改/删除计数与变更清单。
        </p>
      ) : (
        <table className="w-full text-sm" data-testid="changes-table">
          <thead className="text-left text-xs text-muted-foreground">
            <tr>
              <th className="py-1"></th>
              <th>时间</th>
              <th>来源</th>
              <th>已抓</th>
              <th>新增</th>
              <th>修改</th>
              <th>未变</th>
              <th>失败</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <>
                <tr key={row.id} className="cursor-pointer border-t border-border" onClick={() => void toggle(row)}>
                  <td className="py-2">{expanded === row.id ? '▾' : '▸'}</td>
                  <td>{row.startedAt.slice(0, 19).replace('T', ' ')}</td>
                  <td>{row.source === 'monitor' ? '监控' : '手动'}</td>
                  <td>{row.totals.fetched}</td>
                  <td className="text-emerald-600">{row.totals.created}</td>
                  <td className="text-amber-600">{row.totals.updated}</td>
                  <td>{row.totals.unchanged}</td>
                  <td className={row.totals.failed > 0 ? 'text-rose-600' : ''}>{row.totals.failed}</td>
                </tr>
                {expanded === row.id && (
                  <tr key={`${row.id}-detail`} className="border-t border-border bg-muted/40">
                    <td></td>
                    <td colSpan={7} className="py-2">
                      {detail.length === 0 ? (
                        <span className="text-xs text-muted-foreground">本次运行无内容修订</span>
                      ) : (
                        <ul className="space-y-1 text-xs">
                          {detail.map((r) => (
                            <li key={`${r.entityType}-${r.entityId}-${r.revisionNo}`}>
                              <Link
                                className="text-primary underline-offset-2 hover:underline"
                                to={`/reader/${r.entityType}/${r.entityId}`}
                              >
                                {TYPE_LABELS[r.entityType] ?? r.entityType} {r.entityId}
                              </Link>{' '}
                              → v{r.revisionNo}（{r.capturedAt.slice(0, 19).replace('T', ' ')}）
                            </li>
                          ))}
                        </ul>
                      )}
                    </td>
                  </tr>
                )}
              </>
            ))}
          </tbody>
        </table>
      )}
    </div>
  )
}
