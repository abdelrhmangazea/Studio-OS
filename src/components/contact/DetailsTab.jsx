import { useEffect, useState } from 'react'
import { findDuplicateEmail, fullName, updateContact } from '../../lib/contacts'
import { toContactForm, toContactRow, validateContact } from '../../lib/contactForm'
import { useI18n } from '../../i18n'
import ContactFields from '../ContactFields'
import { Button, ErrorText, WarningText } from '../ui'

export default function DetailsTab({ contact, onSaved, statuses, sources }) {
  const { t } = useI18n()

  const [form, setForm] = useState(() => toContactForm(contact))
  const [errors, setErrors] = useState({})
  const [duplicate, setDuplicate] = useState(null)
  const [busy, setBusy] = useState(false)
  const [saved, setSaved] = useState(false)
  const [failed, setFailed] = useState('')

  useEffect(() => {
    setForm(toContactForm(contact))
  }, [contact])

  function change(field, value) {
    setForm((current) => ({ ...current, [field]: value }))
    setErrors((current) => ({ ...current, [field]: undefined, phone: undefined }))
    setSaved(false)
  }

  useEffect(() => {
    const timer = setTimeout(async () => {
      setDuplicate(await findDuplicateEmail(form.email, contact.id))
    }, 400)
    return () => clearTimeout(timer)
  }, [form.email, contact.id])

  async function handleSave() {
    const found = validateContact(form)
    setErrors(found)
    if (Object.keys(found).length > 0) return

    setBusy(true)
    setFailed('')
    try {
      onSaved(await updateContact(contact.id, toContactRow(form)))
      setSaved(true)
    } catch (error) {
      setFailed(error.message)
    }
    setBusy(false)
  }

  return (
    <div className="max-w-2xl">
      <ContactFields
        form={form}
        errors={errors}
        onChange={change}
        statuses={statuses}
        sources={sources}
      />

      {duplicate && (
        <div className="mt-4">
          <WarningText>
            {t('validation.duplicateEmail', { name: fullName(duplicate) })}
          </WarningText>
        </div>
      )}

      <div className="mt-6 flex items-center gap-3">
        <Button onClick={handleSave} disabled={busy}>
          {busy ? t('common.saving') : t('common.save')}
        </Button>
        {saved && <span className="text-sm text-success">{t('common.saved')}</span>}
        <ErrorText>{failed}</ErrorText>
      </div>
    </div>
  )
}
