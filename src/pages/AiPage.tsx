import { Sparkles } from 'lucide-react'
import { useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import { createOpenAIClient } from '@/core/ai/openai'
import { generateSummary } from '@/core/ai/summary'
import { usageStats } from '@/core/ai/usage'
import type { ContentStore } from '@/core/store/content-store'
import {
  clearAiKey,
  createMemoryAiKeyBridge,
  createTauriAiKeyBridge,
  loadAiKey,
  saveAiKey,
} from '@/lib/ai-key-store'
import { getDb } from '@/lib/db'

const BASE_KEY = 'zhivault.ai.baseUrl'
const MODEL_KEY = 'zhivault.ai.model'

interface JobRow {
  id: string
  entityType: string
  entityId: string
  kind: string
  model: string
  promptTokens: number | null
  completionTokens: number | null
  result: unknown
  createdAt: string
}

function inTauri(): boolean {
  return typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window
}

export function AiPage() {
  const [db, setDb] = useState<ContentStore | null>(null)
  const [key, setKey] = useState('')
  const [keySet, setKeySet] = useState(false)
  const [baseUrl, setBaseUrl] = useState(() => localStorage.getItem(BASE_KEY) ?? 'https://api.deepseek.com')
  const [model, setModel] = useState(() => localStorage.getItem(MODEL_KEY) ?? 'deepseek-chat')
  const [genType, setGenType] = useState<'answer' | 'article' | 'pin'>('answer')
  const [genId, setGenId] = useState('')
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')
  const [jobs, setJobs] = useState<JobRow[]>([])

  const bridge = inTauri() ? createTauriAiKeyBridge() : createMemoryAiKeyBridge()

  const refresh = async (store: ContentStore | null) => {
    if (!store) return
    setJobs((await store.listAiJobs()) as JobRow[])
  }

  useEffect(() => {
    void loadAiKey(bridge).then((k) => setKeySet(!!k))
    void getDb().then(async (d) => {
      setDb(d)
      await refresh(d)
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const stats = usageStats(jobs.map((j) => ({ model: j.model, promptTokens: j.promptTokens, completionTokens: j.completionTokens })))

  const saveKey = async () => {
    await saveAiKey(bridge, key)
    setKey('')
    setKeySet(true)
    setMessage('Key 已保存（DPAPI 加密落盘）')
  }

  const clearKey = async () => {
    await clearAiKey(bridge)
    setKeySet(false)
    setMessage('Key 已清除')
  }

  const persistPrefs = (b: string, m: string) => {
    localStorage.setItem(BASE_KEY, b)
    localStorage.setItem(MODEL_KEY, m)
  }

  const generate = async () => {
    if (!db || !genId.trim()) return
    const apiKey = await loadAiKey(bridge)
    if (!apiKey) {
      setMessage('请先配置 API Key')
      return
    }
    setBusy(true)
    setMessage('')
    try {
      const row =
        genType === 'answer'
          ? await db.getAnswer(genId.trim())
          : genType === 'article'
            ? await db.getArticle(genId.trim())
            : await db.getPin(genId.trim())
      const entity = row as { title?: string; contentHtml?: string } | undefined
      if (!entity) {
        setMessage('未找到该内容')
        return
      }
      const client = createOpenAIClient({ apiKey, baseUrl, model })
      const r = await generateSummary(client, { title: entity.title ?? genId, html: entity.contentHtml ?? '' })
      await db.saveAiJob({
        id: `job-${Date.now()}-s`,
        entityType: genType,
        entityId: genId.trim(),
        kind: 'summary',
        model,
        promptTokens: r.usage.promptTokens,
        completionTokens: r.usage.completionTokens,
        result: { summary: r.summary },
      })
      await db.saveAiJob({
        id: `job-${Date.now()}-t`,
        entityType: genType,
        entityId: genId.trim(),
        kind: 'tags',
        model,
        promptTokens: 0,
        completionTokens: 0,
        result: { tags: r.tags },
      })
      setMessage(`已生成：${r.summary.slice(0, 40)}… · 标签 ${r.tags.join('、') || '无'}`)
      await refresh(db)
    } catch (e) {
      setMessage((e as Error).message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="flex h-full flex-col gap-6 overflow-y-auto p-8">
      <section className="rounded-lg border border-border bg-card p-6">
        <h2 className="mb-4 flex items-center gap-2 text-lg font-semibold">
          <Sparkles /> AI 中心
        </h2>
        <div className="grid grid-cols-2 gap-3">
          <label className="text-sm">
            API Key（DPAPI 加密存储）
            <input
              id="ai-key"
              type="password"
              value={key}
              onChange={(e) => setKey(e.target.value)}
              placeholder={keySet ? '已配置（输入以更换）' : 'sk-…'}
              className="mt-1 w-full rounded-lg border border-input bg-background px-3 py-2 font-mono text-sm"
            />
          </label>
          <label className="text-sm">
            模型
            <input
              id="ai-model"
              value={model}
              onChange={(e) => {
                setModel(e.target.value)
                persistPrefs(baseUrl, e.target.value)
              }}
              className="mt-1 w-full rounded-lg border border-input bg-background px-3 py-2 font-mono text-sm"
            />
          </label>
          <label className="col-span-2 text-sm">
            OpenAI 兼容端点（自定义后其域名加入 SSRF 放行，仅用户显式配置）
            <input
              id="ai-base"
              value={baseUrl}
              onChange={(e) => {
                setBaseUrl(e.target.value)
                persistPrefs(e.target.value, model)
              }}
              className="mt-1 w-full rounded-lg border border-input bg-background px-3 py-2 font-mono text-sm"
            />
          </label>
        </div>
        <div className="mt-3 flex gap-2">
          <Button id="ai-save-key" disabled={!key.trim()} onClick={() => void saveKey()}>
            保存 Key
          </Button>
          <Button variant="outline" disabled={!keySet} onClick={() => void clearKey()}>
            清除 Key
          </Button>
          <span className="self-center text-xs text-muted-foreground">{message}</span>
        </div>
      </section>

      <section className="rounded-lg border border-border bg-card p-6">
        <h3 className="mb-3 font-semibold">生成摘要与标签</h3>
        <div className="flex gap-2">
          <select
            id="ai-gen-type"
            value={genType}
            onChange={(e) => setGenType(e.target.value as typeof genType)}
            className="rounded-lg border border-input bg-background px-3 py-2 text-sm"
          >
            <option value="answer">回答</option>
            <option value="article">文章</option>
            <option value="pin">想法</option>
          </select>
          <input
            id="ai-gen-id"
            value={genId}
            onChange={(e) => setGenId(e.target.value)}
            placeholder="实体 ID"
            className="flex-1 rounded-lg border border-input bg-background px-3 py-2 font-mono text-sm"
          />
          <Button id="ai-generate" disabled={busy || !genId.trim() || !keySet} onClick={() => void generate()}>
            {busy ? '生成中…' : '生成'}
          </Button>
        </div>
      </section>

      <section className="grid grid-cols-4 gap-3">
        {(
          [
            ['调用次数', stats.jobs],
            ['Prompt Tokens', stats.promptTokens],
            ['Completion Tokens', stats.completionTokens],
            ['模型数', Object.keys(stats.byModel).length],
          ] as const
        ).map(([label, n]) => (
          <div key={label} className="rounded-lg border border-border bg-card p-4 text-center">
            <div className="text-2xl font-bold">{n}</div>
            <div className="text-xs text-muted-foreground">{label}</div>
          </div>
        ))}
      </section>

      <section className="rounded-lg border border-border bg-card p-6">
        <div className="mb-3 flex items-center justify-between">
          <h3 className="font-semibold">生成记录（可回溯可导出）</h3>
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              const url = URL.createObjectURL(new Blob([JSON.stringify(jobs, null, 2)], { type: 'application/json' }))
              const a = document.createElement('a')
              a.href = url
              a.download = `zhivault-ai-jobs-${new Date().toISOString().slice(0, 10)}.json`
              a.click()
              URL.revokeObjectURL(url)
            }}
          >
            导出 JSON
          </Button>
        </div>
        {jobs.length === 0 ? (
          <p className="text-sm text-muted-foreground">暂无生成记录</p>
        ) : (
          <table className="w-full text-sm" data-testid="ai-jobs">
            <thead className="text-left text-xs text-muted-foreground">
              <tr>
                <th>时间</th>
                <th>实体</th>
                <th>类型</th>
                <th>模型</th>
                <th>Tokens</th>
                <th>结果</th>
              </tr>
            </thead>
            <tbody>
              {jobs.map((j) => (
                <tr key={j.id} className="border-t border-border">
                  <td className="py-2">{j.createdAt.slice(0, 19).replace('T', ' ')}</td>
                  <td className="font-mono text-xs">
                    {j.entityType}/{j.entityId}
                  </td>
                  <td>{j.kind === 'summary' ? '摘要' : '标签'}</td>
                  <td className="font-mono text-xs">{j.model}</td>
                  <td className="font-mono text-xs">
                    {j.promptTokens ?? '-'}/{j.completionTokens ?? '-'}
                  </td>
                  <td className="max-w-64 truncate text-xs">{JSON.stringify(j.result)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
    </div>
  )
}
