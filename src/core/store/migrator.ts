import schema from './schema.sql?raw'
import type { SqlExecutor } from './sql-executor'

export interface Migration {
  version: number
  name: string
  sql: string
}

/** 迁移清单：版本号递增，禁止修改已发布的迁移内容，只能追加 */
export const MIGRATIONS: Migration[] = [{ version: 1, name: 'initial-schema', sql: schema }]

/** 将迁移 SQL 切为单条语句执行（DDL 无过程体，按分号切分安全） */
function splitStatements(sql: string): string[] {
  return sql
    .split(';')
    .map((s) => s.trim())
    .filter((s) => s.length > 0)
}

export async function migrate(exec: SqlExecutor): Promise<void> {
  await exec.run(
    'CREATE TABLE IF NOT EXISTS _migrations (version INTEGER PRIMARY KEY, name TEXT NOT NULL, applied_at TEXT NOT NULL)',
  )
  for (const m of MIGRATIONS) {
    const applied = await exec.get<{ version: number }>('SELECT version FROM _migrations WHERE version = ?', [
      m.version,
    ])
    if (applied) continue
    for (const stmt of splitStatements(m.sql)) {
      await exec.run(stmt)
    }
    await exec.run('INSERT INTO _migrations (version, name, applied_at) VALUES (?,?,?)', [
      m.version,
      m.name,
      new Date().toISOString(),
    ])
  }
}
