import { useEffect, useState } from 'react'
import { findDuplicateEmail, fullName, updateContact } from '../../lib/contacts'
import { toContactForm, toContactRow, validateContact } from '../../lib/contactForm'
import { conversionPatch, isReverting } from '../../lib/conversion'
import { useI18n } from '../../i18n'
import ContactFields from '../ContactFields'
import { Button, ErrorText, Modal, WarningText } from '../ui'

export default function DetailsTab({ contact, onSaved, statuses, sources }) {
  const { t } = useI18n()

  const [form, setForm] = useState(() => toContactForm(contact))
  const [errors, setErrors] = useState({})
  const [duplicate, setDuplicate] = useState(null)
  const [busy, setBusy] = useState(false)
  const [saved, setSaved] = useState(false)
  const [failed, setFailed] = useState('')
  const [confirmingRevert, setConfirmingRevert] = useState(false)

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

  /**
   * Saving can also convert. Moving onto a won status makes this record
   * a client; moving off one sends a client back to the leads views,
   * and that direction asks first because it undoes something.
   */
  async function handleSave({ confirmedRevert = false } = {}) {
    const found = validateContact(form)
    setErrors(found)
    if (Object.keys(found).length > 0) return

    if (!confirmedRevert && isReverting(contact, form.status_id, statuses)) {
      setConfirmingRevert(true)
      return
    }

    setBusy(true)
    setFailed('')
    try {
      const row = toContactRow(form)
      onSaved(
        await updateContact(contact.id, {
          ...row,
          ...conversionPatch(contact, row.status_id, statuses),
        })
      )
      setSaved(true)
      setConfirmingRevert(false)
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
        <Button onClick={() => handleSave()} disabled={busy}>
          {busy ? t('common.saving') : t('common.save')}
        </Button>
        {saved && <span className="text-sm text-success">{t('common.saved')}</span>}
        <ErrorText>{failed}</ErrorText>
      </div>

      {/* Only shown when a client is being moved off a won status. */}
      <Modal
        open={confirmingRevert}
        title={t('contact.revertTitle')}
        onClose={() => setConfirmingRevert(false)}
        footer={
          <>
            <Button variant="ghost" onClick={() => setConfirmingRevert(false)} disabled={busy}>
              {t('common.cancel')}
            </Button>
            <Button
              variant="danger"
              onClick={() => handleSave({ confirmedRevert: true })}
              disabled={busy}
            >
              {busy ? t('common.saving') : t('contact.revertConfirm')}
            </Button>
          </>
        }
      >
        <p className="text-sm text-text">
          {t('contact.revertBody', { name: fullName(contact) })}
        </p>
        <p className="mt-3 text-sm text-warning">{t('contact.revertLaterWarning')}</p>
      </Modal>
    </div>
  )
}
