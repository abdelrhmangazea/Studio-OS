import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { getContact, fullName } from '../lib/contacts'
import { getProject } from '../lib/projects'
import { getBooking } from '../lib/booking'
import {
  getQuestionnaire,
  listTemplates,
  pairByKey,
  saveGeneratedDocument,
} from '../lib/templates'
import {
  extractFields,
  renderTemplate,
  resolveAutoFields,
  splitFields,
  unresolvedFields,
} from '../lib/mergeEngine'
import { buildDocumentHtml, textToHtml, highlightUnresolved } from '../lib/documentHtml'
import { exportPdf } from '../lib/exportPdf'
import { exportDocx } from '../lib/exportDocx'
import { copyToClipboard, htmlToWhatsappText } from '../lib/exportWhatsapp'
import { FIELD_BY_NAME, NOT_YET_AVAILABLE } from '../data/mergeFields'
import { useAuth } from '../lib/AuthContext'
import { useI18n } from '../i18n'
import PromptFieldsForm from '../components/templates/PromptFieldsForm'
import {
  Button,
  Card,
  EmptyState,
  ErrorText,
  Field,
  Input,
  Modal,
  Select,
  WarningText,
} from '../components/ui'

/**
 * The generator.
 *
 * Left: every resolved field value, editable before generating.
 * Right: the document itself, live, and directly editable — what you
 * see there is exactly what gets exported and saved.
 */
export default function Generator() {
  const { key, contactId } = useParams()
  const [searchParams] = useSearchParams()
  const projectId = searchParams.get('project')
  const bookingId = searchParams.get('booking')
  const { t, language: appLanguage } = useI18n()
  const { settings, profile } = useAuth()
  const navigate = useNavigate()

  const [contact, setContact] = useState(null)
  const [project, setProject] = useState(null)
  const [booking, setBooking] = useState(null)
  const [pair, setPair] = useState(null)
  const [questionnaire, setQuestionnaire] = useState(null)
  const [language, setLanguage] = useState(appLanguage)
  const [values, setValues] = useState({})
  const [promptValues, setPromptValues] = useState(null)
  const [bodyHtml, setBodyHtml] = useState('')
  const [loading, setLoading] = useState(true)
  const [saved, setSaved] = useState(false)
  const [copied, setCopied] = useState(false)
  const [error, setError] = useState('')
  const [whatsappOpen, setWhatsappOpen] = useState(false)

  const previewRef = useRef(null)

  // ---------- load ----------
  useEffect(() => {
    let cancelled = false
    ;(async () => {
      const [loadedContact, allTemplates, q, loadedProject] = await Promise.all([
        getContact(contactId),
        listTemplates(),
        getQuestionnaire(),
        projectId ? getProject(projectId) : Promise.resolve(null),
      ])
      const loadedBooking = bookingId ? await getBooking(bookingId) : null
      if (cancelled) return

      setContact(loadedContact)
      setProject(loadedProject)
      setBooking(loadedBooking)
      setQuestionnaire(q)
      setPair(pairByKey(allTemplates).find((p) => p.key === key) ?? null)
      setLoading(false)
    })()
    return () => {
      cancelled = true
    }
  }, [key, contactId, projectId, bookingId])

  const isQuestionnaire = !pair && questionnaire?.key === key
  const row = pair?.[language] ?? pair?.ar ?? pair?.en ?? null

  // The raw text this document is built from.
  const sourceBody = isQuestionnaire
    ? questionnaireToText(questionnaire.structure, language)
    : (row?.body ?? '')
  const sourceTitle = isQuestionnaire
    ? language === 'ar'
      ? 'استمارة معلومات العميل'
      : 'Client Questionnaire'
    : (row?.title ?? '')

  const fields = useMemo(
    () => extractFields(sourceBody, row?.subject),
    [sourceBody, row?.subject]
  )
  const { prompt: promptNames } = splitFields(fields)

  // ---------- resolve ----------
  useEffect(() => {
    if (loading || !contact) return
    if (promptNames.length > 0 && promptValues === null) return // wait for the form

    let cancelled = false
    ;(async () => {
      const auto = await resolveAutoFields({ contact, settings, profile, project, booking, language })
      if (cancelled) return
      setValues({ ...auto, ...(promptValues ?? {}) })
    })()
    return () => {
      cancelled = true
    }
  }, [loading, contact, settings, profile, project, booking, language, promptValues, promptNames.length])

  // Re-render the body whenever the values or the language change.
  useEffect(() => {
    if (!sourceBody || Object.keys(values).length === 0) return
    // Highlight once, here, so the preview and the export agree.
    setBodyHtml(highlightUnresolved(textToHtml(renderTemplate(sourceBody, values), language)))
    setSaved(false)
  }, [sourceBody, values, language])

  const missing = unresolvedFields(fields, values)

  if (loading) return <p className="text-sm text-text-secondary">{t('common.loading')}</p>
  if (!contact) return <EmptyState>{t('contact.notFound')}</EmptyState>
  if (!row && !isQuestionnaire) return <EmptyState>{t('contact.notFound')}</EmptyState>

  // ---------- actions ----------
  function currentBody() {
    return previewRef.current?.innerHTML ?? bodyHtml
  }

  function fullHtml() {
    return buildDocumentHtml({
      title: sourceTitle,
      bodyHtml: currentBody(),
      language,
      settings,
      meta: fullName(contact),
    })
  }

  async function handleCopy() {
    await copyToClipboard(htmlToWhatsappText(currentBody()))
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  async function handleSave() {
    setError('')
    try {
      await saveGeneratedDocument({
        contact_id: contact.id,
        project_id: project?.id ?? null,
        template_key: key,
        type: isQuestionnaire ? 'questionnaire' : row.type,
        language,
        title: sourceTitle,
        final_body: currentBody(),
        field_values: values,
      })
      setSaved(true)
    } catch (failure) {
      setError(failure.message)
    }
  }

  return (
    <div>
      {/* Prompt fields are asked for before anything is generated. */}
      <PromptFieldsForm
        open={promptNames.length > 0 && promptValues === null}
        fields={promptNames}
        onCancel={() => navigate(project ? `/projects/${project.id}` : '/templates')}
        onDone={setPromptValues}
      />

      <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div>
          <button
            onClick={() => navigate(project ? `/projects/${project.id}` : '/templates')}
            className="mb-2 text-sm text-text-secondary hover:text-text"
          >
            ← {project ? project.name : t('nav.templates')}
          </button>
          <h1 className="text-2xl font-semibold text-text">{sourceTitle}</h1>
          <p className="mt-1 text-sm text-text-secondary">
            {fullName(contact)}
            {project && (
              <>
                {' · '}
                <span className="font-mono" dir="ltr">{project.code}</span>
                {' '}{project.name}
              </>
            )}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Language switch lives on the document itself. */}
          <Select
            className="w-32"
            value={language}
            onChange={(e) => setLanguage(e.target.value)}
          >
            <option value="ar">{t('language.ar')}</option>
            <option value="en">{t('language.en')}</option>
          </Select>

          <Button variant="secondary" onClick={handleCopy}>
            {copied ? t('generator.copied') : t('generator.copy')}
          </Button>
          <Button variant="secondary" onClick={() => setWhatsappOpen(true)}>
            {t('generator.whatsapp')}
          </Button>
          <Button variant="secondary" onClick={() => exportPdf(fullHtml())}>
            {t('generator.exportPdf')}
          </Button>
          <Button
            variant="secondary"
            onClick={() =>
              exportDocx({ title: sourceTitle, bodyHtml: currentBody(), language, settings })
            }
          >
            {t('generator.exportWord')}
          </Button>
          <Button onClick={handleSave}>{t('generator.save')}</Button>
        </div>
      </div>

      {saved && <p className="mb-4 text-sm text-success">{t('generator.saved')}</p>}
      <ErrorText>{error}</ErrorText>

      {missing.length > 0 && (
        <Card className="mb-4 border-warning">
          <p className="text-sm font-medium text-warning">
            {t('generator.unresolvedTitle', { count: missing.length })}
          </p>
          <p className="mt-1 text-xs text-text-secondary">{t('generator.unresolvedBody')}</p>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {missing.map((name) => (
              <span key={name} className="rounded border border-warning px-2 py-0.5 text-xs text-warning">
                {name}
                {NOT_YET_AVAILABLE.has(name) && ` · ${t('generator.notAvailableYet')}`}
              </span>
            ))}
          </div>
        </Card>
      )}

      <div className="grid gap-4 lg:grid-cols-[320px_1fr]">
        {/* ---------- LEFT: the values ---------- */}
        <Card className="h-fit">
          <h2 className="text-sm font-semibold text-text">{t('generator.valuesTitle')}</h2>
          <p className="mb-4 mt-1 text-xs text-text-secondary">{t('generator.valuesHelp')}</p>

          <div className="space-y-3">
            {fields.map((name) => (
              <Field
                key={name}
                label={name}
                hint={
                  FIELD_BY_NAME[name]?.source === 'prompt'
                    ? t('generator.promptField')
                    : NOT_YET_AVAILABLE.has(name)
                      ? t('generator.notAvailableYet')
                      : t('generator.autoField')
                }
              >
                <Input
                  value={values[name] ?? ''}
                  onChange={(e) =>
                    setValues((current) => ({ ...current, [name]: e.target.value }))
                  }
                  className={values[name] ? '' : 'border-warning'}
                />
              </Field>
            ))}
            {fields.length === 0 && (
              <p className="text-xs text-text-secondary">{t('common.none')}</p>
            )}
          </div>
        </Card>

        {/* ---------- RIGHT: the document ---------- */}
        <Card>
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-sm font-semibold text-text">{t('generator.previewTitle')}</h2>
            <span className="text-xs text-text-secondary">{t('generator.previewHelp')}</span>
          </div>

          {/* Always white with dark text: this is paper, not app chrome. */}
          <div className="overflow-x-auto rounded border border-border bg-white p-8">
            <div
              ref={previewRef}
              contentEditable
              suppressContentEditableWarning
              dir={language === 'ar' ? 'rtl' : 'ltr'}
              lang={language}
              className="studio-doc min-h-64 outline-none"
              dangerouslySetInnerHTML={{ __html: bodyHtml }}
            />
          </div>

          <p className="mt-2 text-xs text-text-secondary">{t('generator.pdfHint')}</p>
        </Card>
      </div>

      <Modal
        open={whatsappOpen}
        title={t('generator.whatsappTitle')}
        onClose={() => setWhatsappOpen(false)}
        wide
        footer={
          <Button
            onClick={async () => {
              await copyToClipboard(htmlToWhatsappText(currentBody()))
              setWhatsappOpen(false)
            }}
          >
            {t('generator.copy')}
          </Button>
        }
      >
        <p className="mb-2 text-xs text-text-secondary">{t('generator.whatsappHelp')}</p>
        <pre
          dir={language === 'ar' ? 'rtl' : 'ltr'}
          className="whitespace-pre-wrap rounded border border-border bg-bg p-3 font-sans text-sm text-text"
        >
          {htmlToWhatsappText(bodyHtml)}
        </pre>
      </Modal>
    </div>
  )
}

/** Renders the questionnaire structure as document text. */
function questionnaireToText(structure, language) {
  const ar = language === 'ar'
  const lines = []

  for (const section of structure?.sections ?? []) {
    lines.push('')
    lines.push(`${section.number}. ${ar ? section.title_ar : section.title_en}`)
    const desc = ar ? section.desc_ar : section.desc_en
    if (desc) lines.push(desc)
    lines.push('')

    for (const question of section.questions) {
      const label = ar ? question.label_ar : question.label_en
      const text = ar ? question.text_ar : question.text_en
      lines.push(text ? `${label} — ${text}` : label)

      if (question.options?.length) {
        for (const option of question.options) {
          lines.push(`☐ ${ar ? option.ar : option.en}`)
        }
      } else {
        lines.push('________________________________________')
      }
      lines.push('')
    }
  }

  return lines.join('\n')
}
