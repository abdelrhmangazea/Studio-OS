import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../lib/AuthContext'
import { errorMessage } from '../lib/errorMessage'
import { useI18n } from '../i18n'
import { Button, Card, ErrorText, Field, Input } from '../components/ui'

/**
 * Where the reset link lands.
 *
 * The link carries a short-lived session in the URL fragment. If it has
 * expired, this says so and offers a new one rather than showing a form
 * that will fail on submit.
 */
export default function ResetPassword() {
  const { t } = useI18n()
  const { updatePassword } = useAuth()
  const navigate = useNavigate()

  const [ready, setReady] = useState(null)
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    const timer = setTimeout(async () => {
      const { data } = await supabase.auth.getSession()
      setReady(Boolean(data?.session))
    }, 800)
    return () => clearTimeout(timer)
  }, [])

  async function submit(event) {
    event.preventDefault()
    setBusy(true)
    setError('')

    const { error: failure } = await updatePassword(password)
    if (failure) setError(errorMessage(failure, t))
    else navigate('/', { replace: true })

    setBusy(false)
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-bg p-6">
      <div className="w-full max-w-sm">
        <Card>
          <h1 className="text-xl font-semibold text-text">{t('auth.resetTitle')}</h1>

          {ready === null && (
            <p className="mt-3 text-sm text-text-secondary">{t('common.loading')}</p>
          )}

          {ready === false && (
            <>
              <p className="mt-3 text-sm text-text-secondary">{t('auth.linkDeadBody')}</p>
              <a href="/forgot-password" className="mt-4 inline-block text-sm text-accent hover:underline">
                {t('auth.sendResetLink')}
              </a>
            </>
          )}

          {ready === true && (
            <form onSubmit={submit} className="mt-4 space-y-4">
              <Field label={t('auth.newPassword')} hint={t('auth.passwordHint')}>
                <Input
                  type="password"
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
