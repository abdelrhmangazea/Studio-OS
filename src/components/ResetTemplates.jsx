import { useState } from 'react'
import { resetSystemTemplates } from '../lib/templates'
import { useAuth } from '../lib/AuthContext'
import { useI18n } from '../i18n'
import { Button, Card, ErrorText, SectionTitle } from './ui'

/**
 * Settings → Reset templates to defaults.
 *
 * Restores only the seeded rows (is_system = true). Templates the
 * designer created themselves are is_system = false and are untouched.
 */
export default function ResetTemplates() {
  const { t } = useI18n()
  const { isOwner } = useAuth()

  const [busy, setBusy] = useState(false)
  const [restored, setRestored] = useState(null)
  const [error, setError] = useState('')

  async function handleReset() {
    if (!window.confirm(t('templates.resetConfirm'))) return

    setBusy(true)
    setError('')
    try {
      setRestored(await resetSystemTemplates())
    } catch (failure) {
      setError(failure.message)
    }
    setBusy(false)
  }

  return (
    <Card className="mb-6">
      <SectionTitle hint={t('templates.resetHelp')}>{t('templates.resetTitle')}</SectionTitle>

      {!isOwner && <p className="mb-3 text-sm text-warning">{t('settings.ownerOnly')}</p>}

      <div className="flex items-center gap-3">
        <Button variant="secondary" onClick={handleReset} disabled={busy || !isOwner}>
          {busy ? t('common.saving') : t('templates.resetButton')}
        </Button>
        {restored !== null && (
          <span className="text-sm text-success">{t('templates.resetDone', { count: restored })}</span>
        )}
        <ErrorText>{error}</ErrorText>
      </div>
    </Card>
  )
}
