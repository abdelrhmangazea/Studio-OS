import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { mySubscription } from '../lib/subscription'
import { useI18n } from '../i18n'

/**
 * Fourteen days, then three.
 *
 * The database decides when to warn — my_subscription() returns
 * `warn` as 14, 3 or null — so the two thresholds live in one place
 * rather than being recomputed from a date in the browser, where
 * they would quietly disagree with whatever the server thinks.
 *
 * At three days it stops being informational and turns amber. It is
 * never dismissible: losing access is not something to be tidied
 * away, and it stops appearing on its own the moment there is
 * nothing to warn about.
 */
export default function PlanExpiryBanner() {
  const { t } = useI18n()
  const [sub, setSub] = useState(null)

  useEffect(() => {
    mySubscription().then(setSub).catch(() => setSub(null))
  }, [])

  if (!sub?.warn) return null

  const urgent = sub.warn === 3

  return (
    <div
      className={`border-b px-6 py-2 text-sm ${
        urgent
          ? 'border-warning/40 bg-warning/10 text-text'
          : 'border-separator bg-surface text-text-secondary'
      }`}
    >
      <span>
        {t(urgent ? 'plan.expiring3' : 'plan.expiring14', { days: sub.days_remaining })}
      </span>{' '}
      {/* Said in the banner itself, not only on the settings page.
          The fear when access ends is losing the work, and that is
          exactly what does not happen. */}
      <span className="text-xs">{t('plan.expiryReassurance')}</span>{' '}
      <Link to="/settings#subscription" className="text-accent underline hover:no-underline">
        {t('plan.seePlans')}
      </Link>
    </div>
  )
}
