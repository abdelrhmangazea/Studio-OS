import { useEffect, useRef, useState } from 'react'
import { createTemplate, updateTemplate } from '../../lib/templates'
import { extractFields, splitFields } from '../../lib/mergeEngine'
import { MERGE_FIELDS, NOT_YET_AVAILABLE } from '../../data/mergeFields'
import { useI18n } from '../../i18n'
import { Button, ErrorText, Field, Input, SidePanel, Textarea, WarningText } from '../ui'

/**
 * Edits one language of a template.
 *
 * Merge fields are inserted from the picker, never typed by hand — that
 * is what keeps a template from referring to a field the engine has
 * never heard of. Any unknown field already in the body is flagged.
 */
export default function TemplateEditor({ open, row, template, language, onClose, onSaved }) {
  const { t } = useI18n()
  const bodyRef = useRef(null)

  const [form, setForm] = useState({ title: '', subject: '', body: '' })
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!open) return
    setForm({
      title: row?.title ?? '',
      subject: row?.subject ?? '',
      body: row?.body ?? '',
    })
    setError('')
  }, [open, row])

  const used = extractFields(form.body, form.subject)
  const { unknown } = splitFields(used)
  const unavailable = used.filter((f) => NOT_YET_AVAILABLE.has(f))

  /** Inserts {{field}} at the caret rather than appending blindly. */
  function insertField(name) {
    const textarea = bodyRef.current
    const token = `{{${name}}}`

    if (!textarea) {
      setForm((c) => ({ ...c, body: c.body + token }))
      return
    }

    const { selectionStart: start, selectionEnd: end } = textarea
    const next = form.body.slice(0, start) + token + form.body.slice(end)
    setForm((c) => ({ ...c, body: next }))

    requestAnimationFrame(() => {
      textarea.focus()
      textarea.setSelectionRange(start + token.length, start + token.length)
    })
  }

  async function handleSave() {
    setBusy(true)
    setError('')
    try {
      if (row) {
        onSaved(await updateTemplate(row.id, form))
      } else {
        // A language that did not exist yet for this key.
        onSaved(
          await createTemplate({
            key: template.key,
            type: template.type,
            channel: template.channel,
            stage: template.stage,
            language,
            sort_order: template.sort_order,
            is_system: false,
            ...form,
          })
        )
      }
      onClose()
    } catch (failure) {
      setError(failure.message)
    }
    setBusy(false)
  }

  return (
    <SidePanel
      open={open}
      title={`${t('templates.editorTitle')} — ${t(
        language === 'ar' ? 'templates.arabic' : 'templates.english'
      )}`}
      onClose={onClose}
      footer={
        <>
          <Button onClick={handleSave} disabled={busy}>
            {busy ? t('common.saving') : t('common.save')}
          </Button>
          <Button variant="ghost" onClick={onClose}>
            {t('common.cancel')}
          </Button>
          <ErrorText>{error}</ErrorText>
        </>
      }
    >
      <div className="space-y-4">
        <Field label={t('templates.titleLabel')}>
          <Input value={form.title} onChange={(e) => setForm((c) => ({ ...c, title: e.target.value }))} />
        </Field>

        <Field label={t('templates.subjectLabel')}>
          <Input
            value={form.subject ?? ''}
            onChange={(e) => setForm((c) => ({ ...c, subject: e.target.value }))}
          />
        </Field>

        <Field label={t('templates.bodyLabel')}>
          <Textarea
            ref={bodyRef}
            rows={16}
            dir={language === 'ar' ? 'rtl' : 'ltr'}
            value={form.body}
            onChange={(e) => setForm((c) => ({ ...c, body: e.target.value }))}
            className="font-mono text-xs leading-relaxed"
          />
        </Field>

        <Field label={t('templates.insertField')} hint={t('templates.insertFieldHelp')}>
          <select
            value=""
            onChange={(e) => e.target.value && insertField(e.target.value)}
            className="w-full rounded border border-border bg-surface px-3 py-2 text-sm text-text focus:border-accent focus:outline-none"
          >
            <option value="">—</option>
            {MERGE_FIELDS.map((field) => (
              <option key={field.field} value={field.field}>
                {field.field}
                {field.source === 'prompt' ? ` · ${t('generator.promptField')}` : ''}
              </option>
            ))}
          </select>
        </Field>

        <div>
          <p className="mb-1 text-xs uppercase tracking-wide text-text-secondary">
            {t('templates.fieldsUsed')} ({used.length})
          </p>
          <div className="flex flex-wrap gap-1.5">
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

          {unknown.length > 0 && (
            <div className="mt-2">
              <ErrorText>{t('templates.unknownFields', { fields: unknown.join(', ') })}</ErrorText>
            </div>
          )}
          {unavailable.length > 0 && (
            <div className="mt-2">
              <WarningText>
                {t('templates.notYetAvailable', { count: unavailable.length })}
              </WarningText>
            </div>
          )}
        </div>
      </div>
    </SidePanel>
  )
}
