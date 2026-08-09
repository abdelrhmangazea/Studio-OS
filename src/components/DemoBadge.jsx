import { useI18n } from '../i18n'

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

  if (!on?.is_demo) return null

  return (
    <span
      title={t('demo.tooltip')}
      className={
        'inline-flex shrink-0 items-center rounded-card border border-separator ' +
        'px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide ' +
        `text-text-secondary ${className}`
      }
    >
      {t('demo.badge')}
    </span>
  )
}
