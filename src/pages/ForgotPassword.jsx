import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../lib/AuthContext'
import { errorMessage } from '../lib/errorMessage'
import { useI18n } from '../i18n'
import { Button, Card, ErrorText, Field, Input } from '../components/ui'

/**
 * Asks for the reset link.
 *
 * It says the same thing whether or not the address exists. Telling a
 * stranger "no account with that email" hands them a way to find out
 * who has an account here.
 */
export default function ForgotPassword() {
  const { t } = useI18n()
  const { requestPasswordReset } = useAuth()

  const [email, setEmail] = useState('')
  const [sent, setSent] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  async function submit(event) {
    event.preventDefault()
    setBusy(true)
    setError('')

    const { error: failure } = await requestPasswordReset(email)

    // A genuine send failure is worth showing; "no such user" is not,
    // and Supabase does not distinguish them here by design.
    if (failure && /smtp|sending/i.test(failure.msg ?? failure.message ?? '')) {
      setError(errorMessage(failure, t))
    } else {
      setSent(true)
    }
    setBusy(false)
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-bg p-6">
      <div className="w-full max-w-sm">
        <Card>
          <h1 className="text-xl font-semibold text-text">{t('auth.forgotTitle')}</h1>

          {sent ? (
            <>
              <p className="mt-3 text-sm text-text">{t('auth.resetSent', { email })}</p>
              <p className="mt-2 text-xs text-text-secondary">{t('auth.checkSpam')}</p>
            </>
          ) : (
            <>
              <p className="mb-6 mt-1 text-sm text-text-secondary">{t('auth.forgotSubtitle')}</p>
              <form onSubmit={submit} className="space-y-4">
                <Field label={t('auth.email')}>
                  <Input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    autoComplete="email"
                  />
                </Field>
                <ErrorText>{error}</ErrorText>
                <Button type="submit" disabled={busy} className="w-full">
                  {busy ? t('common.loading') : t('auth.sendResetLink')}
                </Button>
              </form>
            </>
          )}

          <p className="mt-6 text-sm text-text-secondary">
            <Link to="/login" className="text-accent hover:underline">{t('auth.backToSignIn')}</Link>
          </p>
        </Card>
      </div>
    </div>
  )
}
