import { invoke } from '@tauri-apps/api/core'

import { getDataDir } from '@/ipc'
import { ContentStore } from './content-store'
import { migrate } from './migrator'
import type { RunResult, SqlExecutor, SqlParam } from './sql-executor'

/** IPC 驱动的 SqlExecutor（生产 = 壳内 rusqlite 命令组，Ruling-63） */
class IpcSqlExecutor implements SqlExecutor {
  async run(sql: string, params: SqlParam[] = []): Promise<RunResult> {
    const r = await invoke<{ changes: number; last_id: number }>('db_run', { sql, params })
    return { changes: Number(r.changes), lastId: Number(r.last_id) }
  }

  async all<T>(sql: string, params: SqlParam[] = []): Promise<T[]> {
    return invoke<T[]>('db_all', { sql, params })
  }

  async get<T>(sql: string, params: SqlParam[] = []): Promise<T | undefined> {
    return invoke<T | null>('db_get', { sql, params }).then((r) => r ?? undefined)
  }
}

let storePromise: Promise<ContentStore> | null = null

/** 打开便携库（exe 旁 ./zhivault-data/zhivault.db，WAL），执行迁移后返回仓储单例 */
export function getContentStore(): Promise<ContentStore> {
  storePromise ??= (async () => {
    const dataDir = await getDataDir()
    const dbPath = `${dataDir.replace(/\\/g, '/')}/zhivault.db`
    try {
      await invoke('db_open', { path: dbPath })
      const exec = new IpcSqlExecutor()
      await migrate(exec)
      return new ContentStore(exec)
    } catch (e) {
      // 错误上窗标题（KimiCU/用户可直接看见）+ 落盘，避免再被 getDb 的 catch 静默吞掉
      if (typeof document !== 'undefined') {
        document.title = `ZV-DBERR ${(e as Error).message ?? String(e)}`.slice(0, 90)
      }
      throw e
    }
  })()
  return storePromise
}
