import { Play, Trash2 } from 'lucide-react'
import { useCallback, useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import type { ContentStore } from '@/core/store/content-store'
import { nextRun, type ScheduleSpec } from '@/core/task/scheduler'
import { getDb } from '@/lib/db'
import { runStore } from '@/lib/app-store'

interface ScheduleRow {
  id: string
  name: string
  spec: unknown
  enabled: boolean
  lastRunAt: string | null
}

export function MonitorPage() {
  const navigate = useNavigate()
  const [db, setDb] = useState<ContentStore | null>(null)
  const [rows, setRows] = useState<ScheduleRow[]>([])
  const [name, setName] = useState('')
  const [urls, setUrls] = useState('')
  const [preset, setPreset] = useState<'daily' | 'weekly' | 'monthly' | 'cron' | 'interval'>('daily')
  const [cron, setCron] = useState('0 3 * * *')
  const [intervalMin, setIntervalMin] = useState(60)
  const [windowFrom, setWindowFrom] = useState('')
  const [windowTo, setWindowTo] = useState('')
  const [catchUp, setCatchUp] = useState<'on_start' | 'skip'>('skip')

  const refresh = useCallback(async (store: ContentStore | null) => {
    if (!store) return
    setRows(await store.listSchedules())
  }, [])

  useEffect(() => {
    void getDb().then(async (d) => {
      setDb(d)
      await refresh(d)
    })
  }, [refresh])

  const add = async () => {
    if (!db || !name.trim() || !urls.trim()) return
    const id = `sched-${Date.now()}`
    const spec: ScheduleSpec = {
      id,
      name: name.trim(),
      catchUp,
      enabled: true,
      urls: urls.split(/\r?\n/).map((s) => s.trim()).filter(Boolean),
      ...(preset === 'cron' ? { cron } : {}),
      ...(preset === 'interval' ? { intervalMin } : {}),
      ...(preset === 'daily' || preset === 'weekly' || preset === 'monthly' ? { preset } : {}),
      ...(windowFrom && windowTo ? { window: { from: windowFrom, to: windowTo } } : {}),
    }
    await db.saveSchedule({ id, name: name.trim(), spec, enabled: true })
    setName('')
    setUrls('')
    await refresh(db)
  }

  const runNow = (row: ScheduleRow) => {
    const spec = row.spec as ScheduleSpec
    for (const url of spec.urls ?? []) runStore.addTask(url)
    if (runStore.state.tasks.length > 0) void runStore.start()
    navigate('/run')
  }

  if (!db) {
    return (
      <div className="flex h-full items-center justify-center p-8 text-center text-sm text-muted-foreground">
        监控计划需要在知藏应用内打开（调度持久化于便携库）。当前环境：演示/浏览器模式。
      </div>
    )
  }

  return (
    <div className="flex h-full flex-col gap-6 overflow-y-auto p-8">
      <section className="rounded-lg border border-border bg-card p-6">
        <h2 className="mb-4 text-lg font-semibold">新建监控计划</h2>
        <div className="grid grid-cols-2 gap-3">
          <input
            id="sched-name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="名称，如：每日增量备份"
            className="rounded-lg border border-input bg-background px-3 py-2 text-sm outline-none focus:ring-1 focus:ring-ring"
          />
          <select
            id="sched-preset"
            value={preset}
            onChange={(e) => setPreset(e.target.value as typeof preset)}
            className="rounded-lg border border-input bg-background px-3 py-2 text-sm"
          >
            <option value="daily">每天 03:00</option>
            <option value="weekly">每周一 03:00</option>
            <option value="monthly">每月 1 日 03:00</option>
            <option value="cron">自定义 cron</option>
            <option value="interval">自定义间隔</option>
          </select>
          {preset === 'cron' && (
            <input
              id="sched-cron"
              value={cron}
              onChange={(e) => setCron(e.target.value)}
              placeholder="分 时 日 月 周，如 0 3 * * *"
              className="rounded-lg border border-input bg-background px-3 py-2 font-mono text-sm"
            />
          )}
          {preset === 'interval' && (
            <input
              id="sched-interval"
              type="number"
              min={1}
              value={intervalMin}
              onChange={(e) => setIntervalMin(Number(e.target.value))}
              className="rounded-lg border border-input bg-background px-3 py-2 text-sm"
            />
          )}
          <input
            value={windowFrom}
            onChange={(e) => setWindowFrom(e.target.value)}
            placeholder="运行开始 HH:MM（可空）"
            className="rounded-lg border border-input bg-background px-3 py-2 text-sm"
          />
          <input
            value={windowTo}
            onChange={(e) => setWindowTo(e.target.value)}
            placeholder="运行结束 HH:MM（可空）"
            className="rounded-lg border border-input bg-background px-3 py-2 text-sm"
          />
          <select
            value={catchUp}
            onChange={(e) => setCatchUp(e.target.value as typeof catchUp)}
            className="rounded-lg border border-input bg-background px-3 py-2 text-sm"
          >
            <option value="skip">错过跳过</option>
            <option value="on_start">启动补跑</option>
          </select>
        </div>
        <textarea
          id="sched-urls"
          value={urls}
          onChange={(e) => setUrls(e.target.value)}
          rows={3}
          placeholder="监控目标 URL，每行一个（任务 URL）"
          className="mt-3 w-full rounded-lg border border-input bg-background px-3 py-2 font-mono text-xs outline-none focus:ring-1 focus:ring-ring"
        />
        <Button id="sched-add" className="mt-3" disabled={!name.trim() || !urls.trim()} onClick={() => void add()}>
          保存计划
        </Button>
      </section>

      <section className="rounded-lg border border-border bg-card p-6">
        <h2 className="mb-4 text-lg font-semibold">计划列表</h2>
        {rows.length === 0 ? (
          <p className="text-sm text-muted-foreground">暂无计划。到点自动增量，命中更新系统通知。</p>
        ) : (
          <table className="w-full text-sm" data-testid="sched-table">
            <thead className="text-left text-xs text-muted-foreground">
              <tr>
                <th className="py-1">启用</th>
                <th>名称</th>
                <th>计划</th>
                <th>下次运行</th>
                <th>上次运行</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => {
                const spec = row.spec as ScheduleSpec
                const next = spec.enabled ? nextRun({ ...spec, lastRunAt: row.lastRunAt }, new Date()) : null
                return (
                  <tr key={row.id} className="border-t border-border">
                    <td className="py-2">
                      <input
                        type="checkbox"
                        checked={row.enabled}
                        onChange={async (e) => {
                          await db.setScheduleEnabled(row.id, e.target.checked)
                          await refresh(db)
                        }}
                      />
                    </td>
                    <td>{row.name}</td>
                    <td className="font-mono text-xs">
                      {spec.cron ?? spec.preset ?? (spec.intervalMin ? `每 ${spec.intervalMin} 分钟` : '-')}
                      {spec.window ? `（${spec.window.from}-${spec.window.to}）` : ''}
                    </td>
                    <td>{next ? next.toLocaleString() : '-'}</td>
                    <td>{row.lastRunAt ? new Date(row.lastRunAt).toLocaleString() : '从未'}</td>
                    <td className="text-right">
                      <Button size="sm" variant="outline" onClick={() => runNow(row)}>
                        <Play /> 立即运行
                      </Button>{' '}
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={async () => {
                          await db.deleteSchedule(row.id)
                          await refresh(db)
                        }}
                      >
                        <Trash2 />
                      </Button>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        )}
      </section>
    </div>
  )
}
