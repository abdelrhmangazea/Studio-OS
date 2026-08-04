import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { contactClock, fullName, updateContact } from '../lib/contacts'
import { conversionPatch } from '../lib/conversion'
import { daysSince, stalenessColor } from '../lib/phone'
import { listLabel } from '../lib/useLists'
import { useI18n } from '../i18n'

/**
 * One column per active status, in sort_order. Drag a card to another
 * column to change that lead's status.
 *
 * Native HTML5 drag and drop — no library. RTL needs no special handling
 * because the columns are a plain flex row, which the browser reverses.
 */
export default function LeadsKanban({ contacts, statuses, sources, onChanged }) {
  const { t, language } = useI18n()
  const navigate = useNavigate()

  const [draggingId, setDraggingId] = useState(null)
  const [overStatusId, setOverStatusId] = useState(null)

  const columns = statuses.filter((status) => status.is_active)
  const sourceById = Object.fromEntries(sources.map((source) => [source.id, source]))

  /**
   * Dropping a card on a won column converts that lead to a client, so
   * the card leaves the board entirely. That is the intended behaviour:
   * booking is the conversion.
   */
  async function moveTo(contact, statusId) {
    if (contact.status_id === statusId) return

    const extra = conversionPatch(contact, statusId, statuses)

    onChanged({ ...contact, status_id: statusId, ...extra })
    try {
      await updateContact(contact.id, { status_id: statusId, ...extra })
    } catch {
      onChanged(contact)
    }
  }

  function handleDrop(event, statusId) {
    event.preventDefault()
    setOverStatusId(null)
    setDraggingId(null)

    const contact = contacts.find((item) => item.id === event.dataTransfer.getData('text/plain'))
    if (contact) moveTo(contact, statusId)
  }

  return (
    <div className="flex gap-4 overflow-x-auto pb-4">
      {columns.map((status) => {
        const cards = contacts.filter((contact) => contact.status_id === status.id)
        const isTarget = overStatusId === status.id

        return (
          <div
            key={status.id}
            onDragOver={(event) => {
              event.preventDefault()
              setOverStatusId(status.id)
            }}
            onDragLeave={() => setOverStatusId((current) => (current === status.id ? null : current))}
            onDrop={(event) => handleDrop(event, status.id)}
            className={
              'flex w-64 shrink-0 flex-col rounded border bg-surface ' +
              (isTarget ? 'border-accent' : 'border-border')
            }
          >
            <div className="flex items-center justify-between border-b border-border px-3 py-2.5">
              <span className="flex items-center gap-2 text-sm font-medium text-text">
                <span
                  className="inline-block h-2 w-2 rounded-full"
                  style={{ backgroundColor: status.color }}
                />
                {listLabel(status, language)}
              </span>
              <span className="text-xs text-text-secondary">{cards.length}</span>
            </div>

            <div className="flex min-h-[120px] flex-col gap-2 p-2">
              {cards.map((contact) => {
                const days = daysSince(contactClock(contact))

                return (
                  <div
                    key={contact.id}
                    draggable
                    onDragStart={(event) => {
                      event.dataTransfer.setData('text/plain', contact.id)
                      setDraggingId(contact.id)
                    }}
                    onDragEnd={() => setDraggingId(null)}
                    onClick={() => navigate(`/contacts/${contact.id}`)}
                    className={
                      'cursor-pointer rounded border border-border bg-bg p-3 ' +
                      (draggingId === contact.id ? 'opacity-40' : 'hover:border-accent')
                    }
                  >
                    <div className="text-sm text-text">{fullName(contact)}</div>
                    <div className="mt-1 flex items-center justify-between text-xs">
                      <span className="text-text-secondary">
                        {listLabel(sourceById[contact.source_id], language) || t('common.none')}
                      </span>
                      <span className={stalenessColor(days)}>
                        {days === null ? t('common.none') : `${days}d`}
                      </span>
                    </div>
                  </div>
                )
              })}

              {isTarget && cards.length === 0 && (
                <div className="rounded border border-dashed border-accent p-4 text-center text-xs text-text-secondary">
                  {t('leads.dropHere')}
                </div>
              )}
            </div>
          </div>
        )
      })}
    </div>
  )
}
