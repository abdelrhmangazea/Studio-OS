import { useEffect, useState } from 'react'
import { Navigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useI18n } from '../i18n'
import { Card } from '../components/ui'

/**
 * Where every emailed link lands: confirmation, and email change.
 *
 * Supabase puts the session in the URL fragment and the client library
 * picks it up on load. All this screen does is wait for that to settle,
 * then send the user somewhere real — a link that lands on a spinner
 * forever is the same as a link that lands nowhere.
 */
export default function AuthCallback() {
  const { t } = useI18n()
  const [state, setState] = useState('working')

  useEffect(() => {
    // An error comes back in the fragment too, not as a thrown error.
    const fragment = new URLSearchParams(window.location.hash.slice(1))
    if (fragment.get('error')) {
      setState('failed')
      return
    }

    const timer = setTimeout(async () => {
      const { data } = await supabase.auth.getSession()
      setState(data?.session ? 'done' : 'failed')
    }, 800)

    return () => clearTimeout(timer)
  }, [])

  if (state === 'done') return <Navigate to="/" replace />

  return (
    <div className="flex min-h-screen items-center justify-center bg-bg p-6">
      <div className="w-full max-w-sm">
        <Card>
          {state === 'working' ? (
            <p className="text-sm text-text-secondary">{t('auth.confirming')}</p>
          ) : (
            <>
              <h1 className="text-lg font-semibold text-text">{t('auth.linkDeadTitle')}</h1>
              <p className="mt-2 text-sm text-text-secondary">{t('auth.linkDeadBody')}</p>
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
