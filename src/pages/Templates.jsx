import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  duplicateTemplate,
  getQuestionnaire,
  listTemplates,
  pairByKey,
  setPairActive,
} from '../lib/templates'
import { extractFields, splitFields } from '../lib/mergeEngine'
import { NOT_YET_AVAILABLE } from '../data/mergeFields'
import { useI18n } from '../i18n'
import TemplateEditor from '../components/templates/TemplateEditor'
import ChecklistEditor from '../components/templates/ChecklistEditor'
import ContactPicker from '../components/templates/ContactPicker'
import { Badge, Button, Card, EmptyState, Loadable, Modal, PageTitle } from '../components/ui'
import { useFeatureUse } from '../lib/useFeatureUse'

/**
 * The template library.
 *
 * Templates are paired by `key`, so each row here is one key showing
 * its Arabic and English versions side by side.
 */
export default function Templates() {
  useFeatureUse('templates')
  const { t, language } = useI18n()
  const navigate = useNavigate()

  const [rows, setRows] = useState([])
  const [questionnaire, setQuestionnaire] = useState(null)
  const [loading, setLoading] = useState(true)
  const [loadFailure, setLoadFailure] = useState(null)
  const [editing, setEditing] = useState(null)
  const [previewing, setPreviewing] = useState(null)
  const [pickingFor, setPickingFor] = useState(null)
  const [editingChecklist, setEditingChecklist] = useState(null)

  async function load() {
    // Reset both, or a successful retry leaves the old error
    // sitting on screen underneath fresh data.
    setLoading(true)
    setLoadFailure(null)
    try {
      const [templates, q] = await Promise.all([listTemplates(), getQuestionnaire()])
      setRows(templates)
      setQuestionnaire(q)
    } catch (caught) {
      setLoadFailure(caught)
    } finally {
      // Always. A failed load must never leave the
      // screen spinning with no way out.
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
  }, [])

  const pairs = useMemo(() => pairByKey(rows), [rows])
  const bySection = {
    checklist: pairs.filter((p) => p.type === 'checklist'),
    document: pairs.filter((p) => p.type === 'document'),
    message: pairs.filter((p) => p.type === 'message'),
  }

  if (loading || loadFailure) {
    return (
      <Loadable loading={loading} failure={loadFailure} onRetry={load} t={t} />
    )
  }

  return (
    <div>
      <PageTitle subtitle={t('templates.subtitle', { count: pairs.length })}>
        {t('templates.title')}
      </PageTitle>

      <Section title={t('templates.checklists')} empty={t('templates.checklistsEmpty')} pairs={bySection.checklist}>
        {bySection.checklist.map((pair) => (
          <Row
            key={pair.key}
            pair={pair}
            {...{ setEditing, setPreviewing, setPickingFor, load }}
            onEditChecklist={setEditingChecklist}
          />
        ))}
      </Section>

      <Section title={t('templates.documents')} empty={t('templates.documentsEmpty')} pairs={bySection.document}>
        {bySection.document.map((pair) => (
          <Row key={pair.key} pair={pair} {...{ setEditing, setPreviewing, setPickingFor, load }} />
        ))}
      </Section>

      <Section title={t('templates.messages')} empty={t('templates.messagesEmpty')} pairs={bySection.message}>
        {bySection.message.map((pair) => (
          <Row key={pair.key} pair={pair} {...{ setEditing, setPreviewing, setPickingFor, load }} />
        ))}
      </Section>

      {/* ---------- Questionnaire ---------- */}
      <h2 className="mb-3 mt-8 text-base font-semibold text-text">{t('templates.questionnaire')}</h2>
      {questionnaire ? (
        <Card>
          <QuestionnaireSummary structure={questionnaire.structure} />
          <div className="mt-4">
            <Button onClick={() => setPickingFor({ key: questionnaire.key, type: 'questionnaire' })}>
              {t('templates.generate')}
            </Button>
          </div>
        </Card>
      ) : (
        <EmptyState>{t('templates.documentsEmpty')}</EmptyState>
      )}

      <TemplateEditor
        open={Boolean(editing)}
        row={editing?.row}
        template={editing?.pair}
        language={editing?.language}
        onClose={() => setEditing(null)}
        onSaved={load}
      />

      <ChecklistEditor
        open={Boolean(editingChecklist)}
        pair={editingChecklist}
        onClose={() => setEditingChecklist(null)}
        onSaved={load}
      />

      <ContactPicker
        open={Boolean(pickingFor)}
        onClose={() => setPickingFor(null)}
        onPick={(contact) => {
          const target = pickingFor
          setPickingFor(null)
          navigate(`/generate/${target.key}/${contact.id}`)
        }}
      />

      <Modal
        open={Boolean(previewing)}
        title={previewing?.title || ''}
        onClose={() => setPreviewing(null)}
        wide
      >
        {previewing?.subject && (
          <p className="mb-3 text-sm text-text-secondary">
            {t('templates.subjectLabel')}: {previewing.subject}
          </p>
        )}
        <pre
          dir={previewing?.language === 'ar' ? 'rtl' : 'ltr'}
          className="whitespace-pre-wrap font-sans text-sm text-text"
        >
          {previewing?.body}
        </pre>
      </Modal>
    </div>
  )
}

function Section({ title, empty, pairs, children }) {
  return (
    <>
      <h2 className="mb-3 mt-8 text-base font-semibold text-text first:mt-0">{title}</h2>
      {pairs.length === 0 ? <EmptyState>{empty}</EmptyState> : <div className="space-y-2">{children}</div>}
    </>
  )
}

function Row({ pair, setEditing, setPreviewing, setPickingFor, load, onEditChecklist }) {
  const { t, language } = useI18n()

  const primary = pair[language] || pair.ar || pair.en
  const used = extractFields(primary?.body, primary?.subject)
  const { unknown } = splitFields(used)
  const unavailable = used.filter((f) => NOT_YET_AVAILABLE.has(f))

  return (
    <div className={'rounded border border-border p-4 ' + (pair.active ? '' : 'opacity-60')}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-sm font-medium text-text">{primary?.title}</span>
            <Badge>{pair.is_system ? t('templates.system') : t('templates.custom')}</Badge>
            {!pair.active && <Badge color="#b7b7b7">{t('templates.inactive')}</Badge>}
          </div>
          {pair.stage && (
            <p className="mt-1 text-xs text-text-secondary">
              {t('templates.stage')}: {pair.stage}
            </p>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Button variant="secondary" className="px-2 py-1" onClick={() => setPreviewing(primary)}>
            {t('templates.preview')}
          </Button>
          <Button
            variant="secondary"
            className="px-2 py-1"
            onClick={() => duplicateTemplate(pair).then(load)}
          >
            {t('templates.duplicate')}
          </Button>
          <Button
            variant="secondary"
            className="px-2 py-1"
            onClick={() => setPairActive(pair, !pair.active).then(load)}
          >
            {pair.active ? t('templates.deactivate') : t('templates.activate')}
          </Button>
          <Button className="px-2 py-1" onClick={() => setPickingFor(pair)}>
            {t('templates.generate')}
          </Button>
        </div>
      </div>

      {/* Both languages side by side */}
      <div className="mt-3 grid gap-2 sm:grid-cols-2">
        {['ar', 'en'].map((lang) => (
          <div key={lang} className="rounded border border-border bg-surface p-3">
            <div className="mb-1 flex items-center justify-between">
              <span className="text-xs uppercase tracking-wide text-text-secondary">
                {t(lang === 'ar' ? 'templates.arabic' : 'templates.english')}
              </span>
              <button
                onClick={() =>
                  pair.type === 'checklist'
                    ? onEditChecklist(pair)
                    : setEditing({ pair, language: lang, row: pair[lang] })
                }
                className="text-xs text-accent hover:underline"
              >
                {t('templates.edit')}
              </button>
            </div>
            {pair[lang] ? (
              <p
                dir={lang === 'ar' ? 'rtl' : 'ltr'}
                className="line-clamp-2 text-xs text-text-secondary"
              >
                {pair[lang].body.slice(0, 140)}…
              </p>
            ) : (
              <p className="text-xs text-danger">{t('templates.missingLanguage')}</p>
            )}
          </div>
        ))}
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-1.5">
        {used.map((name) => (
          <span
            key={name}
            className={
              'rounded border px-2 py-0.5 text-xs ' +
              (unknown.includes(name)
                ? 'border-danger text-danger'
                : NOT_YET_AVAILABLE.has(name)
                  ? 'border-warning text-warning'
                  : 'border-border text-text-secondary')
            }
          >
            {name}
          </span>
        ))}
      </div>

      {unavailable.length > 0 && (
        <p className="mt-2 text-xs text-warning">
          {t('templates.notYetAvailable', { count: unavailable.length })}
        </p>
      )}
    </div>
  )
}

function QuestionnaireSummary({ structure }) {
  const { t, language } = useI18n()
  const sections = structure?.sections ?? []
  const questions = sections.reduce((sum, s) => sum + s.questions.length, 0)
  const options = sections.reduce(
    (sum, s) => sum + s.questions.reduce((n, q) => n + (q.options?.length ?? 0), 0),
    0
  )

  return (
    <div>
      <p className="text-sm text-text">
        {t('templates.questionnaireSections', {
          sections: sections.length,
          questions,
          options,
        })}
      </p>
      <p className="mt-1 text-xs text-text-secondary">{t('templates.questionnaireHelp')}</p>

      <ol className="mt-3 grid gap-1 sm:grid-cols-2">
        {sections.map((section) => (
          <li key={section.number} className="text-xs text-text-secondary">
            {section.number}. {language === 'ar' ? section.title_ar : section.title_en}
            {section.show_if_project_has && (
              <span className="ms-1 text-warning">· {section.show_if_project_has}</span>
            )}
          </li>
        ))}
      </ol>
    </div>
  )
}
