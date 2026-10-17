import { CircleUserRound, CalendarClock, Download, Gauge, House, History, Info, Library, Settings } from 'lucide-react'
import { useEffect, useState } from 'react'
import { NavLink, Route, Routes } from 'react-router-dom'
import { LoginDialog } from '@/components/LoginDialog'
import { AboutPage } from '@/pages/AboutPage'
import { ChangesPage } from '@/pages/ChangesPage'
import { ExportPage } from '@/pages/ExportPage'
import { LibraryPage } from '@/pages/LibraryPage'
import { MonitorPage } from '@/pages/MonitorPage'
import { ReaderPage } from '@/pages/ReaderPage'
import { RunPage } from '@/pages/RunPage'
import { SettingsPage } from '@/pages/SettingsPage'
import { TasksPage } from '@/pages/TasksPage'
import { cn } from '@/lib/utils'
import { sessionStore } from '@/lib/app-store'

const NAV_ITEMS = [
  { to: '/', label: '首页 / 任务', icon: House },
  { to: '/run', label: '运行', icon: Gauge },
  { to: '/library', label: '书架 / 检索', icon: Library },
  { to: '/changes', label: '变更报告', icon: History },
  { to: '/export', label: '导出中心', icon: Download },
  { to: '/monitor', label: '监控计划', icon: CalendarClock },
  { to: '/settings', label: '设置', icon: Settings },
  { to: '/about', label: '关于', icon: Info },
]

export function AppShell() {
  const [loginOpen, setLoginOpen] = useState(false)
  const [loggedIn, setLoggedIn] = useState(sessionStore.loggedIn)

  useEffect(() => {
    const unsub = sessionStore.subscribe(() => setLoggedIn(sessionStore.loggedIn))
    void sessionStore.hydrate()
    return unsub
  }, [])

  return (
    <div className="flex h-screen bg-background text-foreground">
      <aside className="flex w-52 flex-col border-r border-border bg-card p-3">
        <nav className="flex flex-col gap-1">
          {NAV_ITEMS.map(({ to, label, icon: Icon }) => (
            <NavLink
              key={to}
              to={to}
              end={to === '/'}
              className={({ isActive }) =>
                cn(
                  'flex items-center gap-2 rounded-lg px-3 py-2 text-sm transition-colors',
                  isActive
                    ? 'bg-primary text-primary-foreground'
                    : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground',
                )
              }
            >
              <Icon className="h-4 w-4" />
              {label}
            </NavLink>
          ))}
        </nav>
        <button
          id="login-entry"
          onClick={() => setLoginOpen(true)}
          className="mt-auto flex items-center gap-2 rounded-lg border border-border px-3 py-2 text-sm text-muted-foreground hover:bg-accent"
        >
          <CircleUserRound className="h-4 w-4" />
          {loggedIn ? '已登录' : '匿名 · 点击登录'}
        </button>
      </aside>
      <main className="min-w-0 flex-1 overflow-hidden">
        <Routes>
          <Route path="/" element={<TasksPage />} />
          <Route path="/run" element={<RunPage />} />
          <Route path="/library" element={<LibraryPage />} />
          <Route path="/reader/:type/:id" element={<ReaderPage />} />
          <Route path="/changes" element={<ChangesPage />} />
          <Route path="/export" element={<ExportPage />} />
          <Route path="/monitor" element={<MonitorPage />} />
          <Route path="/settings" element={<SettingsPage />} />
          <Route path="/about" element={<AboutPage />} />
        </Routes>
      </main>
      {loginOpen && (
        <LoginDialog
          onClose={() => {
            setLoginOpen(false)
            setLoggedIn(sessionStore.loggedIn)
          }}
        />
      )}
    </div>
  )
}
