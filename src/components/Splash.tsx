import { useEffect } from 'react'
import { APP_NAME, AUTHOR } from '@/branding'
import avatarUrl from '../../assets/avatar.png'

export interface SplashProps {
  onDone: () => void
  durationMs?: number
}

export function Splash({ onDone, durationMs = 1500 }: SplashProps) {
  useEffect(() => {
    const timer = setTimeout(onDone, durationMs)
    return () => clearTimeout(timer)
  }, [onDone, durationMs])

  return (
    <div className="fixed inset-0 z-50 flex flex-col items-center justify-center gap-4 bg-background">
      <img src={avatarUrl} alt="知藏头像" className="h-24 w-24 rounded-2xl shadow-lg" />
      <h1 className="text-2xl font-semibold tracking-wide text-foreground">{APP_NAME}</h1>
      <p className="text-sm text-muted-foreground">作者：{AUTHOR}</p>
    </div>
  )
}
