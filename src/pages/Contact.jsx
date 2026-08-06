import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { fullName, getContact } from '../lib/contacts'
import { formatDate } from '../lib/format'
import { useLists } from '../lib/useLists'
import { useI18n } from '../i18n'
import DetailsTab from '../components/contact/DetailsTab'
import NotesTab from '../components/contact/NotesTab'
import DocumentsTab from '../components/contact/DocumentsTab'
import TasksTab from '../components/contact/TasksTab'
import PaymentsTab from '../components/contact/PaymentsTab'
import ProjectsTab from '../components/contact/ProjectsTab'
import { Badge, Card, EmptyState, Tabs } from '../components/ui'

/**
 * One contact, whether they are still a lead or already a client.
 *
 * Tabs 3 to 6 are visible but empty — they are filled in by later
 * buckets, and showing them now makes the shape of the record obvious.
 */
export default function Contact() {
  const { id } = useParams()
  const { t, language } = useI18n()
  const { statuses, sources, loading: listsLoading } = useLists()
  const navigate = useNavigate()

  const [contact, setContact] = useState(null)
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState('details')

  useEffect(() => {
    getContact(id).then((data) => {
      setContact(data)
      setLoading(false)
    })
  }, [id])

  if (loading || listsLoading) {
    return <p className="text-sm text-text-secondary">{t('common.loading')}</p>
  }

  if (!contact) return <EmptyState>{t('contact.notFound')}</EmptyState>

  const tabs = [
    { key: 'details', label: t('contact.tabDetails') },
    { key: 'log', label: t('contact.tabLog') },
    { key: 'projects', label: t('contact.tabProjects') },
    { key: 'tasks', label: t('contact.tabTasks') },
    { key: 'documents', label: t('contact.tabDocuments') },
    { key: 'payments', label: t('contact.tabPayments') },
  ]

  return (
    <div>
      {/* ---------- Header ---------- */}
      <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div>
          <button
            onClick={() => navigate(contact.is_client ? '/clients' : '/leads')}
            className="mb-2 text-sm text-text-secondary hover:text-text"
          >
            ← {t(contact.is_client ? 'nav.clients' : 'nav.leads')}
          </button>

          <h1 className="text-2xl font-semibold text-text">{fullName(contact)}</h1>

          <div className="mt-2 flex flex-wrap items-center gap-2">
            <Badge color={contact.is_client ? '#22C55E' : '#0077B6'}>
              {t(contact.is_client ? 'contact.client' : 'contact.lead')}
            </Badge>

            {contact.converted_at && (
              <span className="text-xs text-text-secondary">
                {t('contact.convertedOn', {
                  date: formatDate(contact.converted_at, language),
                })}
              </span>
            )}

            <span className="text-xs text-text-secondary">
              {t('contact.addedOn', { date: formatDate(contact.created_at, language) })}
            </span>
          </div>
        </div>

        {/* No convert button: a contact becomes a client by being moved
            onto a won status, on the Details tab or from the Leads views. */}
        {!contact.is_client && (
          <p className="max-w-xs text-xs text-text-secondary">{t('contact.convertHint')}</p>
        )}
      </div>

      {/* ---------- Tabs ---------- */}
      <Tabs tabs={tabs} active={tab} onChange={setTab} />

      <div className="pt-6">
        {tab === 'details' && (
          <DetailsTab
            contact={contact}
            onSaved={setContact}
            statuses={statuses}
            sources={sources}
          />
        )}

        {tab === 'log' && (
          <NotesTab
            contact={contact}
            onContactTouched={(timestamp) =>
              setContact((current) => ({ ...current, last_contact_at: timestamp }))
            }
          />
        )}

        {tab === 'projects' && <ProjectsTab contact={contact} />}

        {tab === 'documents' && <DocumentsTab contact={contact} />}

        {tab === 'tasks' && <TasksTab contact={contact} />}

        {tab === 'payments' && <PaymentsTab contact={contact} />}
      </div>

    </div>
  )
}
