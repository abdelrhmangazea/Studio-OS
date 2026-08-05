import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import {
  PROJECT_STATES,
  STATE_COLOR,
  buildTimeline,
  getProject,
  listChecklistItems,
  listProjectStages,
  listStageDefinitions,
  projectProgress,
  updateProject,
} from '../lib/projects'
import { getQuestionnaire, listGeneratedDocuments, listTemplates, pairByKey } from '../lib/templates'
import { listApprovals, openChangeRequests } from '../lib/portal'
import { fullName } from '../lib/contacts'
import { formatDate, formatDateTime } from '../lib/format'
import { useI18n } from '../i18n'
import StageRail from '../components/project/StageRail'
import StageView from '../components/project/StageView'
import ProgressRing from '../components/project/ProgressRing'
import PortalLinkCard from '../components/project/PortalLinkCard'
import { Badge, Button, Card, EmptyState, Field, Input, Select, Textarea } from '../components/ui'

/**
 * The project workspace — the most important screen in the product.
 *
 * Everything about a project lives here. The ten stages share one
 * StageView; nothing about this screen is per-stage except the row it
 * reads out of stage_definitions.
 */
export default function ProjectWorkspace() {
  const { id } = useParams()
  const { t, language } = useI18n()
  const navigate = useNavigate()

  const [project, setProject] = useState(null)
  const [definitions, setDefinitions] = useState([])
  const [stages, setStages] = useState([])
  const [items, setItems] = useState([])
  const [templates, setTemplates] = useState([])
  const [questionnaire, setQuestionnaire] = useState(null)
  const [documents, setDocuments] = useState([])
  const [openKey, setOpenKey] = useState(null)
  const [loading, setLoading] = useState(true)
  const [details, setDetails] = useState(null)
  const [savedDetails, setSavedDetails] = useState(false)
  const [approvals, setApprovals] = useState([])

  const load = useCallback(async () => {
    const loaded = await getProject(id)
    if (!loaded) {
      setProject(null)
      setLoading(false)
      return
    }

    const [defs, stageRows, itemRows, templateRows, q, docs, approvalRows] = await Promise.all([
      listStageDefinitions(),
      listProjectStages(id),
      listChecklistItems(id),
      listTemplates(),
      getQuestionnaire(),
      listGeneratedDocuments(loaded.contact_id),
      listApprovals(id),
    ])

    setProject(loaded)
    setDefinitions(defs)
    setStages(stageRows)
    setItems(itemRows)
    setTemplates(templateRows)
    setQuestionnaire(q)
    setApprovals(approvalRows)
    setDocuments(docs.filter((d) => d.project_id === id || d.project_id === null))
    setDetails({
      address: loaded.address ?? '',
      area_sqm: loaded.area_sqm ?? '',
      project_type: loaded.project_type ?? '',
      requirements: loaded.requirements ?? '',
    })
    setOpenKey((current) => current ?? loaded.current_stage)
    setLoading(false)
  }, [id])

  useEffect(() => {
    load()
  }, [load])

  const itemsByStage = useMemo(() => {
    const map = {}
    for (const item of items) {
      map[item.stage_key] ??= { done: 0, total: 0 }
      map[item.stage_key].total += 1
      if (item.is_done) map[item.stage_key].done += 1
    }
    return map
  }, [items])

  const pairs = useMemo(() => pairByKey(templates), [templates])

  const timeline = useMemo(
    () => buildTimeline(stages, definitions, documents, approvals, language),
    [stages, definitions, documents, approvals, language]
  )

  if (loading) return <p className="text-sm text-text-secondary">{t('common.loading')}</p>
  if (!project) return <EmptyState>{t('project.notFound')}</EmptyState>

  const definition = definitions.find((d) => d.stage_key === openKey)
  const stage = stages.find((s) => s.stage_key === openKey)
  const progress = projectProgress(stages, items)

  const stageItems = items.filter((i) => i.stage_key === openKey)
  const messagePairs = pairs.filter(
    (p) => p.type === 'message' && p.active && definition?.template_stages?.includes(p.stage)
  )
  const documentPairs = pairs
    .filter((p) => p.type === 'document' && p.active && definition?.template_stages?.includes(p.stage))
    .map((p) => ({ key: p.key, title: (p[language] ?? p.ar ?? p.en)?.title }))

  async function saveDetails() {
    const updated = await updateProject(project.id, {
      address: details.address || null,
      area_sqm: details.area_sqm === '' ? null : Number(details.area_sqm),
      project_type: details.project_type || null,
      requirements: details.requirements || null,
    })
    setProject(updated)
    setSavedDetails(true)
    setTimeout(() => setSavedDetails(false), 2000)
  }

  return (
    <div>
      {/* ---------- Header ---------- */}
      <div className="mb-6">
        <button
          onClick={() => navigate('/projects')}
          className="mb-2 text-sm text-text-secondary hover:text-text"
        >
          ← {t('nav.projects')}
        </button>

        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="flex items-center gap-4">
            <ProgressRing percent={progress} />
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-mono text-sm text-text-secondary" dir="ltr">
                  {project.code}
                </span>
                {project.is_archived && <Badge color="#22C55E">{t('project.delivered')}</Badge>}
              </div>
              <h1 className="text-2xl font-semibold text-text">{project.name}</h1>
              <p className="mt-1 text-sm">
                <Link
                  to={`/contacts/${project.contact_id}`}
                  className="text-accent hover:underline"
                >
                  {fullName(project.contact)}
                </Link>
                <span className="text-text-secondary">
                  {' · '}
                  {language === 'ar'
                    ? definitions.find((d) => d.stage_key === project.current_stage)?.title_ar
                    : definitions.find((d) => d.stage_key === project.current_stage)?.title_en}
                </span>
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <span
              className="inline-block h-2.5 w-2.5 rounded-full"
              style={{ backgroundColor: STATE_COLOR[project.state] }}
            />
            <Select
              className="w-44"
              value={project.state}
              onChange={async (event) =>
                setProject(await updateProject(project.id, { state: event.target.value }))
              }
            >
              {PROJECT_STATES.map((state) => (
                <option key={state} value={state}>
                  {t(`project.state_${state}`)}
                </option>
              ))}
            </Select>
          </div>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-[260px_1fr]">
        {/* ---------- Stage rail ---------- */}
        <div>
          <StageRail
            definitions={definitions}
            stages={stages}
            openKey={openKey}
            onOpen={setOpenKey}
            itemsByStage={itemsByStage}
          />
        </div>

        {/* ---------- The open stage ---------- */}
        <div className="min-w-0">
          {definition && stage && (
            <StageView
              definition={definition}
              stage={stage}
              items={stageItems}
              messagePairs={messagePairs}
              documentPairs={documentPairs}
              questionnaire={questionnaire}
              project={project}
              onItemsChanged={(next) =>
                setItems(items.map((i) => next.find((n) => n.id === i.id) ?? i))
              }
              onStageChanged={load}
              onFilesChanged={load}
            />
          )}

          {/* ---------- The client portal ---------- */}
          <div className="mt-6">
            <PortalLinkCard
              project={project}
              changeRequests={openChangeRequests(approvals).length}
            />
          </div>

          {/* ---------- Project details ---------- */}
          <Card className="mt-6">
            <h3 className="mb-3 text-xs uppercase tracking-wide text-text-secondary">
              {t('project.details')}
            </h3>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label={t('project.address')}>
                <Input
                  value={details.address}
                  onChange={(e) => setDetails({ ...details, address: e.target.value })}
                />
              </Field>
              <Field label={t('project.area')}>
                <Input
                  type="number"
                  value={details.area_sqm}
                  onChange={(e) => setDetails({ ...details, area_sqm: e.target.value })}
                />
              </Field>
              <Field label={t('project.type')}>
                <Input
                  value={details.project_type}
                  onChange={(e) => setDetails({ ...details, project_type: e.target.value })}
                />
              </Field>
              <div className="sm:col-span-2">
                <Field label={t('project.requirements')}>
                  <Textarea
                    rows={3}
                    value={details.requirements}
                    onChange={(e) => setDetails({ ...details, requirements: e.target.value })}
                  />
                </Field>
              </div>
            </div>
            <div className="mt-4 flex items-center gap-3">
              <Button onClick={saveDetails}>{t('common.save')}</Button>
              {savedDetails && <span className="text-sm text-success">{t('common.saved')}</span>}
            </div>
          </Card>

          {/* ---------- Timeline ---------- */}
          <Card className="mt-6">
            <h3 className="mb-3 text-xs uppercase tracking-wide text-text-secondary">
              {t('project.timeline')}
            </h3>
            {timeline.length === 0 ? (
              <p className="text-sm text-text-secondary">{t('project.timelineEmpty')}</p>
            ) : (
              <ol className="space-y-2">
                {timeline.map((event, index) => (
                  <li key={index} className="flex gap-3 text-sm">
                    <time className="w-40 shrink-0 text-xs text-text-secondary">
                      {formatDateTime(event.at, language)}
                    </time>
                    <span className="text-text">
                      {event.kind === 'stage_complete' &&
                        t(event.skipped ? 'project.eventSkipped' : 'project.eventComplete', {
                          stage: event.stage,
                        })}
                      {event.kind === 'override' && (
                        <span className="text-warning">
                          {t('project.eventOverride', { stage: event.stage })}
                          <span className="block text-xs text-text-secondary">
                            “{event.reason}”
                          </span>
                        </span>
                      )}
                      {event.kind === 'document' &&
                        t('project.eventDocument', { title: event.title })}
                      {event.kind === 'approved' && (
                        <span className="text-success">
                          {t(
                            event.onFile ? 'project.eventApprovedFile' : 'project.eventApproved',
                            { stage: event.stage }
                          )}
                        </span>
                      )}
                      {event.kind === 'changes_requested' && (
                        <span className="text-warning">
                          {t('project.eventChangesRequested', { stage: event.stage })}
                          {event.comment && (
                            <span className="block text-xs text-text-secondary">
                              “{event.comment}”
                            </span>
                          )}
                        </span>
                      )}
                    </span>
                  </li>
                ))}
              </ol>
            )}
          </Card>

          <p className="mt-3 text-xs text-text-secondary">
            {t('project.startedOn', { date: formatDate(project.started_at, language) })}
            {project.delivered_at &&
              ` · ${t('project.deliveredOn', { date: formatDate(project.delivered_at, language) })}`}
          </p>
        </div>
      </div>
    </div>
  )
}
