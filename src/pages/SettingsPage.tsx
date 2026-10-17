import { useEffect, useState } from 'react'
import avatar128 from '../../assets/avatar-128.png'
import { settingsFooter } from '@/branding'
import { Button } from '@/components/ui/button'
import { getAppInfo, getDataDir } from '@/ipc'
import { getGlobalRateLimiter } from '@/core/fetch/rate-limiter'
import { getTheme, setTheme, type ThemeMode } from '@/lib/theme'
import { cn } from '@/lib/utils'

const THEME_OPTIONS: { value: ThemeMode; label: string }[] = [
  { value: 'light', label: '浅色' },
  { value: 'dark', label: '深色' },
  { value: 'system', label: '跟随系统' },
]

const RATE_PRESETS = [
  { value: 0.5, label: '保守（0.5 req/s）' },
  { value: 1, label: '标准（1 req/s）' },
  { value: 2, label: '激进（2 req/s）' },
]

const IMAGES_KEY = 'zhivault.prefs.images'
const RATE_KEY = 'zhivault.prefs.rate'

export function SettingsPage() {
  const [theme, setThemeState] = useState<ThemeMode>(() => getTheme())
  const [dataDir, setDataDir] = useState<string>('')
  const [version, setVersion] = useState('')
  const [rate, setRate] = useState<number>(() => Number(localStorage.getItem(RATE_KEY) ?? 1))
  const [images, setImages] = useState<string>(() => localStorage.getItem(IMAGES_KEY) ?? 'original')

  useEffect(() => {
    getDataDir()
      .then(setDataDir)
      .catch(() => setDataDir('（仅在应用内可用）'))
    getAppInfo()
      .then((i) => setVersion(i.version))
      .catch(() => setVersion('dev'))
  }, [])

  const handleThemeChange = (mode: ThemeMode) => {
    setTheme(mode)
    setThemeState(mode)
  }

  const handleRate = (r: number) => {
    getGlobalRateLimiter().setRate(r)
    localStorage.setItem(RATE_KEY, String(r))
    setRate(r)
  }

  const handleImages = (v: string) => {
    localStorage.setItem(IMAGES_KEY, v)
    setImages(v)
  }

  return (
    <div className="flex h-full flex-col">
      <div className="flex-1 space-y-8 overflow-y-auto p-8">
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
          <h2 className="mb-4 text-lg font-semibold">采集限速</h2>
          <div className="flex gap-2">
            {RATE_PRESETS.map((p) => (
              <Button
                key={p.value}
                variant={rate === p.value ? 'default' : 'outline'}
                aria-pressed={rate === p.value}
                onClick={() => handleRate(p.value)}
              >
                {p.label}
              </Button>
            ))}
          </div>
          <p className="mt-2 text-xs text-muted-foreground">
            内置限速不可关闭到危险值；触发 429/风控自动退避 0.2 req/s（PRD §2）。
          </p>
        </section>

        <section>
          <h2 className="mb-4 text-lg font-semibold">图片档位</h2>
          <select
            id="images-preset"
            value={images}
            onChange={(e) => handleImages(e.target.value)}
            className="rounded-lg border border-input bg-background px-3 py-2 text-sm"
          >
            <option value="original">原图</option>
            <option value="webp">压缩 WebP</option>
            <option value="none">无图</option>
          </select>
          <p className="mt-2 text-xs text-muted-foreground">新任务生效；图片池跨任务去重。</p>
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

        <section>
          <h2 className="mb-4 text-lg font-semibold">协议与隐私</h2>
          <p className="max-w-2xl text-sm text-muted-foreground">
            仅限个人学习存档；内置限速（默认 ≤1 req/s）；不破解不绕过付费墙，不触碰盐选等付费内容；不绕过知乎人机验证（触发风控自动减速并提示）。更新包将经 Ed25519 签名校验（任务 6）。
          </p>
        </section>

        <section>
          <h2 className="mb-4 text-lg font-semibold">检查更新</h2>
          <p className="text-sm text-muted-foreground">当前 v{version} · 更新通道随任务 6（Ed25519 签名校验）接入。</p>
        </section>
      </div>

      <footer className="flex items-center justify-end gap-2 border-t border-border px-6 py-3">
        <img src={avatar128} alt="知藏头像" className={cn('h-6 w-6 rounded-full')} />
        <span className="text-xs text-muted-foreground">{settingsFooter(version)}</span>
      </footer>
    </div>
  )
}
