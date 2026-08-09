import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { fullName, listContacts } from '../lib/contacts'
import { countryByIso, countryName } from '../data/countries'
import { formatPhone } from '../lib/phone'
import { formatDate } from '../lib/format'
import { listLabel, useLists } from '../lib/useLists'
import { useI18n } from '../i18n'
import { Badge, EmptyState, Input, PageTitle, Select } from '../components/ui'
import DemoBadge from '../components/DemoBadge'
import { useFeatureUse } from '../lib/useFeatureUse'

/**
 * Clients are the same rows as leads, with is_client = true. Shown as
 * cards rather than a spreadsheet because a client is read one at a
 * time, not scanned in bulk.
 */
export default function Clients() {
  useFeatureUse('clients')
  const { t, language } = useI18n()
  const { statuses, loading: listsLoading } = useLists()
  const navigate = useNavigate()

  const [contacts, setContacts] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('')

  useEffect(() => {
    listContacts(true).then((data) => {
      setContacts(data)
      setLoading(false)
    })
  }, [])

  const statusById = useMemo(
    () => Object.fromEntries(statuses.map((status) => [status.id, status])),
    [statuses]
  )

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase()

    return contacts.filter((contact) => {
      if (statusFilter && contact.status_id !== statusFilter) return false
      if (!term) return true

      const haystack = [
        fullName(contact),
        contact.email ?? '',
        contact.phone_number ?? '',
      ]
        .join(' ')
        .toLowerCase()

      return haystack.includes(term)
    })
  }, [contacts, search, statusFilter])

  if (loading || listsLoading) {
    return <p className="text-sm text-text-secondary">{t('common.loading')}</p>
  }

  return (
    <div>
      <PageTitle subtitle={t('clients.count', { count: filtered.length })}>
        {t('clients.title')}
      </PageTitle>

      <div className="mb-4 flex flex-wrap items-center gap-3">
        <Input
          className="w-64"
          placeholder={t('common.search')}
          value={search}
          onChange={(event) => setSearch(event.target.value)}
        />

        <Select
          className="w-44"
          value={statusFilter}
          onChange={(event) => setStatusFilter(event.target.value)}
        >
          <option value="">{`${t('leads.filterStatus')}: ${t('common.all')}`}</option>
          {statuses.map((status) => (
            <option key={status.id} value={status.id}>
              {listLabel(status, language)}
            </option>
          ))}
        </Select>
      </div>

      {contacts.length === 0 ? (
        <EmptyState>{t('clients.empty')}</EmptyState>
      ) : filtered.length === 0 ? (
        <EmptyState>{t('clients.emptyFiltered')}</EmptyState>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {filtered.map((contact) => {
            const status = statusById[contact.status_id]
            const country = countryByIso(contact.country)

            return (
              <button
                key={contact.id}
                onClick={() => navigate(`/contacts/${contact.id}`)}
                className="rounded border border-border bg-surface p-4 text-start transition-colors hover:border-accent"
              >
                <div className="flex items-start justify-between gap-3">
                  <span className="text-sm font-medium text-text">
                    {country?.flag ? `${country.flag} ` : ''}
                    {fullName(contact)}
                  </span>
                  <span className="flex shrink-0 items-center gap-1.5">
                    <DemoBadge on={contact} />
                    {status && (
                      <Badge color={status.color}>{listLabel(status, language)}</Badge>
                    )}
                  </span>
                </div>

                <div className="mt-2 space-y-0.5 text-xs text-text-secondary">
                  {contact.country && <div>{countryName(contact.country, language)}</div>}
                  {contact.phone_number && (
                    <div dir="ltr" className="text-start">
                      {formatPhone(contact.phone_country_code, contact.phone_number)}
                    </div>
                  )}
                  {contact.converted_at && (
                    <div>
                      {t('clients.convertedOn', {
                        date: formatDate(contact.converted_at, language),
                      })}
                    </div>
                  )}
                </div>
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}
