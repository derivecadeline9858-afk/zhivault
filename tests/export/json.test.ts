import { describe, expect, it } from 'vitest'
import { buildJsonExport } from '@/core/export/json'
import { makeBook } from './helpers'

describe('JSON 导出（PRD §5.5：schema v1 + author 橙茶星 + raw 原始响应）', () => {
  it('结构合规', () => {
    const out = buildJsonExport(makeBook(), { appVersion: '0.1.0' })
    expect(out.schema).toBe('zhivault.export.v1')
    expect(out.app).toEqual({ name: 'zhivault', version: '0.1.0', author: '橙茶星' })
    expect(typeof out.exportedAt).toBe('string')
    expect(out.records).toHaveLength(2)
    expect(out.records[0].raw).toEqual({ id: 'a1', content: '<p>回答正文</p>', voteup_count: 10 })
    expect(out.records[0].entityType).toBe('answer')
    expect(out.records[0].entityId).toBe('a1')
    expect(Array.isArray(out.indexes)).toBe(true)
    expect(Array.isArray(out.relations)).toBe(true)
  })

  it('序列化后 roundtrip', () => {
    const out = buildJsonExport(makeBook(), { appVersion: '0.1.0' })
    const parsed = JSON.parse(JSON.stringify(out))
    expect(parsed.schema).toBe('zhivault.export.v1')
  })
})
