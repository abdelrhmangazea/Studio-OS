import { useEffect, useState } from 'react'
import { useI18n } from '../../i18n'
import { errorMessage } from '../../lib/errorMessage'

/**
 * "Send the link again", with the wait made visible.
 *
 * Supabase Auth refuses a second send inside 60 seconds and answers
 * 429. One beta tester pressed the old button eight times in fifty
 * seconds and got eight refusals; another pressed it after 24 seconds,
 * assumed the account was broken, and registered again with a second
 * address. The countdown mirrors the server's rule so the button can
 * never be pressed into a 429.
 *
 * The note underneath matters as much as the timer: a resend replaces
 * the earlier link, and a person who then opens the FIRST email lands
 * on "link expired" — which is what happened to the tester we lost.
 */
const COOLDOWN = 60

export default function ResendLink({ onResend, onError, initialWait = COOLDOWN }) {
  const { t } = useI18n()
  const [left, setLeft] = useState(initialWait)

  useEffect(() => {
    if (left <= 0) return undefined
    const id = setTimeout(() => setLeft((s) => s - 1), 1000)
    return () => clearTimeout(id)
  }, [left])

  async function click() {
    onError('')
    const { error } = await onResend()
    if (error) {
      onError(errorMessage(error, t))
      return
    }
    setLeft(COOLDOWN)
  }

  return (
    <div className="mt-2">
      <button
        type="button"
        disabled={left > 0}
        onClick={click}
        className="text-sm text-accent hover:underline disabled:cursor-default disabled:text-text-secondary disabled:no-underline"
      >
        {left > 0 ? t('auth.resendIn', { s: left }) : t('auth.resend')}
      </button>
      <p className="mt-1 text-xs text-text-secondary">{t('auth.resendNote')}</p>
    </div>
  )
}
