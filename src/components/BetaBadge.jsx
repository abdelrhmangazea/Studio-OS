import { supabase } from '../lib/supabase'
import { useAuth } from '../lib/AuthContext'
import { useI18n } from '../i18n'

/**
 * The Beta badge.
 *
 * It says the thing out loud — this is a beta, some of it will be
 * rough — so nobody has to guess whether a problem is theirs. And it
 * is dismissible, because a permanent banner stops being information
 * after the second day and becomes furniture.
 *
 * Dismissal lives on the profile rather than in localStorage so it
 * follows the person to their other machine, and so it is per user:
 * one member hiding it does not hide it for the owner.
 */
export default function BetaBadge() {
  const { profile, refresh } = useAuth()
  const { t } = useI18n()

  if (!profile || profile.beta_badge_dismissed) return null

  async function dismiss() {
    await supabase
      .from('profiles')
      .update({ beta_badge_dismissed: true })
      .eq('id', profile.id)

    await refresh()
  }

  return (
    <span className="flex items-center gap-1 rounded-full border border-accent/50 bg-accent/10 px-2 py-0.5 text-xs text-text">
      <span title={t('beta.tooltip')}>{t('beta.label')}</span>
      <button
        type="button"
        onClick={dismiss}
        title={t('beta.dismiss')}
        aria-label={t('beta.dismiss')}
        className="text-text-secondary hover:text-text"
      >
        ×
      </button>
    </span>
  )
}
