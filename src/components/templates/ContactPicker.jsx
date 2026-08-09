import { useEffect, useState } from 'react'
import { fullName, listContacts } from '../../lib/contacts'
import { formatPhone } from '../../lib/phone'
import { useI18n } from '../../i18n'
import { Badge, EmptyState, Input, Modal } from '../ui'

/** Picks the client a document is generated for. */
export default function ContactPicker({ open, onClose, onPick }) {
  const { t } = useI18n()
  const [contacts, setContacts] = useState([])
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!open) return
    setLoading(true)
    Promise.all([listContacts(false), listContacts(true)]).then(([leads, clients]) => {
      setContacts([...clients, ...leads])
      setLoading(false)
    })
  }, [open])

  const term = search.trim().toLowerCase()
  const shown = contacts.filter((c) =>
    !term
      ? true
      : [fullName(c), c.email ?? '', c.phone_number ?? ''].join(' ').toLowerCase().includes(term)
  )

  return (
    <Modal open={open} title={t('generator.pickContact')} onClose={onClose}>
      <p className="mb-3 text-sm text-text-secondary">{t('generator.pickContactHelp')}</p>

      <Input
        autoFocus
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        placeholder={t('generator.searchContact')}
      />

      <div className="mt-3 max-h-80 overflow-y-auto">
        {loading ? (
          <p className="text-sm text-text-secondary">{t('common.loading')}</p>
        ) : shown.length === 0 ? (
          <EmptyState>{t('search.noResults')}</EmptyState>
        ) : (
          shown.map((contact) => (
            <button
              key={contact.id}
              onClick={() => onPick(contact)}
              className="flex w-full items-center justify-between gap-3 rounded border border-transparent px-3 py-2 text-start hover:border-separator hover:bg-bg"
            >
              <span>
                <span className="block text-sm text-text">{fullName(contact)}</span>
                <span className="block text-xs text-text-secondary">
                  {contact.email ||
                    formatPhone(contact.phone_country_code, contact.phone_number) ||
                    '—'}
                </span>
              </span>
              <Badge tone={contact.is_client ? 'success' : 'neutral'}>
                {t(contact.is_client ? 'contact.client' : 'contact.lead')}
              </Badge>
            </button>
          ))
        )}
      </div>
    </Modal>
  )
}
