import { Outlet } from 'react-router-dom'
import Sidebar from './Sidebar'
import TopBar from './TopBar'
import { useAuth } from '../lib/AuthContext'

export default function AppShell() {
  const { settings } = useAuth()

  return (
    <div className="flex h-screen bg-bg">
      <Sidebar studioName={settings?.studio_name} />

      <div className="flex min-w-0 flex-1 flex-col">
        <TopBar />
        <main className="flex-1 overflow-y-auto p-6">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
