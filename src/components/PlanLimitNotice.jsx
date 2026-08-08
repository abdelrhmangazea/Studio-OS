import { Link } from 'react-router-dom'
import { parsePlanRefusal, planRefusalMessage } from '../lib/planLimits'
import { errorMessage } from '../lib/errorMessage'
import { useI18n } from '../i18n'

/**
 * What a designer sees when they hit a plan limit.
 *
 * FOUR THINGS THIS HAS TO GET RIGHT
 *
 * 1. It names the limit AND the plan that lifts it. "You have reached
 *    your limit" leaves somebody with nowhere to go, which is a dead
 *    end with extra words.
 *
 * 2. It sits INSIDE the form, alongside what they were typing. It is
 *    a component the panel renders, not a modal that replaces it and
 *    not a redirect. Nothing they wrote is lost, because nothing is
 *    unmounted — the panel stays open and they can adjust and retry,
 *    or copy their text out.
 *
 * 3. It persists. A toast that fades after four seconds is a message
 *    for somebody who was already looking at that corner of the
 *    screen. Somebody who just lost a click deserves to still be able
 *    to read why.
 *
 * 4. The link goes somewhere real — Settings, where the plan and the
 *    promo code field are. Never a button that does nothing.
 *
 * Anything that is NOT a plan refusal falls through to the ordinary
 * error text, so this can be dropped in wherever an ErrorText was
 * without having to know which kind of failure will arrive.
 */
export default function PlanLimitNotice({ failure, onDismiss }) {
  const { t } = useI18n()
  if (!failure) return null

  const refusal = parsePlanRefusal(failure)

  // Not a plan thing — behave exactly like the error line it replaced.
  if (!refusal) {
    return (
      <p className="mt-2 text-sm text-danger">
        {typeof failure === 'string' ? failure : errorMessage(failure, t)}
      </p>
    )
  }

  return (
    <div className="mt-3 rounded border border-accent/50 bg-accent/10 p-3">
      <p className="text-sm text-text">{planRefusalMessage(refusal, t)}</p>

      {refusal.kind !== 'readonly' && (
        <div className="mt-2 flex flex-wrap items-center gap-3">
          <Link
            to="/settings#subscription"
            className="text-sm text-accent underline hover:no-underline"
          >
            {t('plan.seePlans')}
          </Link>
          <span className="text-xs text-text-secondary">{t('plan.nothingLost')}</span>
        </div>
      )}

      {onDismiss && (
        <button
          type="button"
          onClick={onDismiss}
          className="mt-2 text-xs text-text-secondary hover:text-text"
        >
          {t('common.close')}
        </button>
      )}
    </div>
  )
}
