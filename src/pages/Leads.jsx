import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { fullName, listContacts } from '../lib/contacts'
import { listLabel, useLists } from '../lib/useLists'
import { useI18n } from '../i18n'
import LeadsTable from './LeadsTable'
import LeadsKanban from './LeadsKanban'
import AddLeadPanel from '../components/AddLeadPanel'
import CsvImport from '../components/CsvImport'
import { Button, EmptyState, PageTitle, Select } from '../components/ui'

/**
 * Leads: two views of the same rows.
 *
 * Only contacts with is_client = false appear here. Converting a lead
 * moves it out of both views and into Clients, without copying anything.
 */
export default function Leads() {
  const { t, language } = useI18n()
  const { statuses, sources, loading: listsLoading } = useLists()

  const [contacts, setContacts] = useState([])
  const [loading, setLoading] = useState(true)
  const [view, setView] = useState('table')
  const [statusFilter, setStatusFilter] = useState('')
  const [sourceFilter, setSourceFilter] = useState('')
  const [adding, setAdding] = useState(false)
  const [importing, setImporting] = useState(false)
  const [justConverted, setJustConverted] = useState(null)

  async function load() {
    setLoading(true)
    setContacts(await listContacts(false))
    setLoading(false)
  }

  useEffect(() => {
    load()
  }, [])

  const filtered = useMemo(
    () =>
      contacts.filter((contact) => {
        if (statusFilter && contact.status_id !== statusFilter) return false
        if (sourceFilter && contact.source_id !== sourceFilter) return false
        return true
      }),
    [contacts, statusFilter, sourceFilter]
  )

  /**
   * A lead that has just been moved onto a won status is now a client,
   * so it leaves these views. The banner explains where it went —
   * without it, the row would simply vanish.
   */
  function replaceContact(updated) {
    if (updated.is_client) {
      setContacts((current) => current.filter((contact) => contact.id !== updated.id))
      setJustConverted(updated)
      return
    }
    setContacts((current) =>
      current.map((contact) => (contact.id === updated.id ? updated : contact))
    )
  }

  if (loading || listsLoading) {
    return <p className="text-sm text-text-secondary">{t('common.loading')}</p>
  }

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <PageTitle subtitle={t('leads.count', { count: filtered.length })}>
          {t('leads.title')}
        </PageTitle>

        <div className="flex flex-wrap items-center gap-2">
          <Button variant="secondary" onClick={() => setImporting(true)}>
            {t('leads.importCsv')}
          </Button>
          <Button onClick={() => setAdding(true)}>{t('leads.addLead')}</Button>
        </div>
      </div>

      <div className="mb-4 flex flex-wrap items-center gap-3">
        {/* View toggle */}
        <div className="flex overflow-hidden rounded border border-border">
          {['table', 'kanban'].map((mode) => (
            <button
              key={mode}
              onClick={() => setView(mode)}
              className={
                'px-3 py-1.5 text-sm ' +
                (view === mode ? 'bg-accent text-white' : 'bg-surface text-text-secondary')
              }
            >
              {t(mode === 'table' ? 'leads.tableView' : 'leads.kanbanView')}
            </button>
          ))}
        </div>

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

        <Select
          className="w-44"
          value={sourceFilter}
          onChange={(event) => setSourceFilter(event.target.value)}
        >
          <option value="">{`${t('leads.filterSource')}: ${t('common.all')}`}</option>
          {sources.map((source) => (
            <option key={source.id} value={source.id}>
              {listLabel(source, language)}
            </option>
          ))}
        </Select>

        {(statusFilter || sourceFilter) && (
          <Button
            variant="ghost"
            onClick={() => {
              setStatusFilter('')
              setSourceFilter('')
            }}
          >
            {t('common.clear')}
          </Button>
        )}
      </div>

      {justConverted && (
        <div className="mb-4 flex items-center justify-between gap-3 rounded border border-success px-4 py-2.5">
          <span className="text-sm text-text">
            {t('leads.convertedNotice', { name: fullName(justConverted) })}
          </span>
          <div className="flex items-center gap-2">
            <Link to={`/contacts/${justConverted.id}`} className="text-sm text-accent hover:underline">
              {t('leads.openClient')}
            </Link>
            <button
              onClick={() => setJustConverted(null)}
              className="text-lg leading-none text-text-secondary hover:text-text"
              aria-label="close"
            >
              ×
            </button>
          </div>
        </div>
      )}

      {contacts.length === 0 ? (
        <EmptyState>{t('leads.empty')}</EmptyState>
      ) : view === 'table' ? (
        <LeadsTable
          contacts={filtered}
          statuses={statuses}
          sources={sources}
          onChanged={replaceContact}
        />
      ) : (
        <LeadsKanban
          contacts={filtered}
          statuses={statuses}
          sources={sources}
          onChanged={replaceContact}
        />
      )}

      <AddLeadPanel
        open={adding}
        onClose={() => setAdding(false)}
        onCreated={(created) =>
          created.is_client
            ? setJustConverted(created)
            : setContacts((current) => [created, ...current])
        }
        statuses={statuses}
        sources={sources}
      />

      <CsvImport
        open={importing}
        onClose={() => setImporting(false)}
        onImported={load}
        statuses={statuses}
        sources={sources}
      />
    </div>
  )
}
