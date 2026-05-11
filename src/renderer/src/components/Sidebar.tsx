import { NavLink } from 'react-router'
import {
  Store,
  LayoutDashboard,
  Package,
  Settings
} from 'lucide-react'
import { cn } from '@/lib/utils'

const navItems = [
  { to: '/marketplace', icon: Store, label: '环境市场' },
  { to: '/workspace', icon: LayoutDashboard, label: '我的工作台' },
  { to: '/images', icon: Package, label: '镜像管理' },
  { to: '/settings', icon: Settings, label: '系统设置' }
]

export function Sidebar(): JSX.Element {
  return (
    <aside
      className="flex h-full w-[200px] flex-col border-r flex-shrink-0"
      style={{
        backgroundColor: 'var(--color-bg-primary)',
        borderColor: 'var(--color-border)'
      }}
    >
      <div className="flex h-14 items-center gap-2.5 px-5 border-b" style={{ borderColor: 'var(--color-border)' }}>
        <div
          className="flex h-7 w-7 items-center justify-center rounded-md"
          style={{ backgroundColor: 'var(--color-accent)' }}
        >
          <span className="text-xs font-bold text-white">E</span>
        </div>
        <span className="text-sm font-semibold" style={{ color: 'var(--color-text-primary)' }}>
          EnvManager
        </span>
      </div>

      <nav className="flex-1 px-3 py-4 space-y-0.5">
        {navItems.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            className={({ isActive }) =>
              cn(
                'flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm transition-colors',
                isActive
                  ? 'font-medium'
                  : 'hover:bg-black/5'
              )
            }
            style={({ isActive }) =>
              isActive
                ? {
                    backgroundColor: 'var(--color-accent-light)',
                    color: 'var(--color-accent-hover)'
                  }
                : {
                    color: 'var(--color-text-secondary)'
                  }
            }
          >
            <item.icon size={17} />
            <span>{item.label}</span>
          </NavLink>
        ))}
      </nav>

      <div className="px-5 pb-5" style={{ color: 'var(--color-text-muted)' }}>
        <p className="text-xs">v0.1.0 MVP</p>
      </div>
    </aside>
  )
}
