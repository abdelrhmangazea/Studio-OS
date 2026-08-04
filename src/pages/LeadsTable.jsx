import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { contactClock, fullName, updateContact } from '../lib/contacts'
import { conversionPatch } from '../lib/conversion'
import { daysSince, stalenessColor } from '../lib/phone'
import { formatDate } from '../lib/format'
import { listLabel, selectableList } from '../lib/useLists'
import { useI18n } from '../i18n'
import { EmptyState, Input, Select } from '../components/ui'

/**
 * The spreadsheet view.
 *
 * Cells are edited in place and saved as soon as you leave them. Clicking
 * anywhere on a row that is not a form control opens the contact card.
 */

const COLUMNS = [
  { key: 'name', labelKey: 'columns.name' },
  { key: 'phone', labelKey: 'columns.phone' },
  { key: 'email', labelKey: 'columns.email' },
  { key: 'source', labelKey: 'columns.source' },
  { key: 'status', labelKey: 'columns.status' },
  { key: 'lastContact', labelKey: 'columns.lastContact' },
  { key: 'nextAction', labelKey: 'columns.nextAction' },
  { key: 'days', labelKey: 'columns.daysSince' },
]

export default function LeadsTable({ contacts, statuses, sources, onChanged }) {
  const { t, language } = useI18n()
  const navigate = useNavigate()

  const [sortKey, setSortKey] = useState('days')
  const [sortDescending, setSortDescending] = useState(true)

  const statusById = useMemo(
    () => Object.fromEntries(statuses.map((status) => [status.id, status])),
    [statuses]
  )
  const sourceById = useMemo(
    () => Object.fromEntries(sources.map((source) => [source.id, source])),
    [sources]
  )

  function sortValue(contact, key) {
    switch (key) {
      case 'name':
        return fullName(contact).toLowerCase()
      case 'phone':
        return contact.phone_number ?? ''
      case 'email':
        return (contact.email ?? '').toLowerCase()
      case 'source':
        return listLabel(sourceById[contact.source_id], language).toLowerCase()
      case 'status':
        return statusById[contact.status_id]?.sort_order ?? 999
      case 'lastContact':
        return contact.last_contact_at ?? ''
      case 'nextAction':
        return contact.next_action_at ?? ''
      case 'days':
        return daysSince(contactClock(contact)) ?? -1
      default:
        return ''
    }
  }

  const sorted = useMemo(() => {
    const copy = [...contacts]
    copy.sort((a, b) => {
      const left = sortValue(a, sortKey)
      const right = sortValue(b, sortKey)
      if (left < right) return sortDescending ? 1 : -1
      if (left > right) return sortDescending ? -1 : 1
      return 0
    })
    return copy
  }, [contacts, sortKey, sortDescending, language, statusById, sourceById])

  function toggleSort(key) {
    if (key === sortKey) {
      setSortDescending((current) => !current)
    } else {
      setSortKey(key)
      setSortDescending(false)
    }
  }

  /**
   * Optimistic: update the row on screen, then persist.
   *
   * Moving a lead onto a won status converts them to a client in the
   * same write, which is why the conversion patch is merged in here
   * rather than handled as a separate action.
   */
  async function saveField(contact, field, value) {
    const next = value === '' ? null : value
    if ((contact[field] ?? null) === next) return

    const extra = field === 'status_id' ? conversionPatch(contact, next, statuses) : {}
    const updated = { ...contact, [field]: next, ...extra }

    onChanged(updated)
    try {
      await updateContact(contact.id, { [field]: next, ...extra })
    } catch {
      onChanged(contact) // put it back if the database refused
    }
  }

  if (contacts.length === 0) return <EmptyState>{t('leads.emptyFiltered')}</EmptyState>

  return (
    <div className="overflow-x-auto rounded border border-border">
      <table className="w-full min-w-[1000px] text-sm">
        <thead>
          <tr className="border-b border-border bg-surface">
            {COLUMNS.map((column) => (
              <th
                key={column.key}
                onClick={() => toggleSort(column.key)}
                className="cursor-pointer px-3 py-2.5 text-start font-medium text-text-secondary hover:text-text"
              >
                {t(column.labelKey)}
                {sortKey === column.key && (
                  <span className="ms-1 text-accent">{sortDescending ? '▾' : '▴'}</span>
                )}
              </th>
            ))}
          </tr>
        </thead>

        <tbody>
          {sorted.map((contact) => {
            const days = daysSince(contactClock(contact))

            return (
              <tr
                key={contact.id}
                onClick={(event) => {
                  // Ignore clicks that land on an editable control.
                  if (event.target.closest('input, select, textarea')) return
                  navigate(`/contacts/${contact.id}`)
                }}
                className="cursor-pointer border-b border-border last:border-0 hover:bg-surface"
              >
                <td className="px-3 py-1.5">
                  <div className="flex gap-1">
                    <Input
                      className="px-2 py-1"
                      defaultValue={contact.first_name ?? ''}
                      onBlur={(e) => saveField(contact, 'first_name', e.target.value.trim())}
                    />
                    <Input
                      className="px-2 py-1"
                      defaultValue={contact.last_name ?? ''}
                      onBlur={(e) => saveField(contact, 'last_name', e.target.value.trim())}
                    />
                  </div>
                </td>

                {/* dir="ltr" so "+20" is not rendered as "20+" in Arabic.
                    Phone numbers read left-to-right in every language. */}
                <td className="px-3 py-1.5">
                  <div dir="ltr" className="flex items-center gap-1">
                    <span className="whitespace-nowrap text-text-secondary">
                      {contact.phone_country_code}
                    </span>
                    <Input
                      className="px-2 py-1"
                      defaultValue={contact.phone_number ?? ''}
                      inputMode="numeric"
                      onBlur={(e) =>
                        saveField(contact, 'phone_number', e.target.value.replace(/\D/g, ''))
                      }
                    />
                  </div>
                </td>

                <td className="px-3 py-1.5">
                  <Input
                    className="px-2 py-1"
                    type="email"
                    defaultValue={contact.email ?? ''}
                    onBlur={(e) => saveField(contact, 'email', e.target.value.trim())}
                  />
                </td>

                <td className="px-3 py-1.5">
                  <Select
                    className="min-w-32 px-2 py-1"
                    value={contact.source_id ?? ''}
                    onChange={(e) => saveField(contact, 'source_id', e.target.value)}
                  >
                    <option value="">{t('common.none')}</option>
                    {selectableList(sources, contact.source_id).map((source) => (
                      <option key={source.id} value={source.id}>
                        {listLabel(source, language)}
                      </option>
                    ))}
                  </Select>
                </td>

                <td className="px-3 py-1.5">
                  {/* The colour lives in a dot, not in the text — tinting the
                      select itself makes a grey status look disabled. */}
                  <div className="flex items-center gap-2">
                    <span
                      className="inline-block h-2 w-2 shrink-0 rounded-full"
                      style={{
                        backgroundColor: statusById[contact.status_id]?.color ?? 'transparent',
                      }}
                    />
                    <Select
                      className="min-w-32 px-2 py-1"
                      value={contact.status_id ?? ''}
                      onChange={(e) => saveField(contact, 'status_id', e.target.value)}
                    >
                      <option value="">{t('common.none')}</option>
                      {selectableList(statuses, contact.status_id).map((status) => (
                        <option key={status.id} value={status.id}>
                          {listLabel(status, language)}
                        </option>
                      ))}
                    </Select>
                  </div>
                </td>

                <td className="whitespace-nowrap px-3 py-1.5 text-text-secondary">
                  {contact.last_contact_at
                    ? formatDate(contact.last_contact_at, language)
                    : t('common.never')}
                </td>

                <td className="px-3 py-1.5">
                  <Input
                    className="px-2 py-1"
                    type="date"
                    defaultValue={contact.next_action_at ?? ''}
                    onBlur={(e) => saveField(contact, 'next_action_at', e.target.value)}
                  />
                </td>

                <td className={`whitespace-nowrap px-3 py-1.5 font-medium ${stalenessColor(days)}`}>
                  {days === null ? t('common.none') : days}
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
