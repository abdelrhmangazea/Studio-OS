import { Button, ErrorText } from '../ui'
import { useI18n } from '../../i18n'

/**
 * The save control for a settings screen, shown at BOTH ends of it.
 *
 * A settings page is long. Scrolling to the bottom to save something
 * you changed at the top — then scrolling back to check it took — is
 * the kind of small friction that makes people stop trusting that the
 * change saved at all.
 *
 * Both copies drive the same handler and the same state, so they are
 * genuinely one control rendered twice, not two that can disagree.
 * `place` only affects spacing; the top copy sits under the heading and
 * the bottom copy closes the form.
 */
export default function SaveBar({ onSave, busy, saved, error, disabled, place = 'bottom' }) {
  const { t } = useI18n()

  return (
    <div
      className={
        'flex flex-wrap items-center gap-3 ' + (place === 'top' ? 'mb-6' : 'mb-8 mt-2')
      }
    >
      <Button onClick={onSave} disabled={disabled || busy}>
        {busy ? t('common.saving') : t('common.save')}
      </Button>

      {saved && <span className="t-body text-success">{t('common.saved')}</span>}
      {error && <ErrorText>{error}</ErrorText>}
    </div>
  )
}
