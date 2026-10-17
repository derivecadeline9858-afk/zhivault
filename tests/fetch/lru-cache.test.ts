import { describe, expect, it } from 'vitest'
import { LruCache } from '@/core/fetch/lru-cache'

describe('LRU 缓存（PRD §7.4-2）', () => {
  it('set/get/has/delete/clear', () => {
    const cache = new LruCache({ capacity: 2 })
    cache.set('a', 1)
    expect(cache.get('a')).toBe(1)
    expect(cache.has('a')).toBe(true)
    cache.delete('a')
    expect(cache.has('a')).toBe(false)
    cache.set('b', 2)
    cache.clear()
    expect(cache.has('b')).toBe(false)
  })

  it('超出容量淘汰最久未使用项', () => {
    const cache = new LruCache({ capacity: 2 })
    cache.set('a', 1)
    cache.set('b', 2)
    cache.get('a') // a 变为最近使用
    cache.set('c', 3) // 淘汰 b
    expect(cache.has('b')).toBe(false)
    expect(cache.has('a')).toBe(true)
    expect(cache.has('c')).toBe(true)
  })

  it('重复 set 同 key 视为使用且刷新值', () => {
    const cache = new LruCache({ capacity: 2 })
    cache.set('a', 1)
    cache.set('b', 2)
    cache.set('a', 11)
    cache.set('c', 3)
    expect(cache.get('a')).toBe(11)
    expect(cache.has('b')).toBe(false)
  })

  it('命中/未命中统计', () => {
    const cache = new LruCache({ capacity: 3 })
    cache.set('a', 1)
    cache.get('a')
    cache.get('x')
    expect(cache.stats()).toEqual({ hits: 1, misses: 1, size: 1 })
  })

  it('TTL 过期后失效', () => {
    let t = 0
    const cache = new LruCache({ capacity: 3, ttlMs: 1000, now: () => t })
    cache.set('a', 1)
    t = 999
    expect(cache.get('a')).toBe(1)
    t = 1001
    expect(cache.get('a')).toBeUndefined()
    expect(cache.has('a')).toBe(false)
  })
})
