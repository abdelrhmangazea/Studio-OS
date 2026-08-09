import { useI18n } from '../../i18n'

/**
 * All ten stages. Completed ones collapse to a tick, the current one is
 * highlighted, future ones are locked and greyed.
 */
export default function StageRail({ definitions, stages, openKey, onOpen, itemsByStage }) {
  const { t, language } = useI18n()

  return (
    <nav className="flex flex-col gap-1">
      {definitions.map((definition) => {
        const stage = stages.find((s) => s.stage_key === definition.stage_key)
        const status = stage?.status ?? 'locked'
        const isOpen = definition.stage_key === openKey
        const counts = itemsByStage[definition.stage_key]

        return (
          <button
            key={definition.stage_key}
            onClick={() => onOpen(definition.stage_key)}
            className={
              'flex items-center gap-3 rounded border px-3 py-2.5 text-start transition-colors ' +
              (isOpen
                ? 'border-accent bg-surface'
                : status === 'locked'
                  ? 'border-transparent opacity-50 hover:opacity-80'
                  : 'border-transparent hover:bg-surface')
            }
          >
            <span
              className={
                'flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs ' +
                (status === 'complete'
                  ? 'bg-success text-on-success'
                  : status === 'active'
                    ? 'bg-accent text-on-accent'
                    : 'border border-separator text-text-secondary')
              }
            >
              {status === 'complete' ? '✓' : status === 'locked' ? '🔒' : definition.sort_order}
            </span>

            <span className="min-w-0 flex-1">
              <span className="block truncate text-sm text-text">
                {language === 'ar' ? definition.title_ar : definition.title_en}
              </span>
              {counts && counts.total > 0 && (
                <span className="block text-xs text-text-secondary">
                  {counts.done}/{counts.total}
                </span>
              )}
            </span>

            {stage?.gate_override && (
              <span className="text-xs text-warning" title={stage.override_reason}>
                {t('project.overridden')}
              </span>
            )}
          </button>
        )
      })}
    </nav>
  )
}
