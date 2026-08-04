import { useI18n } from '../../i18n'
import ChecklistBlock from './ChecklistBlock'
import DocumentsBlock from './DocumentsBlock'
import MessagesBlock from './MessagesBlock'
import GateBlock from './GateBlock'
import { Card } from '../ui'

/**
 * The open stage — built ONCE and reused for all ten.
 *
 * Every stage shows the same four blocks in the same order, and every
 * block is rendered even when it has nothing in it, so the pattern reads
 * identically whichever stage you are looking at.
 *
 * The only per-stage input is the row from stage_definitions.
 */
export default function StageView({
  definition,
  stage,
  items,
  messagePairs,
  documentPairs,
  questionnaire,
  project,
  onItemsChanged,
  onStageChanged,
}) {
  const { t, language } = useI18n()

  const blocks = [
    {
      key: 'checklist',
      title: t('project.blockChecklist'),
      body: <ChecklistBlock items={items} onChanged={onItemsChanged} />,
    },
    {
      key: 'documents',
      title: t('project.blockDocuments'),
      body: (
        <DocumentsBlock
          definition={definition}
          templates={documentPairs}
          questionnaire={questionnaire}
          project={project}
        />
      ),
    },
    {
      key: 'messages',
      title: t('project.blockMessages'),
      body: <MessagesBlock pairs={messagePairs} project={project} />,
    },
    {
      key: 'gate',
      title: t('project.blockGate'),
      body: <GateBlock definition={definition} stage={stage} onChanged={onStageChanged} />,
    },
  ]

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <h2 className="text-lg font-semibold text-text">
          {language === 'ar' ? definition.title_ar : definition.title_en}
        </h2>
        <span className="rounded border border-border px-2 py-0.5 text-xs text-text-secondary">
          {t(`project.status_${stage.status}`)}
        </span>
      </div>

      <div className="space-y-4">
        {blocks.map((block) => (
          <Card key={block.key}>
            <h3 className="mb-3 text-xs uppercase tracking-wide text-text-secondary">
              {block.title}
            </h3>
            {block.body}
          </Card>
        ))}
      </div>
    </div>
  )
}
