import { useState } from 'react'
import { Input } from '../ui'
import { useI18n } from '../../i18n'

/**
 * A password box with a "show" toggle.
 *
 * The auth logs from the beta show the same shape twice: a person
 * confirms their email and then fails to sign in seven times in a
 * row. That is not a forgotten password ten seconds after choosing
 * it — it is a password typed on an Arabic keyboard layout, or with
 * caps lock on, that nobody could see. Letting them look is cheaper
 * than a reset flow.
 */
export default function PasswordInput({ className = '', ...props }) {
  const { t } = useI18n()
  const [shown, setShown] = useState(false)

  return (
    // Explicit width so the toggle's positioning box is the row, not
    // whatever a parent flex container decides to give a bare div.
    <div className="relative w-full">
      <Input {...props} type={shown ? 'text' : 'password'} className={`pe-16 ${className}`} />
      <button
        type="button"
        onClick={() => setShown((s) => !s)}
        aria-pressed={shown}
        className="absolute inset-y-0 end-3 text-xs text-text-secondary hover:text-text"
      >
        {shown ? t('auth.hidePassword') : t('auth.showPassword')}
      </button>
    </div>
  )
}
