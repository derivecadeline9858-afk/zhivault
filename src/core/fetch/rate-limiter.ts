// 令牌桶限速器（PRD §7.4-2：默认 1 req/s、突发 3；429/风控退避至 0.2 req/s）
export const DEFAULT_RATE_PER_SECOND = 1
export const DEFAULT_BURST = 3
/** 退避档位（PRD §7.4-2）：触发风控后的安全速率 */
export const BACKOFF_RATE_PER_SECOND = 0.2

export interface RateLimiterState {
  ratePerSecond: number
  burst: number
  tokens: number
}

export interface RateLimiter {
  acquire(): Promise<void>
  /** 429 或风控文案时调用：降速并通知回调（UI 提示） */
  handleRateLimitSignal(): void
  onBackoff(cb: (state: { ratePerSecond: number }) => void): void
  setRate(ratePerSecond: number): void
  getState(): RateLimiterState
}

export interface TokenBucketOptions {
  ratePerSecond?: number
  burst?: number
  /** 虚拟时钟注入（测试用） */
  now?: () => number
  sleep?: (ms: number) => Promise<void>
}

const realSleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms))

export class TokenBucketRateLimiter implements RateLimiter {
  private rate: number
  private readonly burst: number
  private tokens: number
  private last: number
  private readonly now: () => number
  private readonly sleep: (ms: number) => Promise<void>
  private readonly backoffCbs: ((state: { ratePerSecond: number }) => void)[] = []

  constructor(opts: TokenBucketOptions = {}) {
    this.rate = opts.ratePerSecond ?? DEFAULT_RATE_PER_SECOND
    this.burst = opts.burst ?? DEFAULT_BURST
    this.tokens = this.burst
    this.now = opts.now ?? Date.now
    this.sleep = opts.sleep ?? realSleep
    this.last = this.now()
  }

  async acquire(): Promise<void> {
    for (;;) {
      const t = this.now()
      this.tokens = Math.min(this.burst, this.tokens + ((t - this.last) / 1000) * this.rate)
      this.last = t
      if (this.tokens >= 1) {
        this.tokens -= 1
        return
      }
      await this.sleep(Math.ceil(((1 - this.tokens) / this.rate) * 1000))
    }
  }

  handleRateLimitSignal(): void {
    this.setRate(BACKOFF_RATE_PER_SECOND)
    const state = { ratePerSecond: this.rate }
    for (const cb of this.backoffCbs) cb(state)
  }

  onBackoff(cb: (state: { ratePerSecond: number }) => void): void {
    this.backoffCbs.push(cb)
  }

  setRate(ratePerSecond: number): void {
    this.rate = ratePerSecond
  }

  getState(): RateLimiterState {
    return { ratePerSecond: this.rate, burst: this.burst, tokens: this.tokens }
  }
}

/** 全局唯一限速器：所有任务共享（PRD §5.3 / §7.4-2），按模块懒初始化 */
let globalLimiter: TokenBucketRateLimiter | null = null

export function getGlobalRateLimiter(): TokenBucketRateLimiter {
  globalLimiter ??= new TokenBucketRateLimiter()
  return globalLimiter
}

/** 测试/重置用 */
export function resetGlobalRateLimiter(): void {
  globalLimiter = null
}
