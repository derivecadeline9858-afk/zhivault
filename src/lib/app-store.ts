import { invoke } from '@tauri-apps/api/core'

import { createFetchKernel } from '@/core/fetch/kernel'
import { LruCache } from '@/core/fetch/lru-cache'
import { getGlobalRateLimiter } from '@/core/fetch/rate-limiter'
import { WebviewSignatureBridge } from '@/core/fetch/signature'
import { createAxiosTransport } from '@/core/fetch/transport-axios'
import { createGuardedTransport, isAllowedUrl } from '@/core/fetch/url-guard'
import type { Fetcher } from '@/core/zhihu/fetcher'
import { LogRetention } from '@/core/security/log-retention'
import { Scheduler, type ScheduleSpec } from '@/core/task/scheduler'
import { BrowserDemoStore } from './browser-demo-store'
import { createTauriCredentialBridge, createMemoryCredentialBridge } from './credential-bridge'
import { createDemoFetcher } from './demo-fixtures'
import { getDb } from './db'
import { createNullNotifier, createTauriNotifier } from './notify'
import { RunStore } from './run-store'
import { SessionStore } from './session-store'

function inTauri(): boolean {
  return typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window
}

/** 应用内经 Rust guard_url 裁决；独立环境用本地同规则表（采集演示不触网） */
function createVerdict(): (url: string) => Promise<boolean> {
  if (inTauri()) {
    return (url) =>
      invoke<void>('guard_url', { url })
        .then(() => true)
        .catch(() => false)
  }
  return async (url) => isAllowedUrl(url)
}

/** 真实采集 fetcher：SSRF 守卫 + 签名桥 + 全局限速 + LRU */
function createRealFetcher(): Fetcher {
  const transport = createGuardedTransport(createAxiosTransport(), createVerdict())
  const kernel = createFetchKernel({
    bridge: new WebviewSignatureBridge(),
    limiter: getGlobalRateLimiter(),
    cache: new LruCache({ capacity: 500 }),
    transport,
  })
  return {
    fetchJson: (url, opts) => kernel.fetchJson(url, { ...opts, dC0: sessionStore.dC0 }),
  }
}

export const sessionStore = new SessionStore(
  inTauri() ? createTauriCredentialBridge() : createMemoryCredentialBridge(),
)

export const logRetention = new LogRetention()

export const runStore = new RunStore({
  store: new BrowserDemoStore(),
  fetcherFactory: (demo) => (demo ? createDemoFetcher() : createRealFetcher()),
  session: { get dC0() { return sessionStore.dC0 }, get cookie() { return sessionStore.cookie ?? undefined } },
  retention: logRetention,
  notifier: inTauri() ? createTauriNotifier() : createNullNotifier(),
})

// 启动恢复：凭据会话 + 应用内切换到真实便携库 + 监控调度循环
void sessionStore.hydrate()
void getDb().then((db) => {
  if (!db) return
  runStore.setStore(db)
  runStoreDepsWire(db)
  void startSchedulerLoop(db)
})

function runStoreDepsWire(db: NonNullable<Awaited<ReturnType<typeof getDb>>>): void {
  runStore.setOnRunFinished(async (rec) => {
    await db.saveRunRecord({
      id: `run-${Date.now()}`,
      source: rec.source,
      startedAt: rec.startedAt,
      finishedAt: rec.finishedAt,
      totals: rec.totals,
    })
  })
}

/** 监控调度循环（PRD §6.2 页 8）：每分钟 tick，启动补跑，到点自动增量并通知 */
async function startSchedulerLoop(db: Awaited<ReturnType<typeof getDb>> & object): Promise<void> {
  const store = db as NonNullable<Awaited<ReturnType<typeof getDb>>>
  const scheduler = new Scheduler()
  const refresh = async () => {
    const rows = await store.listSchedules()
    scheduler.register(
      rows.map((r) => ({ ...(r.spec as Omit<ScheduleSpec, 'id' | 'name'>), id: r.id, name: r.name, lastRunAt: r.lastRunAt })),
    )
  }
  const enqueue = (spec: ScheduleSpec) => {
    for (const url of spec.urls ?? []) runStore.addTask(url)
    if (runStore.state.phase === 'idle' && runStore.state.tasks.length > 0) {
      runStore.runSource = 'monitor'
      void runStore.start().finally(() => {
        runStore.runSource = 'manual'
      })
    }
  }
  await refresh()
  // 启动补跑
  const now = new Date()
  for (const spec of scheduler.specs) {
    if (!spec.id) continue
    const missed = scheduler.missedRuns(spec, now)
    if (missed.length > 0) {
      enqueue(spec)
      await store.setScheduleLastRun(spec.id, now.toISOString())
    }
  }
  setInterval(() => {
    void (async () => {
      await refresh()
      for (const due of scheduler.tick()) {
        if (!due.id) continue
        enqueue(due)
        await store.setScheduleLastRun(due.id, new Date().toISOString())
      }
    })()
  }, 60_000)
}
