import { CirclePlay, FileUp, Plus, Search, X } from 'lucide-react'
import { useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { runStore } from '@/lib/app-store'
import { parseZhihuUrl, type EntityType } from '@/core/zhihu/url-parser'

const TYPE_LABELS: Record<EntityType, string> = {
  answer: '回答',
  article: '文章',
  pin: '想法',
  question: '问题',
  collection: '收藏夹',
  column: '专栏',
  topic: '话题',
  user: '用户',
}

export function TasksPage() {
  const navigate = useNavigate()
  const [input, setInput] = useState('')
  const [error, setError] = useState('')
  const [tick, setTick] = useState(0)
  const fileRef = useRef<HTMLInputElement>(null)
  void tick

  const recognized = useMemo(() => {
    if (!input.trim()) return null
    try {
      return parseZhihuUrl(input.trim())
    } catch {
      return null
    }
  }, [input])

  const refresh = () => setTick((t) => t + 1)

  const add = () => {
    const r = runStore.addTask(input.trim())
    if (r.ok) {
      setInput('')
      setError('')
    } else {
      setError(r.error ?? '无法添加')
    }
    refresh()
  }

  const importFile = async (file: File) => {
    const text = await file.text()
    let n = 0
    for (const line of text.split(/\r?\n/)) {
      const url = line.trim()
      if (url && runStore.addTask(url).ok) n++
    }
    setError(n > 0 ? `已从文件导入 ${n} 个任务` : '文件中没有可识别的任务链接')
    refresh()
  }

  const tasks = runStore.state.tasks

  return (
    <div className="relative flex h-full flex-col gap-6 p-8">
      <section>
        <h2 className="mb-3 text-lg font-semibold">粘贴知乎链接，开始采集</h2>
        <div className="flex gap-2">
          <input
            id="url-input"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && recognized && add()}
            placeholder="https://www.zhihu.com/question/…/answer/… 或专栏/收藏夹/话题/用户主页"
            className="w-full rounded-lg border border-input bg-background px-4 py-2 text-sm outline-none focus:ring-1 focus:ring-ring"
          />
          <Button variant="outline" onClick={() => fileRef.current?.click()} title="从文件导入链接">
            <FileUp />
          </Button>
          <input
            ref={fileRef}
            type="file"
            accept=".txt,.csv"
            className="hidden"
            data-testid="file-import"
            onChange={(e) => {
              const f = e.target.files?.[0]
              if (f) void importFile(f)
              e.target.value = ''
            }}
          />
          <Button id="add-task" disabled={!recognized} onClick={add}>
            <Plus /> 添加任务
          </Button>
        </div>
        <div className="mt-2 flex min-h-6 items-center gap-2 text-sm">
          {recognized && (
            <span
              data-testid="type-chip"
              className="rounded-full bg-primary/10 px-3 py-1 text-primary"
            >
              识别为：{TYPE_LABELS[recognized.type]}
            </span>
          )}
          {input.trim() && !recognized && <span className="text-destructive">无法识别的链接</span>}
          {error && <span className="text-muted-foreground">{error}</span>}
        </div>
        <button
          disabled
          className="mt-2 flex items-center gap-2 rounded-lg border border-dashed border-border px-4 py-2 text-sm text-muted-foreground"
          title="P1 任务提供"
        >
          <Search className="h-4 w-4" /> 关键词搜索采集（P1 提供）
        </button>
      </section>

      <section className="flex-1">
        <h2 className="mb-3 text-lg font-semibold">任务列表</h2>
        {tasks.length === 0 ? (
          <p className="rounded-lg border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
            还没有任务。粘贴链接或文件导入，可批量添加多个用户/收藏夹。
          </p>
        ) : (
          <ul className="space-y-2">
            {tasks.map((t) => (
              <li
                key={t.id}
                data-testid="task-card"
                className="flex items-center gap-3 rounded-lg border border-border bg-card px-4 py-3"
              >
                <span className="rounded bg-primary/10 px-2 py-0.5 text-xs text-primary">{t.typeLabel}</span>
                <span className="min-w-0 flex-1 truncate font-mono text-xs text-muted-foreground">{t.url}</span>
                <span className="text-xs text-muted-foreground">
                  {t.status === 'done'
                    ? `新增 ${t.stats.created} · 更新 ${t.stats.updated}`
                    : t.status === 'failed'
                      ? '失败'
                      : t.status === 'running'
                        ? '运行中'
                        : '待运行'}
                </span>
                <Button variant="ghost" size="icon" onClick={() => (runStore.removeTask(t.id), refresh())}>
                  <X className="h-4 w-4" />
                </Button>
              </li>
            ))}
          </ul>
        )}
      </section>

      {tasks.length > 0 && (
        <Button
          id="goto-run"
          size="lg"
          className="fixed bottom-8 right-8 gap-2 shadow-lg"
          onClick={() => navigate('/run')}
        >
          <CirclePlay /> 开始运行
        </Button>
      )}
    </div>
  )
}
