import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { acceptInvite, peekInvite } from '../lib/subscription'
import { errorMessage } from '../lib/errorMessage'
import { useAuth } from '../lib/AuthContext'
import { useI18n } from '../i18n'
import { Button, Card, ErrorText } from '../components/ui'

/**
 * Where an invite link lands.
 *
 * It shows WHICH studio and WHICH role before anything happens.
 * Joining a workspace moves your account into somebody else's
 * studio — that is not a thing to do on the strength of a link
 * somebody pasted into a group chat.
 *
 * Signed out, it says what the link is for and sends them to sign
 * in rather than swallowing the token. Signing up and coming back
 * to the same link works, because peeking does not consume it.
 */
export default function AcceptInvite() {
  const { token } = useParams()
  const { t } = useI18n()
  const { session, refresh } = useAuth()
  const navigate = useNavigate()

  const [info, setInfo] = useState(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    peekInvite(token)
      .then(setInfo)
      .catch(() => setInfo({ valid: false, reason: 'unknown' }))
  }, [token])

  async function join() {
    setBusy(true)
    setError('')
    try {
      await acceptInvite(token)
      await refresh()
      navigate('/', { replace: true })
    } catch (failure) {
      setError(errorMessage(failure, t))
      setBusy(false)
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-bg p-6">
      <div className="w-full max-w-sm">
        <Card>
          <h1 className="text-xl font-semibold text-text">{t('invite.title')}</h1>

          {info === null && (
            <p className="mt-3 text-sm text-text-secondary">{t('common.loading')}</p>
          )}

          {info && !info.valid && (
            <>
              <p className="mt-3 text-sm text-text-secondary">
                {t(`invite.dead_${info.reason}`)}
              </p>
              <Link to="/login" className="mt-4 inline-block text-sm text-accent hover:underline">
                {t('auth.signIn')}
              </Link>
            </>
          )}

          {info?.valid && (
            <>
              <p className="mt-3 text-sm text-text">
                {t('invite.body', { studio: info.studio, role: t(`team.role_${info.role}`) })}
              </p>

              {/* Joining moves you out of your own studio. Anyone with
                  their own workspace needs to know that before, not after. */}
              <p className="mt-2 text-xs text-warning">{t('invite.movesYou')}</p>

              {session ? (
                <>
                  <Button onClick={join} disabled={busy} className="mt-4 w-full">
                    {busy ? t('common.loading') : t('invite.join')}
                  </Button>
                  <ErrorText>{error}</ErrorText>
                </>
              ) : (
                <>
                  <p className="mt-4 text-sm text-text-secondary">{t('invite.signInFirst')}</p>
                  <div className="mt-3 flex gap-3">
                    <Link to="/login" className="text-sm text-accent hover:underline">
                      {t('auth.signIn')}
                    </Link>
                    <Link to="/signup" className="text-sm text-accent hover:underline">
                      {t('auth.signUp')}
                    </Link>
                  </div>
                </>
              )}
            </>
          )}
        </Card>
      </div>
    </div>
  )
}
