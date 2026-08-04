import { useEffect, useState } from 'react'
import { NavLink } from 'react-router-dom'
import { countUnseenBookings } from '../lib/booking'
import { useI18n } from '../i18n'

/**
 * The ten top-level screens.
 *
 * The sidebar sits on the left in English and on the right in Arabic.
 * That mirroring is not coded here — it comes from dir="rtl" on the
 * document plus `border-e` (border on the inline *end*), which the
 * browser flips automatically.
 */

export const NAV_ITEMS = [
  { to: '/dashboard', key: 'nav.dashboard' },
  { to: '/leads', key: 'nav.leads' },
  { to: '/clients', key: 'nav.clients' },
  { to: '/projects', key: 'nav.projects' },
  { to: '/tasks', key: 'nav.tasks' },
  { to: '/templates', key: 'nav.templates' },
  { to: '/booking-setup', key: 'nav.bookingSetup' },
  { to: '/suppliers', key: 'nav.suppliers' },
  { to: '/reports', key: 'nav.reports' },
  { to: '/settings', key: 'nav.settings' },
]

export default function Sidebar({ studioName }) {
  const { t } = useI18n()
  const [unseen, setUnseen] = useState(0)

  // New bookings are "unseen" until opened. This count IS the notification.
  useEffect(() => {
    let stop = false
    const check = () => countUnseenBookings().then((n) => !stop && setUnseen(n))
    check()
    const timer = setInterval(check, 60000)
    return () => {
      stop = true
      clearInterval(timer)
    }
  }, [])

  return (
    <aside className="flex w-60 shrink-0 flex-col border-e border-border bg-surface">
      <div className="border-b border-border px-5 py-5">
        <div className="text-sm font-semibold text-text">{studioName || t('app.name')}</div>
        <div className="text-xs text-text-secondary">{t('app.name')}</div>
      </div>

      <nav className="flex flex-1 flex-col gap-0.5 p-3">
        {NAV_ITEMS.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            className={({ isActive }) =>
              'rounded px-3 py-2 text-sm transition-colors ' +
              (isActive
                ? 'bg-accent text-white'
                : 'text-text-secondary hover:bg-bg hover:text-text')
            }
          >
            <span className="flex items-center justify-between gap-2">
              {t(item.key)}
              {item.to === '/booking-setup' && unseen > 0 && (
                <span className="rounded-full bg-accent px-1.5 py-0.5 text-xs text-white">
                  {unseen}
                </span>
              )}
            </span>
          </NavLink>
        ))}
      </nav>
    </aside>
  )
}
