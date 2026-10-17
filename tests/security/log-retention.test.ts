import { beforeEach, describe, expect, it } from 'vitest'
import { LogRetention } from '@/core/security/log-retention'

const DAY = 24 * 60 * 60 * 1000

function makeStorage() {
  const map = new Map<string, string>()
  return {
    getItem: (k: string) => map.get(k) ?? null,
    setItem: (k: string, v: string) => void map.set(k, v),
    removeItem: (k: string) => void map.delete(k),
  }
}

let now = 0

beforeEach(() => {
  now = 1_000_000_000_000
})

describe('日志留存与诊断导出（PRD §8-9：保留 5 天滚动 + 诊断自动脱敏）', () => {
  it('超过 5 天的日志被滚动清理', () => {
    const storage = makeStorage()
    const lr = new LogRetention({ storage, now: () => now, ttlMs: 5 * DAY })
    lr.append({ at: new Date(now - 6 * DAY).toISOString(), level: 'INFO', text: '旧日志 token=old1' })
    lr.append({ at: new Date(now - 4 * DAY).toISOString(), level: 'INFO', text: '新日志' })
    lr.prune()
    const all = lr.all()
    expect(all).toHaveLength(1)
    expect(all[0].text).toBe('新日志')
  })

  it('append 时自动清理（保留最近 5 天）', () => {
    const storage = makeStorage()
    const lr = new LogRetention({ storage, now: () => now, ttlMs: 5 * DAY })
    lr.append({ at: new Date(now - 10 * DAY).toISOString(), level: 'INFO', text: ' ancient cookie=xxx1 ' })
    lr.append({ at: new Date(now).toISOString(), level: 'INFO', text: '今日' })
    expect(lr.all()).toHaveLength(1)
  })

  it('诊断导出自动脱敏', () => {
    const storage = makeStorage()
    const lr = new LogRetention({ storage, now: () => now, ttlMs: 5 * DAY })
    lr.append({ at: new Date(now).toISOString(), level: 'INFO', text: '登录 cookie=secret456789' })
    const diag = lr.exportDiagnostics()
    expect(diag).toContain('cookie=***')
    expect(diag).not.toContain('secret456789')
    expect(diag).toContain('zhivault-diagnostics')
  })
})
