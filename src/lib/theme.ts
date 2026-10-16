export type ThemeMode = 'light' | 'dark' | 'system'

export const THEME_STORAGE_KEY = 'zhivault.theme'

const VALID_MODES: readonly ThemeMode[] = ['light', 'dark', 'system']

export function getTheme(): ThemeMode {
  try {
    const value = localStorage.getItem(THEME_STORAGE_KEY)
    if ((VALID_MODES as readonly string[]).includes(value ?? '')) {
      return value as ThemeMode
    }
  } catch {
    // localStorage 不可用时保持默认
  }
  return 'system'
}

export function applyTheme(mode: ThemeMode = getTheme()): void {
  const dark =
    mode === 'dark' ||
    (mode === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches)
  document.documentElement.classList.toggle('dark', dark)
}

export function setTheme(mode: ThemeMode): void {
  try {
    localStorage.setItem(THEME_STORAGE_KEY, mode)
  } catch {
    // localStorage 不可用时仅应用不持久化
  }
  applyTheme(mode)
}
