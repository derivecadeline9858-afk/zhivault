import { Download, House, Info, Library, Settings } from 'lucide-react'
import { NavLink, Route, Routes } from 'react-router-dom'
import { cn } from '@/lib/utils'
import { AboutPage } from '@/pages/AboutPage'
import { HomePage } from '@/pages/HomePage'
import { PlaceholderPage } from '@/pages/PlaceholderPage'
import { SettingsPage } from '@/pages/SettingsPage'

const NAV_ITEMS = [
  { to: '/', label: '首页 / 任务', icon: House },
  { to: '/library', label: '书架 / 检索', icon: Library },
  { to: '/export', label: '导出中心', icon: Download },
  { to: '/settings', label: '设置', icon: Settings },
  { to: '/about', label: '关于', icon: Info },
]

export function AppShell() {
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
      </aside>
      <main className="min-w-0 flex-1 overflow-y-auto">
        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route path="/library" element={<PlaceholderPage title="书架 / 检索" taskNote="任务 8 实现" />} />
          <Route path="/export" element={<PlaceholderPage title="导出中心" taskNote="任务 4/5 实现" />} />
          <Route path="/settings" element={<SettingsPage />} />
          <Route path="/about" element={<AboutPage />} />
        </Routes>
      </main>
    </div>
  )
}
