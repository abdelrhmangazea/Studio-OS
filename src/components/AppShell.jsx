import { Outlet } from 'react-router-dom'
import Sidebar from './Sidebar'
import TopBar from './TopBar'
import FeedbackButton from './FeedbackButton'
import Tour from './Tour'
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

      {/* On every signed-in screen, always in the same corner. */}
      <FeedbackButton />

      {/* First run only, and skippable at every step. */}
      <Tour />
    </div>
  )
}
