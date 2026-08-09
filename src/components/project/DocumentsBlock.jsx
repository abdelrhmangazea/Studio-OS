import { Link, useNavigate } from 'react-router-dom'
import { useI18n } from '../../i18n'
import { Button } from '../ui'

/**
 * Block 2 of 4 — the documents this stage produces.
 *
 * The block is ALWAYS rendered, even when empty, so the four-block
 * pattern reads identically across all ten stages. When there is
 * nothing here it names the document type this stage expects, rather
 * than showing a bare "nothing yet".
 *
 * It never duplicates the Messages block.
 */
export default function DocumentsBlock({ definition, templates, project, questionnaire }) {
  const { t, language } = useI18n()
  const navigate = useNavigate()

  const expected = language === 'ar' ? definition.expected_docs_ar : definition.expected_docs_en

  const rows = [...templates]
  if (questionnaire && definition.stage_key === '04_onboarding') {
    rows.push({
      key: questionnaire.key,
      title: language === 'ar' ? 'استمارة معلومات العميل' : 'Client Questionnaire',
      isQuestionnaire: true,
    })
  }

  if (rows.length === 0) {
    return (
      <div className="rounded-card border border-dashed border-separator p-5 text-center">
        <p className="text-sm text-text-secondary">
          {expected
            ? t('project.documentsExpected', { docs: expected })
            : t('project.documentsNoneExpected')}
        </p>
        <Link
          to="/templates"
          className="mt-2 inline-block text-sm text-accent hover:underline"
        >
          {t('project.createDocumentTemplate')}
        </Link>
      </div>
    )
  }

  return (
    <div className="space-y-2">
      {expected && (
        <p className="text-xs text-text-secondary">
          {t('project.documentsExpected', { docs: expected })}
        </p>
      )}

      {rows.map((row) => (
        <div
          key={row.key}
          className="flex items-center justify-between gap-3 rounded-card border border-separator p-3"
        >
          <span className="text-sm text-text">{row.title}</span>
          <Button
            className="px-2 py-1"
            onClick={() =>
              navigate(`/generate/${row.key}/${project.contact_id}?project=${project.id}`)
            }
          >
            {t('project.generate')}
          </Button>
        </div>
      ))}
    </div>
  )
}
