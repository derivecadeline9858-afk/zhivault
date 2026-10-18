import { useEffect, useState } from 'react'
import QRCode from 'qrcode'
import { RefreshCw } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { sessionStore, zhihuProxy } from '@/lib/app-store'
import type { QrStatus } from '@/core/fetch/zhihu-proxy'

type Phase = 'loading' | 'idle' | 'scanned' | 'success' | 'error'

const POLL_MS = 2500
/** 单张二维码最长展示时间（知乎票据自带有效期，取较短者） */
const TICKET_GUARD_MS = 120_000

function inTauri(): boolean {
  return typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window
}

/** 扫码登录区：取票据 → 渲染二维码 → 轮询状态机 → 确认后回写会话（Ruling-61） */
export function QrLoginSection({ onClose }: { onClose: () => void }) {
  const [phase, setPhase] = useState<Phase>('loading')
  const [qr, setQr] = useState('')
  const [hint, setHint] = useState('正在获取二维码…')
  const [refreshTick, setRefreshTick] = useState(0)

  useEffect(() => {
    if (!inTauri()) {
      setPhase('error')
      setHint('演示环境不支持扫码登录（需在应用内运行）')
      return
    }
    let stopped = false

    const run = async (): Promise<void> => {
      try {
        for (;;) {
          if (stopped) return
          setPhase('loading')
          setHint('正在获取二维码…')
          const ticket = await zhihuProxy.qrCreate()
          if (stopped) return
          const dataUrl = await QRCode.toDataURL(ticket.link, { margin: 1, width: 200 })
          if (stopped) return
          setQr(dataUrl)
          setPhase('idle')
          setHint('打开知乎 App「我的 → 右上角扫一扫」，或微信扫码')

          const deadline = Math.min(ticket.expiresAt * 1000, Date.now() + TICKET_GUARD_MS)
          let status: QrStatus = 'pending'
          while (!stopped && Date.now() < deadline) {
            await new Promise((r) => setTimeout(r, POLL_MS))
            if (stopped) return
            status = await zhihuProxy.qrCheck(ticket.token)
            if (status === 'pending') continue
            if (status === 'scanned') {
              setPhase('scanned')
              setHint('已扫码，请在手机上确认登录')
              continue
            }
            if (status === 'confirmed') {
              await sessionStore.hydrate()
              if (sessionStore.loggedIn) {
                setPhase('success')
                setHint('登录成功，正在进入…')
                setTimeout(() => {
                  if (!stopped) onClose()
                }, 900)
                return
              }
              continue
            }
            break // expired
          }
          if (stopped) return
          setHint('二维码已过期，正在自动刷新…')
        }
      } catch (e) {
        if (!stopped) {
          setPhase('error')
          setHint(`扫码登录不可用：${(e as Error).message ?? String(e)}`)
        }
      }
    }

    void run()
    return () => {
      stopped = true
    }
  }, [refreshTick, onClose])

  return (
    <div className="flex flex-col items-center gap-3">
      <div
        data-testid="qr-box"
        className="flex h-[200px] w-[200px] items-center justify-center rounded-lg border border-border bg-white"
      >
        {qr && phase !== 'loading' ? (
          <img src={qr} alt="知乎登录二维码" className="h-[188px] w-[188px]" />
        ) : (
          <span className="text-xs text-muted-foreground">{phase === 'loading' ? '加载中…' : ''}</span>
        )}
      </div>
      <p className="min-h-4 text-center text-xs text-muted-foreground" data-testid="qr-hint">
        {hint}
      </p>
      {phase === 'success' && <p className="text-sm font-medium text-primary">已登录知乎</p>}
      {phase === 'error' && (
        <Button size="sm" variant="outline" onClick={() => setRefreshTick((t) => t + 1)}>
          <RefreshCw className="mr-1 h-3 w-3" />
          重试
        </Button>
      )}
      <p className="text-center text-[11px] leading-relaxed text-muted-foreground">
        登录态保存在本机应用内置浏览器中（与 Edge/Chrome 同等加密），不会上传；注销即清除。
      </p>
    </div>
  )
}
