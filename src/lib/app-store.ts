import { invoke } from '@tauri-apps/api/core'

import { createFetchKernel } from '@/core/fetch/kernel'
import { LruCache } from '@/core/fetch/lru-cache'
import { getGlobalRateLimiter } from '@/core/fetch/rate-limiter'
import { WebviewSignatureBridge } from '@/core/fetch/signature'
import { createAxiosTransport } from '@/core/fetch/transport-axios'
import { createGuardedTransport, isAllowedUrl } from '@/core/fetch/url-guard'
import type { Fetcher } from '@/core/zhihu/fetcher'
import { LogRetention } from '@/core/security/log-retention'
import { BrowserDemoStore } from './browser-demo-store'
import { createTauriCredentialBridge, createMemoryCredentialBridge } from './credential-bridge'
import { createDemoFetcher } from './demo-fixtures'
import { getDb } from './db'
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
})

// 启动恢复：凭据会话 + 应用内切换到真实便携库
void sessionStore.hydrate()
void getDb().then((db) => {
  if (db) runStore.setStore(db)
})
