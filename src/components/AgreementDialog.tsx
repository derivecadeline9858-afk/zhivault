import { useState } from 'react'
import { Button } from '@/components/ui/button'

/**
 * 首次启动协议弹层（PRD §8-8）：不可跳过、无关闭入口，勾选同意后才可进入。
 * 版本键 zhivault.agreement.v1 —— 协议内容变更时递增以重新征求同意。
 */
export function AgreementDialog({ onAccept }: { onAccept: () => void }) {
  const [checked, setChecked] = useState(false)

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50">
      <div data-testid="agreement-dialog" className="w-[560px] rounded-xl border border-border bg-card p-6 shadow-xl">
        <h2 className="mb-4 text-lg font-semibold">使用协议（首次启动必须同意）</h2>
        <div data-testid="agreement-body" className="max-h-72 space-y-2 overflow-y-auto rounded bg-muted p-4 text-sm leading-relaxed">
          <p>欢迎使用知藏 ZhiVault（作者：橙茶星）。继续使用前请阅读并同意：</p>
          <ol className="list-decimal space-y-1 pl-5">
            <li>本软件仅限个人学习存档使用，不得用于内容再分发或任何商业采集服务。</li>
            <li>内置限速（默认 ≤1 req/s）且不可关闭到危险值；采集须遵守频率自律。</li>
            <li>不触碰盐选等付费内容；不破解、不绕过知乎的人机验证与付费墙，触发风控会自动减速并提示。</li>
            <li>你的凭据经 Windows DPAPI 加密后仅保存在本机；注销将删除全部凭据数据。</li>
            <li>更新包将经 Ed25519 签名校验，校验失败拒绝安装。</li>
          </ol>
        </div>
        <label className="mt-4 flex items-center gap-2 text-sm">
          <input type="checkbox" checked={checked} onChange={(e) => setChecked(e.target.checked)} />
          我已阅读并同意上述协议
        </label>
        <div className="mt-4 flex justify-end">
          <Button disabled={!checked} onClick={onAccept}>
            同意并进入
          </Button>
        </div>
      </div>
    </div>
  )
}
