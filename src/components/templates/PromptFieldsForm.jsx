import { useState } from 'react'
import { FIELD_BY_NAME, computeField, isComputed } from '../../data/mergeFields'
import { useI18n } from '../../i18n'
import { Button, Field, Input, Modal } from '../ui'

/**
 * Prompt fields have no database source, so the generator asks for them
 * before generating. The label is the field's own `ask_user` text from
 * the registry.
 *
 * These are never auto-filled and never left blank — Continue stays
 * disabled until every one has a value.
 */
/**
 * `computed` lists the fields the document works out for itself. They
 * are shown here, live, as their inputs are typed — a fee total that
 * only appears after you close the form is a total you have to take on
 * trust while entering the numbers that make it.
 */
export default function PromptFieldsForm({ open, fields, computed = [], onCancel, onDone }) {
  const { t } = useI18n()
  const [values, setValues] = useState({})

  const allAnswered = fields.every((name) => String(values[name] ?? '').trim())

  return (
    <Modal
      open={open}
      title={t('generator.promptTitle')}
      onClose={onCancel}
      footer={
        <>
          <Button variant="ghost" onClick={onCancel}>
            {t('common.cancel')}
          </Button>
          <Button disabled={!allAnswered} onClick={() => onDone(values)}>
            {t('generator.continue')}
          </Button>
        </>
      }
    >
      <p className="mb-4 text-sm text-text-secondary">{t('generator.promptHelp')}</p>

      {computed.length > 0 && (
        <div className="mb-4 rounded border border-border bg-bg p-3">
          {computed.map((name) => (
            <div key={name} className="flex items-baseline justify-between gap-3">
              <span className="text-xs text-text-secondary">{name}</span>
              <span className="text-lg font-semibold text-accent">
                {computeField(name, values) || '—'}
              </span>
            </div>
          ))}
        </div>
      )}

      <div className="space-y-4">
        {fields.map((name) => (
          <Field key={name} label={FIELD_BY_NAME[name]?.ask_user || name} hint={`{{${name}}}`}>
            <Input
              value={values[name] ?? ''}
              onChange={(e) => setValues((current) => ({ ...current, [name]: e.target.value }))}
            />
          </Field>
        ))}
      </div>
    </Modal>
  )
}
