// LRU 缓存（PRD §7.4-2）：Map 插入序即最近使用序
export interface LruCacheOptions {
  capacity: number
  ttlMs?: number
  now?: () => number
}

export class LruCache<V> {
  private readonly map = new Map<string, { value: V; at: number }>()
  private hits = 0
  private misses = 0
  private readonly capacity: number
  private readonly ttlMs?: number
  private readonly now: () => number

  constructor(opts: LruCacheOptions) {
    if (opts.capacity < 1) throw new Error('capacity 必须 >= 1')
    this.capacity = opts.capacity
    this.ttlMs = opts.ttlMs
    this.now = opts.now ?? Date.now
  }

  get(key: string): V | undefined {
    const entry = this.map.get(key)
    if (!entry) {
      this.misses++
      return undefined
    }
    if (this.ttlMs !== undefined && this.now() - entry.at > this.ttlMs) {
      this.map.delete(key)
      this.misses++
      return undefined
    }
    this.map.delete(key)
    this.map.set(key, entry)
    this.hits++
    return entry.value
  }

  set(key: string, value: V): void {
    if (this.map.has(key)) this.map.delete(key)
    else if (this.map.size >= this.capacity) {
      const oldest = this.map.keys().next().value
      if (oldest !== undefined) this.map.delete(oldest)
    }
    this.map.set(key, { value, at: this.now() })
  }

  has(key: string): boolean {
    const entry = this.map.get(key)
    if (!entry) return false
    if (this.ttlMs !== undefined && this.now() - entry.at > this.ttlMs) {
      this.map.delete(key)
      return false
    }
    return true
  }

  delete(key: string): boolean {
    return this.map.delete(key)
  }

  clear(): void {
    this.map.clear()
    this.hits = 0
    this.misses = 0
  }

  stats(): { hits: number; misses: number; size: number } {
    return { hits: this.hits, misses: this.misses, size: this.map.size }
  }
}
