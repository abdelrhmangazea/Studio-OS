import { useEffect, useState } from 'react'
import { createProject } from '../../lib/projects'
import { fullName, listContacts } from '../../lib/contacts'
import { useI18n } from '../../i18n'
import { Button, ErrorText, Field, Input, SidePanel, Select, Textarea } from '../ui'
import { errorMessage } from '../../lib/errorMessage'

/**
 * Creating a project is the one action available from outside a client
 * record. The code is allocated by the database, never here.
 */
export default function NewProjectPanel({ open, onClose, onCreated, fixedContactId }) {
  const { t } = useI18n()

  const [contacts, setContacts] = useState([])
  const [form, setForm] = useState({
    contact_id: '',
    name: '',
    address: '',
    area_sqm: '',
    project_type: '',
    requirements: '',
  })
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!open) return
    setError('')
    setForm({
      contact_id: fixedContactId ?? '',
      name: '',
      address: '',
      area_sqm: '',
      project_type: '',
      requirements: '',
    })
    Promise.all([listContacts(true), listContacts(false)]).then(([clients, leads]) =>
      setContacts([...clients, ...leads])
    )
  }, [open, fixedContactId])

  const set = (field) => (event) =>
    setForm((current) => ({ ...current, [field]: event.target.value }))

  async function handleCreate() {
    setBusy(true)
    setError('')
    try {
      onCreated(await createProject(form))
      onClose()
    } catch (failure) {
      setError(errorMessage(failure, t))
    }
    setBusy(false)
  }

  const ready = form.contact_id && form.name.trim()

  return (
    <SidePanel
      open={open}
      title={t('project.newProject')}
      onClose={onClose}
      footer={
        <>
          <Button onClick={handleCreate} disabled={busy || !ready}>
            {busy ? t('common.saving') : t('project.create')}
          </Button>
          <Button variant="ghost" onClick={onClose}>
            {t('common.cancel')}
          </Button>
          <ErrorText>{error}</ErrorText>
        </>
      }
    >
      <div className="space-y-4">
        {!fixedContactId && (
          <Field label={t('project.client')} hint={t('project.clientHelp')}>
            <Select value={form.contact_id} onChange={set('contact_id')}>
              <option value="">{t('fields.notSet')}</option>
              {contacts.map((contact) => (
                <option key={contact.id} value={contact.id}>
                  {fullName(contact)}
                  {contact.is_client ? '' : ` · ${t('contact.lead')}`}
                </option>
              ))}
            </Select>
          </Field>
        )}

        <Field label={t('project.name')}>
          <Input value={form.name} onChange={set('name')} />
        </Field>

        <Field label={t('project.address')}>
          <Input value={form.address} onChange={set('address')} />
        </Field>

        <div className="grid grid-cols-2 gap-4">
          <Field label={t('project.area')}>
            <Input type="number" min="0" value={form.area_sqm} onChange={set('area_sqm')} />
          </Field>
          <Field label={t('project.type')}>
            <Input value={form.project_type} onChange={set('project_type')} />
          </Field>
        </div>

        <Field label={t('project.requirements')} hint={t('project.requirementsHelp')}>
          <Textarea rows={4} value={form.requirements} onChange={set('requirements')} />
        </Field>

        <p className="text-xs text-text-secondary">{t('project.codeNote')}</p>
      </div>
    </SidePanel>
  )
}
