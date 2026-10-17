import { createFetchKernel } from '@/core/fetch/kernel'
import { LruCache } from '@/core/fetch/lru-cache'
import { getGlobalRateLimiter } from '@/core/fetch/rate-limiter'
import { WebviewSignatureBridge } from '@/core/fetch/signature'
import { createAxiosTransport } from '@/core/fetch/transport-axios'
import type { Fetcher } from '@/core/zhihu/fetcher'
import { BrowserDemoStore } from './browser-demo-store'
import { createDemoFetcher } from './demo-fixtures'
import { getDb } from './db'
import { RunStore } from './run-store'
import { sessionStore } from './session-store'

/** 真实采集 fetcher：签名桥 + 全局限速 + LRU；匿名 d_c0 自动获取属任务 6 */
function createRealFetcher(): Fetcher {
  const kernel = createFetchKernel({
    bridge: new WebviewSignatureBridge(),
    limiter: getGlobalRateLimiter(),
    cache: new LruCache({ capacity: 500 }),
    transport: createAxiosTransport(),
  })
  return {
    fetchJson: (url, opts) => kernel.fetchJson(url, { ...opts, dC0: sessionStore.dC0 }),
  }
}

export const runStore = new RunStore({
  store: new BrowserDemoStore(),
  fetcherFactory: (demo) => (demo ? createDemoFetcher() : createRealFetcher()),
  session: { dC0: sessionStore.dC0, get cookie() { return sessionStore.cookie ?? undefined } },
})

// 应用内（Tauri）就绪后切换到真实便携库
void getDb().then((db) => {
  if (db) runStore.setStore(db)
})
