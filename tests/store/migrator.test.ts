import { describe, expect, it } from 'vitest'
import { createTestExecutor } from './helpers'
import { MIGRATIONS } from '@/core/store/migrator'

const SIXTEEN_TABLES = [
  'answer',
  'article',
  'pin',
  'question',
  'comment',
  'collection',
  'collection_item',
  'column',
  'column_item',
  'topic',
  'topic_item',
  'author',
  'activity',
  'content_revision',
  'annotation',
  'capture_meta',
]

describe('迁移器（DDL 单一来源 + 版本记录）', () => {
  it('首次迁移创建全部 16 表 + FTS 虚拟表', async () => {
    const exec = await createTestExecutor()
    const { migrate } = await import('@/core/store/migrator')
    await migrate(exec)
    const rows = await exec.all<{ name: string }>("SELECT name FROM sqlite_master WHERE type IN ('table','virtual table')")
    const names = rows.map((r) => r.name)
    for (const t of SIXTEEN_TABLES) {
      expect(names).toContain(t)
    }
    expect(names).toContain('content_fts')
    expect(names).toContain('_migrations')
  })

  it('记录迁移版本且重复执行幂等', async () => {
    const exec = await createTestExecutor()
    const { migrate } = await import('@/core/store/migrator')
    await migrate(exec)
    await migrate(exec)
    const rows = await exec.all<{ version: number }>('SELECT version FROM _migrations ORDER BY version')
    expect(rows).toEqual(MIGRATIONS.map((m) => ({ version: m.version })))
  })

  it('迁移后可建外键依赖的级联数据（foreign_keys 开启时）', async () => {
    const exec = await createTestExecutor()
    const { migrate } = await import('@/core/store/migrator')
    await migrate(exec)
    await exec.run('INSERT INTO collection (id, title, captured_at, updated_at) VALUES (?,?,?,?)', ['c1', 't', 'x', 'x'])
    await exec.run('INSERT INTO collection_item (collection_id, item_type, item_id) VALUES (?,?,?)', ['c1', 'answer', 'a1'])
    const n = await exec.get<{ n: number }>('SELECT COUNT(*) n FROM collection_item')
    expect(n?.n).toBe(1)
  })
})
