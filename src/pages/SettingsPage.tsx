import { useEffect, useState } from 'react'
import avatar128 from '../../assets/avatar-128.png'
import { settingsFooter } from '@/branding'
import { Button } from '@/components/ui/button'
import { getAppInfo, getDataDir } from '@/ipc'
import { getTheme, setTheme, type ThemeMode } from '@/lib/theme'
import { cn } from '@/lib/utils'

const THEME_OPTIONS: { value: ThemeMode; label: string }[] = [
  { value: 'light', label: '浅色' },
  { value: 'dark', label: '深色' },
  { value: 'system', label: '跟随系统' },
]

export function SettingsPage() {
  const [theme, setThemeState] = useState<ThemeMode>(() => getTheme())
  const [dataDir, setDataDir] = useState<string>('')
  const [version, setVersion] = useState('')

  useEffect(() => {
    getDataDir()
      .then(setDataDir)
      .catch(() => setDataDir('（仅在应用内可用）'))
    getAppInfo()
      .then((info) => setVersion(info.version))
      .catch(() => setVersion('dev'))
  }, [])

  const handleThemeChange = (mode: ThemeMode) => {
    setTheme(mode)
    setThemeState(mode)
  }

  return (
    <div className="flex h-full flex-col">
      <div className="flex-1 space-y-8 p-8">
        <section>
          <h2 className="mb-4 text-lg font-semibold">外观</h2>
          <div className="flex gap-2">
            {THEME_OPTIONS.map(({ value, label }) => (
              <Button
                key={value}
                variant={theme === value ? 'default' : 'outline'}
                aria-pressed={theme === value}
                onClick={() => handleThemeChange(value)}
              >
                {label}
              </Button>
            ))}
          </div>
        </section>

        <section>
          <h2 className="mb-4 text-lg font-semibold">数据目录</h2>
          <p className="rounded-lg border border-border bg-card px-4 py-3 font-mono text-sm text-muted-foreground">
            {dataDir || '加载中…'}
          </p>
          <p className="mt-2 text-xs text-muted-foreground">
            便携模式：数据库与配置保存在程序旁，整目录复制即可迁移。
          </p>
        </section>
      </div>

      <footer className="flex items-center justify-end gap-2 border-t border-border px-6 py-3">
        <img src={avatar128} alt="知藏头像" className={cn('h-6 w-6 rounded-full')} />
        <span className="text-xs text-muted-foreground">{settingsFooter(version)}</span>
      </footer>
    </div>
  )
}
