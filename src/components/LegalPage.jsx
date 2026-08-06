import { Link } from 'react-router-dom'
import { useI18n } from '../i18n'
import { Card } from './ui'

/** Shared shell for the two legal pages, so they cannot drift apart. */
export default function LegalPage({ titleKey, bodyKey }) {
  const { t } = useI18n()

  return (
    <div className="min-h-screen bg-bg p-6">
      <div className="mx-auto max-w-2xl py-10">
        <Card>
          <h1 className="text-2xl font-semibold text-text">{t(titleKey)}</h1>

          <div className="mt-4 rounded border border-warning p-4">
            <p className="text-sm font-medium text-warning">{t('legal.placeholderTitle')}</p>
            <p className="mt-1 text-sm text-text-secondary">{t('legal.placeholderBody')}</p>
          </div>

          <p className="mt-6 whitespace-pre-line text-sm text-text-secondary">{t(bodyKey)}</p>

          <p className="mt-8 text-sm">
            <Link to="/login" className="text-accent hover:underline">{t('auth.backToSignIn')}</Link>
          </p>
        </Card>
      </div>
    </div>
  )
}
