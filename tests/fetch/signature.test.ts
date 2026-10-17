import { describe, expect, it, vi } from 'vitest'
import { SIGNATURE_UNAVAILABLE, WebviewSignatureBridge } from '@/core/fetch/signature'

describe('签名桥（PRD §7.4-1：隐藏 webview + eval）', () => {
  it('eval 结果作为 x-zse-96 返回，注入 url 与 d_c0', async () => {
    const evalFn = vi.fn().mockResolvedValue('zse-96-value')
    const bridge = new WebviewSignatureBridge({ evalFn })
    const sig = await bridge.sign('https://www.zhihu.com/api/v4/answers/1?x=1', 'd0-key')
    expect(sig).toBe('zse-96-value')
    expect(evalFn).toHaveBeenCalledTimes(1)
    const script = String(evalFn.mock.calls[0][0])
    expect(script).toContain('https://www.zhihu.com/api/v4/answers/1?x=1')
    expect(script).toContain('d0-key')
  })

  it('eval 抛错映射为 SIGNATURE_UNAVAILABLE', async () => {
    const evalFn = vi.fn().mockRejectedValue(new Error('webview destroyed'))
    const bridge = new WebviewSignatureBridge({ evalFn })
    const err = await bridge.sign('u', 'd').catch((e) => e)
    expect(err.code).toBe(SIGNATURE_UNAVAILABLE)
    expect(err.message).toContain('SIGNATURE_UNAVAILABLE')
  })

  it('eval 返回非字符串映射为 SIGNATURE_UNAVAILABLE', async () => {
    const evalFn = vi.fn().mockResolvedValue(null)
    const bridge = new WebviewSignatureBridge({ evalFn })
    await expect(bridge.sign('u', 'd')).rejects.toMatchObject({ code: SIGNATURE_UNAVAILABLE })
  })

  it('构造时创建一次隐藏窗口（默认工厂懒创建）', async () => {
    let created = 0
    const bridge = new WebviewSignatureBridge({
      windowFactory: () => {
        created++
        return Promise.resolve({ eval: vi.fn().mockResolvedValue('sig') })
      },
    })
    expect(created).toBe(0)
    await bridge.sign('u', 'd')
    expect(created).toBe(1)
    await bridge.sign('u2', 'd')
    expect(created).toBe(1)
  })
})
