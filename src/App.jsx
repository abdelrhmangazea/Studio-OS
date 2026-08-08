import { useEffect, useState } from 'react'
import { Navigate, Route, Routes } from 'react-router-dom'
import { useAuth } from './lib/AuthContext'
import { isStrandedRecoveryLink } from './lib/authLink'
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
import Portal from './pages/Portal'
import AuthCallback from './pages/AuthCallback'
import ForgotPassword from './pages/ForgotPassword'
import ResetPassword from './pages/ResetPassword'
import Terms from './pages/Terms'
import Privacy from './pages/Privacy'
import Dashboard from './pages/Dashboard'
import Tasks from './pages/Tasks'
import Suppliers from './pages/Suppliers'
import Reports from './pages/Reports'
import Admin from './pages/Admin'
import Help from './pages/Help'

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

/**
 * A recovery link that landed on the wrong path.
 *
 * Supabase drops the path when it falls back to Site URL, so the link
 * arrives at "/" with the token still in the fragment. Without this
 * the person is quietly signed in and shown the dashboard, having
 * asked to change their password. Move them to the reset screen and
 * keep the fragment, which is what carries the session.
 */
function useRecoveryRescue() {
  const [rescued, setRescued] = useState(false)

  useEffect(() => {
    if (isStrandedRecoveryLink()) {
      window.location.replace(`/auth/reset${window.location.hash}`)
      setRescued(true)
    }
  }, [])

  return rescued
}

export default function App() {
  // Runs before anything renders a route, so the dashboard never
  // flashes up in place of the password form.
  if (useRecoveryRescue()) return <Loading />

  return (
    <Routes>
      {/* Public, no login, outside the app shell entirely. */}
      <Route path="/book/:slug" element={<PublicBooking />} />
      <Route path="/booking/:token" element={<BookingConfirmation />} />
      <Route path="/portal/:token" element={<Portal />} />

      {/* Where every emailed link lands. Must be whitelisted in
          Authentication → URL Configuration. */}
      <Route path="/auth/callback" element={<AuthCallback />} />
      <Route path="/auth/reset" element={<ResetPassword />} />
      <Route path="/forgot-password" element={<ForgotPassword />} />
      <Route path="/terms" element={<Terms />} />
      <Route path="/privacy" element={<Privacy />} />

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
        <Route path="/dashboard" element={<Dashboard />} />
        <Route path="/leads" element={<Leads />} />
        <Route path="/clients" element={<Clients />} />
        <Route path="/contacts/:id" element={<Contact />} />
        <Route path="/projects" element={<Projects />} />
        <Route path="/projects/:id" element={<ProjectWorkspace />} />
        <Route path="/tasks" element={<Tasks />} />
        <Route path="/templates" element={<Templates />} />
        <Route path="/generate/:key/:contactId" element={<Generator />} />
        <Route path="/booking-setup" element={<BookingHome />} />
        <Route path="/suppliers" element={<Suppliers />} />
        <Route path="/reports" element={<Reports />} />
        <Route path="/help" element={<Help />} />
        <Route path="/settings" element={<Settings />} />

        {/* Internal. Not linked from the sidebar. The database refuses
            it to anyone not in platform_admins, so the route being
            reachable is not what keeps it closed. */}
        <Route path="/admin" element={<Admin />} />
      </Route>

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}
