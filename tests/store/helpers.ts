import Database from 'better-sqlite3'

import { createBetterSqliteExecutor } from '@/core/store/executor-better-sqlite3'
import { ContentStore } from '@/core/store/content-store'
import { migrate } from '@/core/store/migrator'
import type { SqlExecutor } from '@/core/store/sql-executor'

export async function createTestExecutor(): Promise<SqlExecutor> {
  const db = new Database(':memory:')
  db.pragma('journal_mode = WAL')
  db.pragma('foreign_keys = ON')
  return createBetterSqliteExecutor(db)
}

export async function createTestStore(): Promise<ContentStore> {
  const exec = await createTestExecutor()
  await migrate(exec)
  return new ContentStore(exec)
}
