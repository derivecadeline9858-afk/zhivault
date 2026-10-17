import Database from 'better-sqlite3'

import type { RunResult, SqlExecutor, SqlParam } from './sql-executor'

/** better-sqlite3 同步驱动适配为 SqlExecutor（测试与本地脚本使用） */
export function createBetterSqliteExecutor(db: Database.Database): SqlExecutor {
  return {
    async run(sql: string, params: SqlParam[] = []): Promise<RunResult> {
      const r = db.prepare(sql).run(...params)
      return { changes: Number(r.changes), lastId: Number(r.lastInsertRowid) }
    },
    async all<T>(sql: string, params: SqlParam[] = []): Promise<T[]> {
      return db.prepare(sql).all(...params) as T[]
    },
    async get<T>(sql: string, params: SqlParam[] = []): Promise<T | undefined> {
      return db.prepare(sql).get(...params) as T | undefined
    },
  }
}
