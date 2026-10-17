import Database from '@tauri-apps/plugin-sql'

import { getDataDir } from '@/ipc'
import { ContentStore } from './content-store'
import { migrate } from './migrator'
import type { RunResult, SqlExecutor, SqlParam } from './sql-executor'

/** tauri-plugin-sql 驱动的 SqlExecutor 适配（生产环境） */
class PluginSqlExecutor implements SqlExecutor {
  constructor(private readonly db: Database) {}

  async run(sql: string, params: SqlParam[] = []): Promise<RunResult> {
    const r = await this.db.execute(sql, params)
    return { changes: Number(r.rowsAffected), lastId: Number(r.lastInsertId) }
  }

  async all<T>(sql: string, params: SqlParam[] = []): Promise<T[]> {
    return this.db.select<T[]>(sql, params)
  }

  async get<T>(sql: string, params: SqlParam[] = []): Promise<T | undefined> {
    const rows = await this.db.select<T[]>(sql, params)
    return rows[0]
  }
}

let storePromise: Promise<ContentStore> | null = null

/** 打开便携库（exe 旁 ./zhivault-data/zhivault.db，WAL），执行迁移后返回仓储单例 */
export function getContentStore(): Promise<ContentStore> {
  storePromise ??= (async () => {
    const dataDir = await getDataDir()
    const dbPath = `${dataDir.replace(/\\/g, '/')}/zhivault.db`
    const db = await Database.load(`sqlite:${dbPath}`)
    await db.execute('PRAGMA journal_mode = WAL')
    await db.execute('PRAGMA foreign_keys = ON')
    const exec = new PluginSqlExecutor(db)
    await migrate(exec)
    return new ContentStore(exec)
  })()
  return storePromise
}
