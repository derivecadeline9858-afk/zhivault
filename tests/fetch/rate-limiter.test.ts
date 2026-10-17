import { describe, expect, it, vi } from 'vitest'
import { TokenBucketRateLimiter } from '@/core/fetch/rate-limiter'

function makeVirtual() {
  let t = 0
  const sleeps: number[] = []
  return {
    now: () => t,
    sleep: (ms: number) => {
      sleeps.push(ms)
      t += ms
      return Promise.resolve()
    },
    sleeps,
  }
}

describe('令牌桶限速器（PRD §7.4-2：默认 1 req/s、突发 3）', () => {
  it('突发容量内立即通过，超出后按速率等待', async () => {
    const v = makeVirtual()
    const limiter = new TokenBucketRateLimiter({ ratePerSecond: 1, burst: 3, now: v.now, sleep: v.sleep })
    await limiter.acquire()
    await limiter.acquire()
    await limiter.acquire()
    expect(v.sleeps).toEqual([])
    await limiter.acquire()
    expect(v.sleeps).toEqual([1000])
  })

  it('速率为 2/s 时补满一个令牌需 500ms', async () => {
    const v = makeVirtual()
    const limiter = new TokenBucketRateLimiter({ ratePerSecond: 2, burst: 1, now: v.now, sleep: v.sleep })
    await limiter.acquire()
    await limiter.acquire()
    expect(v.sleeps).toEqual([500])
  })

  it('退避：429/风控信号把速率降到 0.2 req/s 并回调提示', async () => {
    const v = makeVirtual()
    const limiter = new TokenBucketRateLimiter({ ratePerSecond: 1, burst: 1, now: v.now, sleep: v.sleep })
    await limiter.acquire()
    const onBackoff = vi.fn()
    limiter.onBackoff(onBackoff)
    limiter.handleRateLimitSignal()
    expect(onBackoff).toHaveBeenCalledTimes(1)
    expect(onBackoff).toHaveBeenCalledWith({ ratePerSecond: 0.2 })
    expect(limiter.getState()).toMatchObject({ ratePerSecond: 0.2 })
    await limiter.acquire()
    expect(v.sleeps).toEqual([5000])
  })

  it('setRate 调整限速档位', async () => {
    const v = makeVirtual()
    const limiter = new TokenBucketRateLimiter({ ratePerSecond: 1, burst: 1, now: v.now, sleep: v.sleep })
    limiter.setRate(4)
    await limiter.acquire()
    await limiter.acquire()
    expect(v.sleeps).toEqual([250])
  })

  it('时间推进自然补充令牌（不调用 sleep）', async () => {
    let t = 0
    const limiter = new TokenBucketRateLimiter({
      ratePerSecond: 1,
      burst: 1,
      now: () => t,
      sleep: (ms) => {
        t += ms
        return Promise.resolve()
      },
    })
    await limiter.acquire()
    t += 1000
    await limiter.acquire()
    expect(limiter.getState().tokens).toBeLessThanOrEqual(1)
  })
})
