import { useState } from 'react'
import { Link, Navigate } from 'react-router-dom'
import { useAuth } from '../lib/AuthContext'
import { usePrefs } from '../lib/PrefsContext'
import { useI18n } from '../i18n'
import { Button, Card, ErrorText, Field, Input } from '../components/ui'

export default function Login() {
  const { session, signIn } = useAuth()
  const { theme, language, toggleTheme, toggleLanguage } = usePrefs()
  const { t } = useI18n()

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  if (session) return <Navigate to="/" replace />

  async function handleSubmit(event) {
    event.preventDefault()
    setBusy(true)
    setError('')
    const { error: signInError } = await signIn(email, password)
    if (signInError) setError(t('errors.signIn'))
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
          <h1 className="text-xl font-semibold text-text">{t('auth.signInTitle')}</h1>
          <p className="mb-6 mt-1 text-sm text-text-secondary">{t('auth.signInSubtitle')}</p>

          <form onSubmit={handleSubmit} className="space-y-4">
            <Field label={t('auth.email')}>
              <Input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                autoComplete="email"
              />
            </Field>

            <Field label={t('auth.password')}>
              <Input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                autoComplete="current-password"
              />
            </Field>

            <ErrorText>{error}</ErrorText>

            <Button type="submit" disabled={busy} className="w-full">
              {busy ? t('common.loading') : t('auth.signIn')}
            </Button>
          </form>

          <p className="mt-6 text-sm text-text-secondary">
            {t('auth.noAccount')}{' '}
            <Link to="/signup" className="text-accent hover:underline">
              {t('auth.signUp')}
            </Link>
          </p>
        </Card>
      </div>
    </div>
  )
}
