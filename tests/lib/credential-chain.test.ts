import { beforeEach, describe, expect, it, vi } from 'vitest'
import { SessionStore } from '@/lib/session-store'
import type { CredentialBridge } from '@/lib/credential-bridge'

function fakeBridge(): CredentialBridge & { store: Map<string, string> } {
  const store = new Map<string, string>()
  return {
    store,
    save: vi.fn(async (d: string) => void store.set('cred', d)),
    load: vi.fn(async () => store.get('cred') ?? null),
    clear: vi.fn(async () => void store.delete('cred')),
  }
}

describe('凭据生命周期（PRD §8-1：加密落盘 + 注销全链路）', () => {
  let bridge: ReturnType<typeof fakeBridge>

  beforeEach(() => {
    bridge = fakeBridge()
  })

  it('登录写入桥接层并可恢复（内存仅会话副本）', async () => {
    const s = new SessionStore(bridge)
    await s.login('z_c0=2|1:aaa; d_c0=bbb')
    expect(bridge.save).toHaveBeenCalledWith('z_c0=2|1:aaa; d_c0=bbb')
    const s2 = new SessionStore(bridge)
    await s2.hydrate()
    expect(s2.loggedIn).toBe(true)
    expect(s2.dC0).toBe('bbb')
  })

  it('注销全链路：清内存 + 清桥接 + d_c0 复位匿名', async () => {
    const s = new SessionStore(bridge)
    await s.login('z_c0=2|1:aaa; d_c0=bbb')
    await s.logout()
    expect(bridge.clear).toHaveBeenCalledTimes(1)
    expect(s.loggedIn).toBe(false)
    expect(s.dC0).toBe('anonymous')
    expect(s.cookie).toBeNull()
  })

  it('无凭据时 hydrate 保持匿名', async () => {
    const s = new SessionStore(bridge)
    await s.hydrate()
    expect(s.loggedIn).toBe(false)
  })
})
