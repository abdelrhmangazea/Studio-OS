import { Navigate, Route, Routes } from 'react-router-dom'
import { useAuth } from './lib/AuthContext'
import { useI18n } from './i18n'
import AppShell from './components/AppShell'
import Login from './pages/Login'
import Signup from './pages/Signup'
import Onboarding from './pages/Onboarding'
import Settings from './pages/Settings'
import Leads from './pages/Leads'
import Clients from './pages/Clients'
import Contact from './pages/Contact'
import Templates from './pages/Templates'
import Projects from './pages/Projects'
import ProjectWorkspace from './pages/ProjectWorkspace'
import Generator from './pages/Generator'
import BookingHome from './pages/BookingHome'
import PublicBooking from './pages/PublicBooking'
import BookingConfirmation from './pages/BookingConfirmation'
import Placeholder from './pages/Placeholder'

function Loading() {
  const { t } = useI18n()
  return (
    <div className="flex min-h-screen items-center justify-center bg-bg">
      <p className="text-sm text-text-secondary">{t('common.loading')}</p>
    </div>
  )
}

/** Signed out → sign-in screen. Onboarding not done → the wizard. */
function RequireStudio({ children }) {
  const { session, workspace, loading } = useAuth()

  if (loading) return <Loading />
  if (!session) return <Navigate to="/login" replace />
  if (workspace && !workspace.onboarding_complete) return <Navigate to="/onboarding" replace />

  return children
}

function RequireAuth({ children }) {
  const { session, loading } = useAuth()

  if (loading) return <Loading />
  if (!session) return <Navigate to="/login" replace />

  return children
}

export default function App() {
  return (
    <Routes>
      {/* Public, no login, outside the app shell entirely. */}
      <Route path="/book/:slug" element={<PublicBooking />} />
      <Route path="/booking/:token" element={<BookingConfirmation />} />

      <Route path="/login" element={<Login />} />
      <Route path="/signup" element={<Signup />} />

      <Route
        path="/onboarding"
        element={
          <RequireAuth>
            <Onboarding />
          </RequireAuth>
        }
      />

      <Route
        element={
          <RequireStudio>
            <AppShell />
          </RequireStudio>
        }
      >
        <Route path="/" element={<Navigate to="/dashboard" replace />} />
        <Route path="/dashboard" element={<Placeholder titleKey="nav.dashboard" />} />
        <Route path="/leads" element={<Leads />} />
        <Route path="/clients" element={<Clients />} />
        <Route path="/contacts/:id" element={<Contact />} />
        <Route path="/projects" element={<Projects />} />
        <Route path="/projects/:id" element={<ProjectWorkspace />} />
        <Route path="/tasks" element={<Placeholder titleKey="nav.tasks" />} />
        <Route path="/templates" element={<Templates />} />
        <Route path="/generate/:key/:contactId" element={<Generator />} />
        <Route path="/booking-setup" element={<BookingHome />} />
        <Route path="/suppliers" element={<Placeholder titleKey="nav.suppliers" />} />
        <Route path="/reports" element={<Placeholder titleKey="nav.reports" />} />
        <Route path="/settings" element={<Settings />} />
      </Route>

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}
