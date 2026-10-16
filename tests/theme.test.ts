import { beforeEach, describe, expect, it } from 'vitest'
import { applyTheme, getTheme, setTheme, THEME_STORAGE_KEY, type ThemeMode } from '@/lib/theme'

function mockMatchMedia(matches: boolean) {
  window.matchMedia = ((query: string): MediaQueryList => ({
    matches,
    media: query,
    onchange: null,
    addListener: () => {},
    removeListener: () => {},
    addEventListener: () => {},
    removeEventListener: () => {},
    dispatchEvent: () => false,
  })) as unknown as typeof window.matchMedia
}

describe('主题骨架（浅色/深色/跟随系统）', () => {
  beforeEach(() => {
    localStorage.clear()
    document.documentElement.classList.remove('dark')
    mockMatchMedia(false)
  })

  it('默认主题为 system，未存储任何值', () => {
    expect(getTheme()).toBe('system')
  })

  it('无效存储值回退到 system', () => {
    localStorage.setItem(THEME_STORAGE_KEY, 'neon')
    expect(getTheme()).toBe('system')
  })

  it.each<ThemeMode>(['light', 'dark', 'system'])('setTheme(%s) 持久化并可回读', (mode) => {
    setTheme(mode)
    expect(getTheme()).toBe(mode)
  })

  it('dark 主题给根元素加 .dark 类', () => {
    setTheme('dark')
    expect(document.documentElement.classList.contains('dark')).toBe(true)
  })

  it('light 主题移除 .dark 类', () => {
    document.documentElement.classList.add('dark')
    setTheme('light')
    expect(document.documentElement.classList.contains('dark')).toBe(false)
  })

  it('system 主题跟随 matchMedia：深色则加 .dark', () => {
    mockMatchMedia(true)
    applyTheme('system')
    expect(document.documentElement.classList.contains('dark')).toBe(true)
  })

  it('system 主题跟随 matchMedia：浅色则不加 .dark', () => {
    mockMatchMedia(false)
    applyTheme('system')
    expect(document.documentElement.classList.contains('dark')).toBe(false)
  })
})
