import { useI18n } from '../i18n'
import { useAuth } from '../lib/AuthContext'

/**
 * The DEMO mark.
 *
 * It answers one question, everywhere the same way: is this a real
 * client or teaching material? In a classroom the two sit side by side
 * in the same list, and a student who cannot tell them apart will
 * eventually practise on somebody's real project.
 *
 * Deliberately small and unstyled-looking. It is a label, not a
 * decoration — if it competes with the client's name for attention it
 * will get ignored, which is the one thing it must not do.
 *
 * Renders nothing unless the record is demo, so call sites can drop it
 * in without a conditional:
 *
 *     <DemoBadge on={contact} />
 */
export default function DemoBadge({ on, className = '' }) {
  const { t } = useI18n()
  const { settings } = useAuth()

  if (!on?.is_demo) return null
  // A workspace that exists to show the product off — not a classroom —
  // has the mark switched off in studio_settings (by hand, no UI).
  if (settings?.hide_demo_badge) return null

  return (
    <span
      title={t('demo.tooltip')}
      className={
        // 6px, not the 18px card radius: an 18px corner on a badge this
        // small renders as an oval. The sweep that introduced the card
        // radius caught this by pattern and it was wrong here.
        'inline-flex shrink-0 items-center rounded-[6px] border border-separator ' +
        'px-1.5 py-0.5 text-[11px] font-medium ' +
        `text-text-secondary ${className}`
      }
    >
      {t('demo.badge')}
    </span>
  )
}
