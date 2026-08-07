import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { STATE_COLOR, listProjects, listStageDefinitions } from '../lib/projects'
import { fullName } from '../lib/contacts'
import { formatDate } from '../lib/format'
import { useI18n } from '../i18n'
import NewProjectPanel from '../components/project/NewProjectPanel'
import { Badge, Button, EmptyState, PageTitle, Select } from '../components/ui'
import { useFeatureUse } from '../lib/useFeatureUse'

/**
 * Two tabs: Active and Delivered.
 *
 * "Delivered" rather than "Archive" on purpose — it means the design
 * work is finished, not that the relationship ended. Follow-up carries
 * on against the contact.
 */
export default function Projects() {
  useFeatureUse('projects')
  const { t, language } = useI18n()
  const navigate = useNavigate()

  const [tab, setTab] = useState('active')
  const [projects, setProjects] = useState([])
  const [definitions, setDefinitions] = useState([])
  const [loading, setLoading] = useState(true)
  const [creating, setCreating] = useState(false)
  const [stageFilter, setStageFilter] = useState('')
  const [stateFilter, setStateFilter] = useState('')
  const [yearFilter, setYearFilter] = useState('')

  async function load(which = tab) {
    setLoading(true)
    const [rows, defs] = await Promise.all([
      listProjects(which === 'delivered'),
      listStageDefinitions(),
    ])
    setProjects(rows)
    setDefinitions(defs)
    setLoading(false)
  }

  useEffect(() => {
    load(tab)
  }, [tab])

  const years = useMemo(
    () => [...new Set(projects.map((p) => new Date(p.started_at).getFullYear()))].sort(),
    [projects]
  )

  const shown = projects.filter((p) => {
    if (stageFilter && p.current_stage !== stageFilter) return false
    if (stateFilter && p.state !== stateFilter) return false
    if (yearFilter && String(new Date(p.started_at).getFullYear()) !== yearFilter) return false
    return true
  })

  const stageTitle = (key) => {
    const d = definitions.find((x) => x.stage_key === key)
    return (language === 'ar' ? d?.title_ar : d?.title_en) ?? key
  }

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <PageTitle subtitle={t('project.count', { count: shown.length })}>
          {t('nav.projects')}
        </PageTitle>
        <Button onClick={() => setCreating(true)}>{t('project.newProject')}</Button>
      </div>

      <div className="mb-4 flex flex-wrap items-center gap-3">
        <div className="flex overflow-hidden rounded border border-border">
          {['active', 'delivered'].map((which) => (
            <button
              key={which}
              onClick={() => setTab(which)}
              className={
                'px-3 py-1.5 text-sm ' +
                (tab === which ? 'bg-accent text-white' : 'bg-surface text-text-secondary')
              }
            >
              {t(which === 'active' ? 'project.tabActive' : 'project.tabDelivered')}
            </button>
          ))}
        </div>

        {/* Wrapped in fixed-width boxes: Select is w-full by design, so a
            width class passed to it would lose to its own base style. */}
        <div className="w-52">
          <Select value={stageFilter} onChange={(e) => setStageFilter(e.target.value)}>
            <option value="">{`${t('project.stage')}: ${t('common.all')}`}</option>
            {definitions.map((d) => (
              <option key={d.stage_key} value={d.stage_key}>
                {language === 'ar' ? d.title_ar : d.title_en}
              </option>
            ))}
          </Select>
        </div>

        <div className="w-48">
          <Select value={stateFilter} onChange={(e) => setStateFilter(e.target.value)}>
            <option value="">{`${t('project.state')}: ${t('common.all')}`}</option>
            {Object.keys(STATE_COLOR).map((state) => (
              <option key={state} value={state}>
                {t(`project.state_${state}`)}
              </option>
            ))}
          </Select>
        </div>

        <div className="w-32">
          <Select value={yearFilter} onChange={(e) => setYearFilter(e.target.value)}>
            <option value="">{`${t('project.year')}: ${t('common.all')}`}</option>
            {years.map((year) => (
              <option key={year} value={String(year)}>
                {year}
              </option>
            ))}
          </Select>
        </div>
      </div>

      {loading ? (
        <p className="text-sm text-text-secondary">{t('common.loading')}</p>
      ) : shown.length === 0 ? (
        <EmptyState>
          {tab === 'active' ? t('project.emptyActive') : t('project.emptyDelivered')}
        </EmptyState>
      ) : (
        <div className="overflow-x-auto rounded border border-border">
          <table className="w-full min-w-[860px] text-sm">
            <thead>
              <tr className="border-b border-border bg-surface">
                {['code', 'name', 'client', 'stage', 'state', 'lastUpdate'].map((column) => (
                  <th key={column} className="px-3 py-2.5 text-start font-medium text-text-secondary">
                    {t(`project.col_${column}`)}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {shown.map((project) => (
                <tr
                  key={project.id}
                  onClick={() => navigate(`/projects/${project.id}`)}
                  className="cursor-pointer border-b border-border last:border-0 hover:bg-surface"
                >
                  <td className="whitespace-nowrap px-3 py-2.5 font-mono text-text-secondary" dir="ltr">
                    {project.code}
                  </td>
                  <td className="px-3 py-2.5 text-text">{project.name}</td>
                  <td className="px-3 py-2.5 text-text">{fullName(project.contact)}</td>
                  <td className="px-3 py-2.5 text-text-secondary">
                    {stageTitle(project.current_stage)}
                  </td>
                  <td className="px-3 py-2.5">
                    <Badge color={STATE_COLOR[project.state]}>
                      {t(`project.state_${project.state}`)}
                    </Badge>
                  </td>
                  <td className="whitespace-nowrap px-3 py-2.5 text-text-secondary">
                    {formatDate(project.updated_at, language)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <NewProjectPanel
        open={creating}
        onClose={() => setCreating(false)}
        onCreated={(id) => navigate(`/projects/${id}`)}
      />
    </div>
  )
}
