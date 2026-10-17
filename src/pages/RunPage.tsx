import { Pause, Play, Square } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { Button } from '@/components/ui/button'
import { DEFAULT_RATE_PER_SECOND } from '@/core/fetch/rate-limiter'
import { runStore } from '@/lib/app-store'

export function RunPage() {
  const [, setTick] = useState(0)
  const logRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const unsub = runStore.subscribe(() => setTick((t) => t + 1))
    return unsub
  }, [])

  useEffect(() => {
    logRef.current?.scrollTo({ top: logRef.current.scrollHeight })
  })

  const s = runStore.state
  const limit = DEFAULT_RATE_PER_SECOND
  const gaugePct = Math.min(100, Math.round((s.currentRate / limit) * 100))

  return (
    <div className="flex h-full flex-col gap-6 p-8">
      <div className="grid grid-cols-2 gap-6">
        <section className="rounded-lg border border-border bg-card p-6">
          <h2 className="mb-4 text-lg font-semibold">采集速度</h2>
          <div className="mb-2 flex items-end gap-2">
            <span className="text-4xl font-bold" data-testid="current-rate">
              {s.currentRate.toFixed(1)}
            </span>
            <span className="pb-1 text-sm text-muted-foreground">req/s · 限速档位 {limit} req/s</span>
          </div>
          <div className="relative h-3 overflow-hidden rounded bg-muted">
            <div className="h-full bg-primary transition-all" style={{ width: `${gaugePct}%` }} />
            <div className="absolute inset-y-0 w-0.5 bg-destructive" style={{ left: '100%' }} />
          </div>
          <p className="mt-2 text-xs text-muted-foreground">
            触发风控或 429 时自动退避至 0.2 req/s 并在此提示
          </p>
        </section>

        <section className="rounded-lg border border-border bg-card p-6">
          <h2 className="mb-4 text-lg font-semibold">计数器</h2>
          <div className="grid grid-cols-5 gap-2 text-center" data-testid="counters">
            {(
              [
                ['已抓', s.totals.fetched],
                ['新增', s.totals.created],
                ['更新', s.totals.updated],
                ['跳过', s.totals.unchanged],
                ['失败', s.totals.failed],
              ] as const
            ).map(([label, n]) => (
              <div key={label} className="rounded bg-muted p-3">
                <div className="text-2xl font-bold" data-testid={`count-${label}`}>
                  {n}
                </div>
                <div className="text-xs text-muted-foreground">{label}</div>
              </div>
            ))}
          </div>
        </section>
      </div>

      <section className="flex min-h-0 flex-1 flex-col rounded-lg border border-border bg-card p-6">
        <h2 className="mb-3 text-lg font-semibold">实时日志（已脱敏）</h2>
        <div ref={logRef} data-testid="log-stream" className="min-h-0 flex-1 overflow-y-auto rounded bg-muted p-4 font-mono text-xs">
          {s.logs.length === 0 ? (
            <p className="text-muted-foreground">暂无日志</p>
          ) : (
            s.logs.map((l, i) => (
              <div
                key={i}
                className={
                  l.level === 'ERROR'
                    ? 'text-rose-600'
                    : l.level === 'WARN'
                      ? 'text-amber-600'
                      : 'text-foreground'
                }
              >
                [{l.at.slice(11, 19)}] [{l.level}] {l.text}
              </div>
            ))
          )}
        </div>
      </section>

      <div className="flex items-center gap-3">
        {s.phase === 'running' ? (
          <Button variant="outline" onClick={() => runStore.pause()}>
            <Pause /> 暂停
          </Button>
        ) : s.phase === 'paused' ? (
          <Button onClick={() => void runStore.resume()}>
            <Play /> 恢复
          </Button>
        ) : (
          <Button
            id="start-run"
            disabled={s.tasks.length === 0}
            onClick={() => void runStore.start()}
          >
            <Play /> 开始运行
          </Button>
        )}
        <Button
          variant="destructive"
          disabled={s.phase === 'idle'}
          onClick={() => {
            runStore.pause()
            runStore.log('WARN', '已请求取消（当前页间协作式停止）')
          }}
        >
          <Square /> 取消
        </Button>
        <label className="ml-auto flex items-center gap-2 text-sm">
          <input
            id="demo-mode"
            type="checkbox"
            checked={s.demoMode}
            onChange={(e) => runStore.setDemoMode(e.target.checked)}
          />
          演示数据模式（mock，不访问知乎）
        </label>
      </div>
    </div>
  )
}
