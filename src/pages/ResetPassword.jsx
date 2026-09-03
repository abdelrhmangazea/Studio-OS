import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../lib/AuthContext'
import { consumeAuthLink, landedOnLocalhost } from '../lib/authLink'
import { errorMessage } from '../lib/errorMessage'
import { useI18n } from '../i18n'
import { Button, Card, ErrorText, Field, Input } from '../components/ui'
import PasswordInput from '../components/auth/PasswordInput'

/**
 * Where the reset link lands.
 *
 * It used to wait 800ms, call getSession(), and blame every failure on
 * the link having expired. That is wrong often enough to matter: the
 * commonest failure is not expiry at all, it is the link coming back
 * to the wrong origin because Supabase's Site URL was never set — and
 * "ask for a new one" sends you round that loop forever.
 */
export default function ResetPassword() {
  const { t } = useI18n()
  const { updatePassword } = useAuth()
  const navigate = useNavigate()

  const [ready, setReady] = useState(null)
  const [failure, setFailure] = useState(null)
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    let cancelled = false
    consumeAuthLink().then(({ session, failure: why }) => {
      if (cancelled) return
      setReady(Boolean(session))
      setFailure(session ? null : why)
    })
    return () => {
      cancelled = true
    }
  }, [])

  async function submit(event) {
    event.preventDefault()
    setBusy(true)
    setError('')

    const { error: why } = await updatePassword(password)
    if (why) setError(errorMessage(why, t))
    else navigate('/', { replace: true })

    setBusy(false)
  }

  // The tell-tale: an emailed link that lands on localhost was not
  // expired, it was redirected to the project's default Site URL.
  // Saying "expired" here would send them round the loop again.
  // Only when GoTrue offered no reason of its own. An otp_expired
  // link opened during local dev is expired, not misrouted.
  const misrouted =
    ready === false && failure?.code === 'no_session' && landedOnLocalhost()

  return (
    <div className="flex min-h-screen items-center justify-center bg-bg p-6">
      <div className="w-full max-w-sm">
        <Card>
          <h1 className="text-xl font-semibold text-text">{t('auth.resetTitle')}</h1>

          {ready === null && (
            <p className="mt-3 text-sm text-text-secondary">{t('common.loading')}</p>
          )}

          {misrouted && (
            <>
              <p className="mt-3 text-sm text-warning">{t('auth.misroutedTitle')}</p>
              <p className="mt-2 text-sm text-text-secondary">{t('auth.misroutedBody')}</p>
            </>
          )}

          {ready === false && !misrouted && (
            <>
              <p className="mt-3 text-sm text-text-secondary">{t('auth.linkDeadBody')}</p>
              {failure?.description && (
                <p className="mt-2 text-xs text-text-secondary" dir="ltr">
                  {failure.description}
                </p>
              )}
              <a
                href="/forgot-password"
                className="mt-4 inline-block text-sm text-accent hover:underline"
              >
                {t('auth.sendResetLink')}
              </a>
            </>
          )}

          {ready === true && (
            <form onSubmit={submit} className="mt-4 space-y-4">
              <Field label={t('auth.newPassword')} hint={t('auth.passwordHint')}>
                <PasswordInput
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  minLength={6}
                  autoComplete="new-password"
                />
              </Field>
              <ErrorText>{error}</ErrorText>
              <Button type="submit" disabled={busy} className="w-full">
                {busy ? t('common.saving') : t('auth.setNewPassword')}
              </Button>
            </form>
          )}
        </Card>
      </div>
    </div>
  )
}
