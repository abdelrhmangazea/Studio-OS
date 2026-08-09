import { useState } from 'react'
import { replayTour } from '../components/Tour'
import { useAuth } from '../lib/AuthContext'
import { useFeatureUse } from '../lib/useFeatureUse'
import { useI18n } from '../i18n'
import { Button, Card, PageTitle, SectionTitle } from '../components/ui'

/**
 * Help.
 *
 * Written around the questions this product actually raises, not
 * around its menus. The things that surprise people are the rules:
 * why a lead will not become a client, why a stage will not close,
 * why nothing was ever sent to anybody. Those are the entries.
 *
 * No search box and no article tree — there are eleven answers, and
 * a search box over eleven answers is furniture.
 */
const TOPICS = [
  'lead',
  'booking',
  'code',
  'stages',
  'gate',
  'documents',
  'sending',
  'portal',
  'revisions',
  'pricing',
  'deleting',
]

export default function Help() {
  useFeatureUse('help')
  const { t } = useI18n()
  const { profile, refresh } = useAuth()
  const [replaying, setReplaying] = useState(false)

  async function again() {
    setReplaying(true)
    await replayTour(profile.id)
    await refresh()
    setReplaying(false)
  }

  return (
    <div>
      <PageTitle subtitle={t('help.subtitle')}>{t('help.title')}</PageTitle>

      <Card className="mb-6">
        <SectionTitle hint={t('help.tourHint')}>{t('help.tour')}</SectionTitle>
        <Button onClick={again} disabled={replaying}>
          {replaying ? t('common.loading') : t('help.replay')}
        </Button>
      </Card>

      <div className="space-y-3">
        {TOPICS.map((key) => (
          <details key={key} className="rounded-card border border-separator p-4">
            <summary className="cursor-pointer text-sm font-medium text-text">
              {t(`help.q_${key}`)}
            </summary>
            <p className="mt-3 whitespace-pre-line text-sm text-text-secondary">
              {t(`help.a_${key}`)}
            </p>
          </details>
        ))}
      </div>

      <Card className="mt-6">
        <SectionTitle>{t('help.stuck')}</SectionTitle>
        <p className="text-sm text-text-secondary">{t('help.stuckBody')}</p>
      </Card>
    </div>
  )
}
