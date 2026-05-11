import { Outlet } from 'react-router'
import { Sidebar } from '@/components/Sidebar'
import { Header } from '@/components/Header'

export function AppLayout(): JSX.Element {
  return (
    <div className="flex h-full">
      <Sidebar />
      <div className="flex flex-1 flex-col min-w-0">
        <Header />
        <main
          className="flex-1 overflow-auto"
          style={{ backgroundColor: 'var(--color-bg-content)' }}
        >
          <Outlet />
        </main>
      </div>
    </div>
  )
}
