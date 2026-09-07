import { Suspense, lazy, useEffect, useState } from 'react'
import { Navigate, Route, Routes } from 'react-router-dom'
import { useAuth } from './lib/AuthContext'
import { isStrandedRecoveryLink } from './lib/authLink'
import { useI18n } from './i18n'
import AppShell from './components/AppShell'
import Login from './pages/Login'
import Signup from './pages/Signup'
import AuthCallback from './pages/AuthCallback'
import ForgotPassword from './pages/ForgotPassword'
import ResetPassword from './pages/ResetPassword'
import Terms from './pages/Terms'
import Privacy from './pages/Privacy'
import AcceptInvite from './pages/AcceptInvite'
import Marketing from './pages/Marketing'

/**
 * Everything behind the front door is loaded on demand.
 *
 * The marketing site is the first thing most people ever load, and
 * most of them arrive from Instagram on a phone. Without this it
 * pulled the entire application with it — the document generator,
 * the PDF and Word pipelines, the whole app — before showing a word
 * of the headline.
 */
const Settings = lazy(() => import('./pages/Settings'))
const Leads = lazy(() => import('./pages/Leads'))
const Clients = lazy(() => import('./pages/Clients'))
const Contact = lazy(() => import('./pages/Contact'))
const Templates = lazy(() => import('./pages/Templates'))
const Projects = lazy(() => import('./pages/Projects'))
const ProjectWorkspace = lazy(() => import('./pages/ProjectWorkspace'))
const Generator = lazy(() => import('./pages/Generator'))
const BookingHome = lazy(() => import('./pages/BookingHome'))
const Dashboard = lazy(() => import('./pages/Dashboard'))
const Tasks = lazy(() => import('./pages/Tasks'))
const Suppliers = lazy(() => import('./pages/Suppliers'))
const Reports = lazy(() => import('./pages/Reports'))
const Admin = lazy(() => import('./pages/Admin'))
const Help = lazy(() => import('./pages/Help'))
const Onboarding = lazy(() => import('./pages/Onboarding'))
const Portal = lazy(() => import('./pages/Portal'))
const PublicBooking = lazy(() => import('./pages/PublicBooking'))
const BookingConfirmation = lazy(() => import('./pages/BookingConfirmation'))

// The dashboard on fixture rows, for checking layout without an
// account. `import.meta.env.DEV` is a build-time constant, so a
// production bundle contains neither the route nor the chunk.
const DashboardPreview = import.meta.env.DEV ? lazy(() => import('./dev/DashboardPreview')) : null

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

/** Marketing for visitors, dashboard for studios. */
function RootRoute() {
  const { session, loading } = useAuth()
  if (loading) return <Loading />
  return session ? <Navigate to="/dashboard" replace /> : <Marketing />
}

export default function App() {
  // Runs before anything renders a route, so the dashboard never
  // flashes up in place of the password form.
  if (useRecoveryRescue()) return <Loading />

  return (
    <Suspense fallback={<Loading />}>
    <Routes>
      {/* The public site owns the root. A signed-in studio never sees
          it — RootRoute sends them to their dashboard instead. */}
      <Route path="/" element={<RootRoute />} />

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

      {/* An invite link. Peeking does not consume it, so signing up
          and coming back to the same link works. */}
      <Route path="/invite/:token" element={<AcceptInvite />} />

      {DashboardPreview && <Route path="/dev/dashboard" element={<DashboardPreview />} />}

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
    </Suspense>
  )
}
