import { useState } from 'react'
import { FIELD_BY_NAME } from '../../data/mergeFields'
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
export default function PromptFieldsForm({ open, fields, onCancel, onDone }) {
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
