import { describe, expect, it, vi } from 'vitest'
import { loadAiKey, saveAiKey, clearAiKey } from '@/lib/ai-key-store'
import { redactLog } from '@/core/security/log-redact'

function fakeBridge() {
  let value: string | null = null
  return {
    save: vi.fn(async (d: string) => {
      value = d
    }),
    load: vi.fn(async () => value),
    clear: vi.fn(async () => {
      value = null
    }),
    _get: () => value,
  }
}

describe('AI Key 管理（PRD §10-9：DPAPI 加密 + 独立存储）', () => {
  it('保存/读取/清除生命周期', async () => {
    const b = fakeBridge()
    expect(await loadAiKey(b)).toBeNull()
    await saveAiKey(b, 'sk-secret-123456')
    expect(await loadAiKey(b)).toBe('sk-secret-123456')
    await clearAiKey(b)
    expect(await loadAiKey(b)).toBeNull()
    expect(b.clear).toHaveBeenCalled()
  })

  it('Key 不入日志：Authorization 头经脱敏器遮蔽', () => {
    const line = 'POST https://api.deepseek.com/chat/completions Authorization: Bearer sk-secret-123456'
    const out = redactLog(line)
    expect(out).toContain('Authorization: ***')
    expect(out).not.toContain('sk-secret-123456')
  })

  it('Key 误写进普通日志键名也会被遮蔽', () => {
    expect(redactLog('配置 api_key=sk-secret-123456 完成')).toBe('配置 api_key=*** 完成')
    expect(redactLog('ai_key=sk-secret-123456 已保存')).toBe('ai_key=*** 已保存')
  })
})
