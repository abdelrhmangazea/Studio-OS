import { useNavigate } from 'react-router-dom'
import { useI18n } from '../../i18n'
import { Button, EmptyState } from '../ui'

/**
 * Block 3 of 4 — the message templates belonging to this stage.
 *
 * Which templates belong here comes from stage_definitions.template_stages,
 * so stages 05 to 08 pick up the templates tagged 'execution' without
 * anything being hardcoded per stage.
 */
export default function MessagesBlock({ pairs, project }) {
  const { t, language } = useI18n()
  const navigate = useNavigate()

  if (pairs.length === 0) return <EmptyState>{t('project.noMessages')}</EmptyState>

  return (
    <div className="space-y-2">
      {pairs.map((pair) => {
        const row = pair[language] ?? pair.ar ?? pair.en
        return (
          <div
            key={pair.key}
            className="flex items-center justify-between gap-3 rounded-card border border-separator p-3"
          >
            <span className="min-w-0">
              <span className="block truncate text-sm text-text">{row?.title}</span>
              {row?.subject && (
                <span className="block truncate text-xs text-text-secondary">{row.subject}</span>
              )}
            </span>
            <Button
              className="shrink-0 px-2 py-1"
              onClick={() =>
                navigate(`/generate/${pair.key}/${project.contact_id}?project=${project.id}`)
              }
            >
              {t('project.generate')}
            </Button>
          </div>
        )
      })}
    </div>
  )
}
