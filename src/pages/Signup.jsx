import { useState } from 'react'
import { Link, Navigate } from 'react-router-dom'
import { useAuth } from '../lib/AuthContext'
import { errorMessage } from '../lib/errorMessage'
import { usePrefs } from '../lib/PrefsContext'
import { useI18n } from '../i18n'
import { Button, Card, ErrorText, Field, Input } from '../components/ui'

export default function Signup() {
  const { session, signUp, resendConfirmation } = useAuth()
  const { theme, language, toggleTheme, toggleLanguage } = usePrefs()
  const { t } = useI18n()

  const [name, setName] = useState('')
  const [studioName, setStudioName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [pending, setPending] = useState(false)
  const [resent, setResent] = useState(false)
  const [busy, setBusy] = useState(false)

  if (session) return <Navigate to="/" replace />

  async function handleSubmit(event) {
    event.preventDefault()
    setBusy(true)
    setError('')
    setPending(false)

    // The signup trigger in the database reads `name` and `studio_name`
    // out of this metadata to build the workspace, profile and settings.
    const { data, error: signUpError } = await signUp(email, password, name, studioName)

    if (signUpError) {
      // Supabase Auth puts its text in `msg`, not `message`. Reading
      // only `.message` is what produced the empty box.
      setError(errorMessage(signUpError, t, 'errors.signUp'))
    } else if (data?.user && !data?.session) {
      // Created, and waiting on the emailed link. This is the normal
      // path now that confirmation is on.
      setPending(true)
    }

    setBusy(false)
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-bg p-6">
      <div className="w-full max-w-sm">
        <div className="mb-4 flex justify-end gap-2">
          <Button variant="ghost" onClick={toggleTheme}>
            {theme === 'dark' ? t('theme.light') : t('theme.dark')}
          </Button>
          <Button variant="ghost" onClick={toggleLanguage}>
            {language === 'ar' ? t('language.en') : t('language.ar')}
          </Button>
        </div>

        <Card>
          <h1 className="text-xl font-semibold text-text">{t('auth.signUpTitle')}</h1>
          <p className="mb-6 mt-1 text-sm text-text-secondary">{t('auth.signUpSubtitle')}</p>

          <form onSubmit={handleSubmit} className="space-y-4">
            <Field label={t('auth.name')}>
              <Input value={name} onChange={(e) => setName(e.target.value)} required />
            </Field>

            <Field label={t('auth.studioName')}>
              <Input
                value={studioName}
                onChange={(e) => setStudioName(e.target.value)}
                required
              />
            </Field>

            <Field label={t('auth.email')}>
              <Input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                autoComplete="email"
              />
            </Field>

            <Field label={t('auth.password')} hint={t('auth.passwordHint')}>
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

            {pending && (
              <div className="rounded border border-border p-3">
                <p className="text-sm text-text">{t('auth.confirmSent', { email })}</p>
                <p className="mt-1 text-xs text-text-secondary">{t('auth.checkSpam')}</p>
                <button
                  type="button"
                  className="mt-2 text-sm text-accent hover:underline disabled:opacity-50"
                  disabled={resent}
                  onClick={async () => {
                    const { error: failure } = await resendConfirmation(email)
                    if (failure) setError(errorMessage(failure, t))
                    else setResent(true)
                  }}
                >
                  {resent ? t('auth.resent') : t('auth.resend')}
                </button>
              </div>
            )}

            <Button type="submit" disabled={busy} className="w-full">
              {busy ? t('common.loading') : t('auth.signUp')}
            </Button>
          </form>

          <p className="mt-6 text-xs text-text-secondary">
            {t('auth.agreeTo')}{' '}
            <Link to="/terms" className="text-accent hover:underline">{t('legal.terms')}</Link>
            {' '}·{' '}
            <Link to="/privacy" className="text-accent hover:underline">{t('legal.privacy')}</Link>
          </p>

          <p className="mt-4 text-sm text-text-secondary">
            {t('auth.haveAccount')}{' '}
            <Link to="/login" className="text-accent hover:underline">
              {t('auth.signIn')}
            </Link>
          </p>
        </Card>
      </div>
    </div>
  )
}
