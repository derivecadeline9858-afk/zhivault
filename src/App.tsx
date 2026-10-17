import { useState } from 'react'
import { AgreementDialog } from '@/components/AgreementDialog'
import { AppShell } from '@/components/AppShell'
import { Splash } from '@/components/Splash'

const AGREEMENT_KEY = 'zhivault.agreement.v1'

export default function App() {
  const [showSplash, setShowSplash] = useState(true)
  const [agreed, setAgreed] = useState(() => localStorage.getItem(AGREEMENT_KEY) === '1')

  if (showSplash) {
    return <Splash onDone={() => setShowSplash(false)} />
  }

  // 首次启动协议（PRD §8-8）：不可跳过，同意前不渲染应用本体
  if (!agreed) {
    return (
      <AgreementDialog
        onAccept={() => {
          localStorage.setItem(AGREEMENT_KEY, '1')
          setAgreed(true)
        }}
      />
    )
  }

  return <AppShell />
}
