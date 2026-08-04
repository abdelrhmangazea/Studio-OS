import { useEffect, useState } from 'react'
import { createContact, findDuplicateEmail, fullName } from '../lib/contacts'
import { EMPTY_CONTACT, toContactRow, validateContact } from '../lib/contactForm'
import { conversionPatch } from '../lib/conversion'
import { useI18n } from '../i18n'
import ContactFields from './ContactFields'
import { Button, ErrorText, SidePanel, WarningText } from './ui'

export default function AddLeadPanel({ open, onClose, onCreated, statuses, sources }) {
  const { t } = useI18n()

  const [form, setForm] = useState(EMPTY_CONTACT)
  const [errors, setErrors] = useState({})
  const [duplicate, setDuplicate] = useState(null)
  const [busy, setBusy] = useState(false)
  const [failed, setFailed] = useState('')

  // A fresh blank form every time the panel opens. Default the status to
  // the first one, which is "New" unless the studio renamed it.
  useEffect(() => {
    if (!open) return
    setForm({ ...EMPTY_CONTACT, status_id: statuses[0]?.id ?? '' })
    setErrors({})
    setDuplicate(null)
    setFailed('')
  }, [open, statuses])

  function change(field, value) {
    setForm((current) => ({ ...current, [field]: value }))
    setErrors((current) => ({ ...current, [field]: undefined, phone: undefined }))
  }

  // Warn about a duplicate email as soon as they stop typing — never block.
  useEffect(() => {
    if (!open) return
    const timer = setTimeout(async () => {
      setDuplicate(await findDuplicateEmail(form.email))
    }, 400)
    return () => clearTimeout(timer)
  }, [form.email, open])

  async function handleSave() {
    const found = validateContact(form)
    setErrors(found)
    if (Object.keys(found).length > 0) return

    setBusy(true)
    setFailed('')
    try {
      // Adding someone straight onto a won status makes them a client
      // immediately — same rule as changing the status later.
      const row = toContactRow(form)
      const created = await createContact({
        ...row,
        ...conversionPatch({ is_client: false }, row.status_id, statuses),
      })
      onCreated(created)
      onClose()
    } catch (error) {
      setFailed(error.message)
    }
    setBusy(false)
  }

  return (
    <SidePanel
      open={open}
      title={t('leads.newLead')}
      onClose={onClose}
      footer={
        <>
          <Button onClick={handleSave} disabled={busy}>
            {busy ? t('common.saving') : t('common.save')}
          </Button>
          <Button variant="ghost" onClick={onClose} disabled={busy}>
            {t('common.cancel')}
          </Button>
          <ErrorText>{failed}</ErrorText>
        </>
      }
    >
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
    </SidePanel>
  )
}
