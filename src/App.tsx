import { useState } from 'react'
import { AppShell } from '@/components/AppShell'
import { Splash } from '@/components/Splash'

export default function App() {
  const [showSplash, setShowSplash] = useState(true)

  if (showSplash) {
    return <Splash onDone={() => setShowSplash(false)} />
  }

  return <AppShell />
}
