import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { sessionStore } from '@/lib/app-store'
import type { EntityType } from '@/core/zhihu/url-parser'
import { requiredLoginLevel } from '@/core/zhihu/visibility'
import { QrLoginSection } from '@/components/QrLoginSection'

const TYPE_LABELS: [EntityType, string][] = [
  ['answer', '回答'],
  ['article', '文章'],
  ['pin', '想法'],
  ['question', '问题'],
  ['collection', '收藏夹'],
  ['column', '专栏'],
  ['topic', '话题'],
]

export function LoginDialog({ onClose }: { onClose: () => void }) {
  const [confirming, setConfirming] = useState(false)

  const logout = () => {
    void sessionStore.logout().then(() => {
      setConfirming(false)
      onClose()
    })
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={onClose}>
      <div
        data-testid="login-dialog"
        className="w-[720px] rounded-xl border border-border bg-card p-6 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="mb-4 text-lg font-semibold">选择采集方式</h2>
        <div className="grid grid-cols-2 gap-4">
          <section className="rounded-lg border border-border p-4">
            <h3 className="mb-2 font-medium">匿名采集</h3>
            <p className="mb-3 text-xs text-muted-foreground">免登录可采公开内容：</p>
            <ul className="space-y-1 text-sm">
              {TYPE_LABELS.map(([type, label]) => (
                <li key={type} className="flex items-center gap-2">
                  <span className="text-primary">✓</span>
                  {label}
                  {requiredLoginLevel(type) === 'login' && <span className="text-xs text-muted-foreground">（需登录）</span>}
                </li>
              ))}
              <li className="flex items-center gap-2">
                <span className="text-primary">✓</span>用户公开创作
              </li>
              <li className="flex items-center gap-2 text-muted-foreground">
                <span>✗</span>用户赞同动态（登录后可用）
              </li>
            </ul>
          </section>
          <section className="rounded-lg border border-border p-4">
            <h3 className="mb-2 font-medium">登录采集（扫码登录）</h3>
            {sessionStore.loggedIn ? (
              <p className="py-8 text-center text-sm text-muted-foreground">
                当前已登录知乎
                <br />
                如需更换账号，请先注销后再扫码。
              </p>
            ) : (
              <QrLoginSection onClose={onClose} />
            )}
          </section>
        </div>
        <div className="mt-4 flex items-center justify-between border-t border-border pt-4">
          {sessionStore.loggedIn ? (
            confirming ? (
              <div className="flex items-center gap-2">
                <span className="text-sm text-destructive">确认注销？将清除本机登录态</span>
                <Button size="sm" variant="destructive" onClick={logout}>
                  确认注销
                </Button>
                <Button size="sm" variant="ghost" onClick={() => setConfirming(false)}>
                  再想想
                </Button>
              </div>
            ) : (
              <Button size="sm" variant="destructive" onClick={() => setConfirming(true)}>
                注销并清除凭据
              </Button>
            )
          ) : (
            <span className="text-xs text-muted-foreground">当前：匿名（公开内容可直接采集）</span>
          )}
          <Button variant="ghost" onClick={onClose}>
            关闭
          </Button>
        </div>
      </div>
    </div>
  )
}
