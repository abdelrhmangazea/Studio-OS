import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { listTasks, setTaskDone, today, withinDays } from '../lib/tasks'
import { datelessOccasions, listReminders } from '../lib/reminders'
import { listBookings, setBookingStatus } from '../lib/booking'
import { listProjects, listStageDefinitions, listChecklistItems, projectProgress } from '../lib/projects'
import { listProjectStages } from '../lib/projects'
import { listContacts, fullName } from '../lib/contacts'
import { listTemplates, pairByKey } from '../lib/templates'
import { loadInsights } from '../lib/insights'
import { STATE_COLOR } from '../lib/projects'
import { formatDate, formatDateTime } from '../lib/format'
import { useI18n } from '../i18n'
import ProgressRing from '../components/project/ProgressRing'
import InsightCard from '../components/dashboard/InsightCard'
import ReminderRow from '../components/dashboard/ReminderRow'
import { Badge, Button, Card, EmptyState, PageTitle } from '../components/ui'
import { useFeatureUse } from '../lib/useFeatureUse'

/**
 * The dashboard, and the screen the app opens on.
 *
 * Five sections, in the order the spec fixes them. Every row links to
 * the record behind it — there is no text here that leads nowhere,
 * including the five insight numbers, each of which opens its own list.
 */
export default function Dashboard() {
  useFeatureUse('dashboard')
  const { t, language } = useI18n()

  const [tasks, setTasks] = useState([])
  const [reminders, setReminders] = useState([])
  const [bookings, setBookings] = useState([])
  const [projects, setProjects] = useState([])
  const [stages, setStages] = useState([])
  const [items, setItems] = useState([])
  const [contacts, setContacts] = useState([])
  const [pairs, setPairs] = useState([])
  const [insights, setInsights] = useState(null)
  const [occasionGaps, setOccasionGaps] = useState([])
  const [loading, setLoading] = useState(true)

  async function load() {
    const [
      taskRows, reminderRows, bookingRows, projectRows,
      contactRows, templateRows, insightData,
    ] = await Promise.all([
      listTasks(),
      listReminders(),
      listBookings(),
      listProjects(),
      listContacts(),
      listTemplates(),
      loadInsights(),
    ])

    // Progress rings need each active project's stages and checklist.
    const active = projectRows.filter((p) => !p.is_archived)
    const [stageRows, itemRows] = await Promise.all([
      Promise.all(active.map((p) => listProjectStages(p.id))).then((r) => r.flat()),
      Promise.all(active.map((p) => listChecklistItems(p.id))).then((r) => r.flat()),
    ])

    setTasks(taskRows)
    setReminders(reminderRows)
    setBookings(bookingRows)
    setProjects(projectRows)
    setStages(stageRows)
    setItems(itemRows)
    setContacts(contactRows)
    setPairs(pairByKey(templateRows))
    setInsights(insightData)
    setOccasionGaps(datelessOccasions(reminderRows))
    setLoading(false)
  }

  useEffect(() => {
    load()
  }, [])

  const now = today()

  const definitions = useDefinitions()

  const stageTitle = (key) => {
    const d = definitions.find((x) => x.stage_key === key)
    return (language === 'ar' ? d?.title_ar : d?.title_en) ?? key
  }

  // ---------- section inputs ----------
  const todaysBookings = bookings.filter(
    (b) => b.slot_start?.slice(0, 10) === now && b.status !== 'cancelled'
  )
  const todaysTasks = tasks.filter((task) => task.due_date === now)
  const todaysReminders = reminders.filter((r) => r.due_date === now)

  const overdueTasks = tasks.filter((task) => task.due_date && task.due_date < now)
  const overdueReminders = reminders.filter((r) => r.due_date && r.due_date < now)
  const needsAttention = projects.filter((p) => p.state === 'needs_attention' && !p.is_archived)

  const upcoming = useMemo(() => {
    const rows = []
    for (const booking of bookings) {
      if (booking.status === 'cancelled') continue
      const date = booking.slot_start?.slice(0, 10)
      if (date && date > now && withinDays(date, 7)) {
        rows.push({ kind: 'booking', date, row: booking })
      }
    }
    for (const task of tasks) {
      if (task.due_date > now && withinDays(task.due_date, 7)) {
        rows.push({ kind: 'task', date: task.due_date, row: task })
      }
    }
    for (const reminder of reminders) {
      if (reminder.due_date > now && withinDays(reminder.due_date, 7)) {
        rows.push({ kind: 'reminder', date: reminder.due_date, row: reminder })
      }
    }
    return rows.sort((a, b) => a.date.localeCompare(b.date))
  }, [bookings, tasks, reminders, now])

  const activeClients = useMemo(() => {
    return projects
      .filter((p) => !p.is_archived && p.state !== 'closed')
      .map((project) => {
        const contact = contacts.find((c) => c.id === project.contact_id)
        const ownStages = stages.filter((s) => s.project_id === project.id)
        const ownItems = items.filter((i) => i.project_id === project.id)
        return {
          project,
          contact,
          progress: projectProgress(ownStages, ownItems),
          daysSince: contact?.last_contact_at
            ? Math.floor((Date.now() - new Date(contact.last_contact_at)) / 86400000)
            : null,
        }
      })
  }, [projects, contacts, stages, items])

  if (loading) return <p className="text-sm text-text-secondary">{t('common.loading')}</p>

  return (
    <div>
      <PageTitle>{t('nav.dashboard')}</PageTitle>

      {/* Occasion dates missing — said out loud, never skipped quietly. */}
      {occasionGaps.length > 0 && (
        <Card className="mb-6 border-warning">
          {occasionGaps.map(({ year, kinds }) => (
            <div key={year} className="mb-2">
              <p className="text-sm text-warning">
                {t('dashboard.occasionsMissing', { count: kinds.length, year })}
              </p>
              <p className="mt-1 text-xs text-text-secondary">
                {kinds.map((key) => t(`occasions.${key}`)).join(' · ')}
              </p>
            </div>
          ))}
          <Link
            to="/settings?tab=occasions"
            className="mt-2 inline-block text-sm text-accent hover:underline"
          >
            {t('dashboard.occasionsEnter')}
          </Link>
        </Card>
      )}

      {/* ---------- 2. NEEDS ATTENTION (pinned to the top) ---------- */}
      {(overdueTasks.length > 0 || overdueReminders.length > 0 || needsAttention.length > 0) && (
        <Card className="mb-6 border-warning">
          <h2 className="mb-3 text-xs uppercase tracking-wide text-warning">
            {t('dashboard.needsAttention')}
          </h2>

          <div className="space-y-2">
            {needsAttention.map((project) => (
              <Link
                key={project.id}
                to={`/projects/${project.id}`}
                className="flex items-center justify-between gap-3 rounded border border-border p-3 hover:bg-bg"
              >
                <span className="text-sm text-text">
                  <span className="font-mono text-xs text-text-secondary" dir="ltr">
                    {project.code}
                  </span>{' '}
                  {project.name}
                </span>
                <Badge color={STATE_COLOR[project.state]}>
                  {t(`project.state_${project.state}`)}
                </Badge>
              </Link>
            ))}

            {overdueTasks.map((task) => (
              <DashTask key={task.id} task={task} onChanged={load} language={language} t={t} overdue />
            ))}

            {overdueReminders.map((reminder) => (
              <ReminderRow
                key={reminder.id}
                reminder={reminder}
                pairs={pairs}
                language={language}
                t={t}
                onChanged={load}
                overdue
              />
            ))}
          </div>
        </Card>
      )}

      {/* ---------- 1. TODAY ---------- */}
      <Card className="mb-6">
        <h2 className="mb-3 text-xs uppercase tracking-wide text-text-secondary">
          {t('dashboard.today')}
        </h2>

        {todaysBookings.length === 0 && todaysTasks.length === 0 && todaysReminders.length === 0 ? (
          <p className="text-sm text-text-secondary">{t('dashboard.todayEmpty')}</p>
        ) : (
          <div className="space-y-2">
            {todaysBookings.map((booking) => (
              <div
                key={booking.id}
                className="flex flex-wrap items-center justify-between gap-3 rounded border border-border p-3"
              >
                <div>
                  <p className="text-sm text-text">{booking.client_name}</p>
                  <p className="text-xs text-text-secondary">
                    {formatDateTime(booking.slot_start, language)}
                    {booking.project && (
                      <>
                        {' · '}
                        <Link
                          to={`/projects/${booking.project.id}`}
                          className="font-mono text-accent hover:underline"
                          dir="ltr"
                        >
                          {booking.project.code}
                        </Link>
                      </>
                    )}
                  </p>
                </div>
                <Button
                  variant="secondary"
                  className="px-2 py-1"
                  onClick={async () => {
                    await setBookingStatus(booking.id, 'completed')
                    load()
                  }}
                >
                  {t('dashboard.markDone')}
                </Button>
              </div>
            ))}

            {todaysTasks.map((task) => (
              <DashTask key={task.id} task={task} onChanged={load} language={language} t={t} />
            ))}

            {todaysReminders.map((reminder) => (
              <ReminderRow
                key={reminder.id}
                reminder={reminder}
                pairs={pairs}
                language={language}
                t={t}
                onChanged={load}
              />
            ))}
          </div>
        )}
      </Card>

      {/* ---------- 3. UPCOMING — the next 7 days ---------- */}
      <Card className="mb-6">
        <h2 className="mb-3 text-xs uppercase tracking-wide text-text-secondary">
          {t('dashboard.upcoming')}
        </h2>

        {upcoming.length === 0 ? (
          <p className="text-sm text-text-secondary">{t('dashboard.upcomingEmpty')}</p>
        ) : (
          <ol className="space-y-2">
            {upcoming.map((entry, index) => (
              <li key={index} className="flex flex-wrap items-center gap-3 text-sm">
                <time className="w-32 shrink-0 text-xs text-text-secondary">
                  {formatDate(entry.date, language)}
                </time>
                {entry.kind === 'booking' && (
                  <Link
                    to="/booking-setup"
                    className="text-accent hover:underline"
                  >
                    {t('dashboard.consultationWith', { name: entry.row.client_name })}
                  </Link>
                )}
                {entry.kind === 'task' && (
                  <Link
                    to={entry.row.project ? `/projects/${entry.row.project.id}` : '/tasks'}
                    className="text-text hover:text-accent"
                  >
                    {entry.row.title}
                  </Link>
                )}
                {entry.kind === 'reminder' && (
                  <Link
                    to={`/contacts/${entry.row.contact_id}`}
                    className="text-text hover:text-accent"
                  >
                    {t(`reminders.kind_${entry.row.kind}`)}
                    {entry.row.contact && ` · ${fullName(entry.row.contact)}`}
                  </Link>
                )}
              </li>
            ))}
          </ol>
        )}
      </Card>

      {/* ---------- 4. ACTIVE CLIENTS ---------- */}
      <Card className="mb-6">
        <h2 className="mb-3 text-xs uppercase tracking-wide text-text-secondary">
          {t('dashboard.activeClients')}
        </h2>

        {activeClients.length === 0 ? (
          <p className="text-sm text-text-secondary">{t('dashboard.activeClientsEmpty')}</p>
        ) : (
          <div className="space-y-2">
            {activeClients.map(({ project, contact, progress, daysSince }) => (
              <Link
                key={project.id}
                to={`/projects/${project.id}`}
                className="flex flex-wrap items-center gap-4 rounded border border-border p-3 hover:bg-bg"
              >
                <ProgressRing percent={progress} size={40} />
                <div className="min-w-0 flex-1">
                  <p className="text-sm text-text">
                    {contact ? fullName(contact) : project.name}
                  </p>
                  <p className="text-xs text-text-secondary">
                    {stageTitle(project.current_stage)}
                    {daysSince !== null && ` · ${t('dashboard.daysSince', { days: daysSince })}`}
                  </p>
                </div>
                <Badge color={STATE_COLOR[project.state]}>
                  {t(`project.state_${project.state}`)}
                </Badge>
              </Link>
            ))}
          </div>
        )}
      </Card>

      {/* ---------- 5. INSIGHTS — every number opens its list ---------- */}
      {insights && (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <InsightCard
            label={t('insights.leadsThisMonth')}
            value={insights.leadsThisMonth.count}
            rows={insights.leadsThisMonth.rows}
            render={(c) => ({ to: `/contacts/${c.id}`, text: fullName(c) })}
            t={t}
          />

          <InsightCard
            label={t('insights.toConsultation')}
            value={insights.toConsultation.percent === null ? '—' : `${insights.toConsultation.percent}%`}
            note={t('insights.ratio', {
              a: insights.toConsultation.numerator,
              b: insights.toConsultation.denominator,
            })}
            rows={insights.toConsultation.rows}
            render={(c) => ({ to: `/contacts/${c.id}`, text: fullName(c) })}
            t={t}
          />

          <InsightCard
            label={t('insights.toContract')}
            value={insights.toContract.percent === null ? '—' : `${insights.toContract.percent}%`}
            // Not a monthly figure: projects past the contract gate
            // over every client, so it needs its own wording.
            note={t('insights.ratioClients', {
              a: insights.toContract.numerator,
              b: insights.toContract.denominator,
            })}
            rows={insights.toContract.rows}
            render={(p) => ({ to: `/projects/${p.id}`, text: `${p.code} · ${p.name}` })}
            t={t}
          />

          <InsightCard
            label={t('insights.activeProjects')}
            value={insights.activeProjects.count}
            rows={insights.activeProjects.rows}
            render={(p) => ({ to: `/projects/${p.id}`, text: `${p.code} · ${p.name}` })}
            t={t}
          />

          <InsightCard
            label={t('insights.averageValue')}
            value={insights.value.average === null ? '—' : insights.value.average.toLocaleString()}
            // How much of this number the designer set themselves.
            note={t('insights.valueCoverage', {
              covering: insights.value.covering,
              entered: insights.value.fromEntered,
              invoices: insights.value.fromInvoices,
            })}
            rows={insights.value.rows}
            render={(p) => ({
              to: `/projects/${p.id}`,
              text: `${p.code} · ${p.resolved.toLocaleString()}`,
              hint: t(`insights.basis_${p.basis}`),
            })}
            t={t}
          />
        </div>
      )}
    </div>
  )
}

/** Stage definitions, loaded once for the labels on the client rows. */
function useDefinitions() {
  const [definitions, setDefinitions] = useState([])
  useEffect(() => {
    listStageDefinitions().then(setDefinitions)
  }, [])
  return definitions
}

function DashTask({ task, onChanged, language, t, overdue }) {
  return (
    <div className="flex flex-wrap items-center gap-3 rounded border border-border p-3">
      <button
        onClick={async () => {
          await setTaskDone(task.id, true)
          onChanged()
        }}
        className="h-4 w-4 shrink-0 rounded border border-border hover:border-accent"
        title={t('tasks.markDone')}
      />
      <div className="min-w-0 flex-1">
        <p className="text-sm text-text">{task.title}</p>
        <p className="flex flex-wrap gap-x-2 text-xs text-text-secondary">
          {task.project && (
            <Link to={`/projects/${task.project.id}`} className="font-mono text-accent hover:underline" dir="ltr">
              {task.project.code}
            </Link>
          )}
          {task.contact && (
            <Link to={`/contacts/${task.contact.id}`} className="text-accent hover:underline">
              {fullName(task.contact)}
            </Link>
          )}
          {task.due_date && (
            <span className={overdue ? 'text-warning' : ''}>
              {formatDate(task.due_date, language)}
            </span>
          )}
        </p>
      </div>
    </div>
  )
}
