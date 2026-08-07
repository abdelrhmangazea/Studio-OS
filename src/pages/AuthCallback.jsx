import { useEffect, useState } from 'react'
import { Navigate } from 'react-router-dom'
import { consumeAuthLink, landedOnLocalhost } from '../lib/authLink'
import { useI18n } from '../i18n'
import { Card } from '../components/ui'

/**
 * Where every emailed link lands: confirmation, and email change.
 *
 * Reads whatever shape the link arrived in and says what actually went
 * wrong. A link that lands on a spinner forever is the same as a link
 * that lands nowhere — and a link that blames "expired" when the real
 * cause is an unset Site URL is worse than both, because it sends you
 * round the loop again.
 */
export default function AuthCallback() {
  const { t } = useI18n()
  const [state, setState] = useState('working')
  const [failure, setFailure] = useState(null)

  useEffect(() => {
    let cancelled = false
    consumeAuthLink().then(({ session, failure: why }) => {
      if (cancelled) return
      setState(session ? 'done' : 'failed')
      setFailure(why)
    })
    return () => {
      cancelled = true
    }
  }, [])

  if (state === 'done') return <Navigate to="/" replace />

  // Only when GoTrue offered no reason of its own.
  const misrouted =
    state === 'failed' && failure?.code === 'no_session' && landedOnLocalhost()

  return (
    <div className="flex min-h-screen items-center justify-center bg-bg p-6">
      <div className="w-full max-w-sm">
        <Card>
          {state === 'working' ? (
            <p className="text-sm text-text-secondary">{t('auth.confirming')}</p>
          ) : misrouted ? (
            <>
              <h1 className="text-lg font-semibold text-text">{t('auth.misroutedTitle')}</h1>
              <p className="mt-2 text-sm text-text-secondary">{t('auth.misroutedBody')}</p>
            </>
          ) : (
            <>
              <h1 className="text-lg font-semibold text-text">{t('auth.linkDeadTitle')}</h1>
              <p className="mt-2 text-sm text-text-secondary">{t('auth.linkDeadBody')}</p>
              {failure?.description && (
                <p className="mt-2 text-xs text-text-secondary" dir="ltr">
                  {failure.description}
                </p>
              )}
              <a href="/login" className="mt-4 inline-block text-sm text-accent hover:underline">
                {t('auth.signIn')}
              </a>
            </>
          )}
        </Card>
      </div>
    </div>
  )
}
