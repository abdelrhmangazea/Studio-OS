import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { fullName, searchContacts, searchProjects } from '../lib/contacts'
import { formatPhone } from '../lib/phone'
import { useI18n } from '../i18n'
import { Input } from './ui'

/**
 * Top-bar search across name, email and phone.
 *
 * Results are grouped into leads and clients, because "is this person
 * already a client?" is usually the actual question being asked.
 * Project codes join this search in Bucket 4.
 */
export default function GlobalSearch() {
  const { t } = useI18n()
  const navigate = useNavigate()

  const [term, setTerm] = useState('')
  const [results, setResults] = useState([])
  const [projects, setProjects] = useState([])
  const [open, setOpen] = useState(false)
  const [searching, setSearching] = useState(false)
  const containerRef = useRef(null)

  // Close when clicking anywhere else.
  useEffect(() => {
    function handleClick(event) {
      if (!containerRef.current?.contains(event.target)) setOpen(false)
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  useEffect(() => {
    if (term.trim().length < 2) {
      setResults([])
      setProjects([])
      return
    }

    setSearching(true)
    const timer = setTimeout(async () => {
      try {
        const [people, found] = await Promise.all([searchContacts(term), searchProjects(term)])
        setResults(people)
        setProjects(found)
      } catch {
        setResults([])
        setProjects([])
      }
      setSearching(false)
    }, 250)

    return () => clearTimeout(timer)
  }, [term])

  const leads = results.filter((contact) => !contact.is_client)
  const clients = results.filter((contact) => contact.is_client)

  function go(contact) {
    setOpen(false)
    setTerm('')
    navigate(`/contacts/${contact.id}`)
  }

  function goProject(project) {
    setOpen(false)
    setTerm('')
    navigate(`/projects/${project.id}`)
  }

  return (
    <div ref={containerRef} className="relative w-72">
      <Input
        value={term}
        onChange={(event) => {
          setTerm(event.target.value)
          setOpen(true)
        }}
        onFocus={() => setOpen(true)}
        placeholder={t('search.placeholder')}
      />

      {open && term.trim().length > 0 && (
        <div className="absolute inset-x-0 top-full z-30 mt-1 max-h-96 overflow-y-auto rounded border border-border bg-surface">
          {term.trim().length < 2 ? (
            <p className="p-3 text-xs text-text-secondary">{t('search.hint')}</p>
          ) : searching ? (
            <p className="p-3 text-xs text-text-secondary">{t('common.loading')}</p>
          ) : results.length === 0 && projects.length === 0 ? (
            <p className="p-3 text-xs text-text-secondary">{t('search.noResults')}</p>
          ) : (
            <>
              <ResultGroup title={t('search.leadsGroup')} items={leads} onPick={go} />
              <ResultGroup title={t('search.clientsGroup')} items={clients} onPick={go} />
              <ProjectGroup title={t('search.projectsGroup')} items={projects} onPick={goProject} />
            </>
          )}
        </div>
      )}
    </div>
  )
}

function ResultGroup({ title, items, onPick }) {
  if (items.length === 0) return null

  return (
    <div className="border-b border-border last:border-0">
      <p className="px-3 pb-1 pt-2 text-xs uppercase tracking-wide text-text-secondary">{title}</p>

      {items.map((contact) => (
        <button
          key={contact.id}
          onClick={() => onPick(contact)}
          className="block w-full px-3 py-2 text-start hover:bg-bg"
        >
          <span className="block text-sm text-text">{fullName(contact)}</span>
          <span className="block text-xs text-text-secondary">
            {contact.email || formatPhone(contact.phone_country_code, contact.phone_number)}
          </span>
        </button>
      ))}
    </div>
  )
}

/** Projects match on code as well as name, which is how you find one years later. */
function ProjectGroup({ title, items, onPick }) {
  if (items.length === 0) return null

  return (
    <div className="border-b border-border last:border-0">
      <p className="px-3 pb-1 pt-2 text-xs uppercase tracking-wide text-text-secondary">{title}</p>

      {items.map((project) => (
        <button
          key={project.id}
          onClick={() => onPick(project)}
          className="block w-full px-3 py-2 text-start hover:bg-bg"
        >
          <span className="block text-sm text-text">{project.name}</span>
          <span className="block font-mono text-xs text-text-secondary" dir="ltr">
            {project.code}
          </span>
        </button>
      ))}
    </div>
  )
}
