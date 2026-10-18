import { describe, expect, it, vi } from 'vitest'
import { SessionStore } from '@/lib/session-store'

function fakeDeps(overrides: { probeResult?: boolean } = {}) {
  return {
    probe: vi.fn(async () => overrides.probeResult ?? false),
    logout: vi.fn(async () => {}),
  }
}

describe('会话状态（Ruling-61：状态由知乎代理承载，本类只管布尔与订阅）', () => {
  it('hydrate 探测已登录并通知订阅者', async () => {
    const deps = fakeDeps({ probeResult: true })
    const s = new SessionStore(deps)
    const seen: boolean[] = []
    s.subscribe(() => seen.push(s.loggedIn))
    await s.hydrate()
    expect(deps.probe).toHaveBeenCalledTimes(1)
    expect(s.loggedIn).toBe(true)
    expect(seen).toEqual([true])
  })

  it('hydrate 探测失败按匿名处理', async () => {
    const deps = {
      probe: vi.fn(async () => {
        throw new Error('窗口未就绪')
      }),
      logout: vi.fn(async () => {}),
    }
    const s = new SessionStore(deps)
    await s.hydrate()
    expect(s.loggedIn).toBe(false)
  })

  it('注销全链路：调用代理注销 + 本地复位 + 通知', async () => {
    const deps = fakeDeps({ probeResult: true })
    const s = new SessionStore(deps)
    await s.hydrate()
    const seen: boolean[] = []
    s.subscribe(() => seen.push(s.loggedIn))
    await s.logout()
    expect(deps.logout).toHaveBeenCalledTimes(1)
    expect(s.loggedIn).toBe(false)
    expect(seen).toEqual([false])
  })

  it('注销即使代理失败也复位本地状态', async () => {
    const deps = {
      probe: vi.fn(async () => true),
      logout: vi.fn(async () => {
        throw new Error('网络失败')
      }),
    }
    const s = new SessionStore(deps)
    await s.hydrate()
    await s.logout()
    expect(s.loggedIn).toBe(false)
  })
})
