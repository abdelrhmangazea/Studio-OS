import { useI18n } from '../i18n'
import { Card, PageTitle } from '../components/ui'

/**
 * Every sidebar screen except Settings renders this in Bucket 1.
 * Each one is filled in by a later bucket.
 */
export default function Placeholder({ titleKey }) {
  const { t } = useI18n()

  return (
    <div>
      <PageTitle>{t(titleKey)}</PageTitle>
      <Card>
        <p className="text-sm text-text-secondary">{t('common.comingSoon')}</p>
      </Card>
    </div>
  )
}
