import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { STATE_COLOR, listProjectsForContact, listStageDefinitions } from '../../lib/projects'
import { formatDate } from '../../lib/format'
import { useI18n } from '../../i18n'
import NewProjectPanel from '../project/NewProjectPanel'
import { Badge, Button, EmptyState, Loadable } from '../ui'
import DemoBadge from '../DemoBadge'

/** Every project belonging to this contact. Replaces the placeholder. */
export default function ProjectsTab({ contact }) {
  const { t, language } = useI18n()
  const navigate = useNavigate()

  const [projects, setProjects] = useState([])
  const [definitions, setDefinitions] = useState([])
  const [loading, setLoading] = useState(true)
  const [loadFailure, setLoadFailure] = useState(null)
  const [creating, setCreating] = useState(false)

  async function load() {
    // Reset both, or a successful retry leaves the old error
    // sitting on screen underneath fresh data.
    setLoading(true)
    setLoadFailure(null)
    try {
      const [rows, defs] = await Promise.all([
        listProjectsForContact(contact.id),
        listStageDefinitions(),
      ])
      setProjects(rows)
      setDefinitions(defs)
    } catch (caught) {
      setLoadFailure(caught)
    } finally {
      // Always. A failed load must never leave the
      // screen spinning with no way out.
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
  }, [contact.id])

  const stageTitle = (key) => {
    const d = definitions.find((x) => x.stage_key === key)
    return (language === 'ar' ? d?.title_ar : d?.title_en) ?? key
  }

  if (loading || loadFailure) {
    return (
      <Loadable loading={loading} failure={loadFailure} onRetry={load} t={t} />
    )
  }

  return (
    <div className="max-w-3xl">
      <div className="mb-4">
        <Button onClick={() => setCreating(true)}>{t('project.newProject')}</Button>
      </div>

      {projects.length === 0 ? (
        <EmptyState>{t('project.noneForContact')}</EmptyState>
      ) : (
        <div className="space-y-2">
          {projects.map((project) => (
            <button
              key={project.id}
              onClick={() => navigate(`/projects/${project.id}`)}
              className="flex w-full items-center justify-between gap-3 rounded border border-border bg-surface p-4 text-start hover:border-accent"
            >
              <span className="min-w-0">
                <span className="flex flex-wrap items-center gap-2">
                  <span className="font-mono text-xs text-text-secondary" dir="ltr">
                    {project.code}
                  </span>
                  <span className="text-sm text-text">{project.name}</span>
                  <DemoBadge on={project} />
                  {project.is_archived && (
                    <Badge color="#22C55E">{t('project.delivered')}</Badge>
                  )}
                </span>
                <span className="mt-1 block text-xs text-text-secondary">
                  {stageTitle(project.current_stage)} ·{' '}
                  {formatDate(project.started_at, language)}
                </span>
              </span>
              <Badge color={STATE_COLOR[project.state]}>
                {t(`project.state_${project.state}`)}
              </Badge>
            </button>
          ))}
        </div>
      )}

      <NewProjectPanel
        open={creating}
        onClose={() => setCreating(false)}
        onCreated={(id) => navigate(`/projects/${id}`)}
        fixedContactId={contact.id}
      />
    </div>
  )
}
