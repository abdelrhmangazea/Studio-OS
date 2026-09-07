import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { setTaskDone, today, withinDays } from '../lib/tasks'
import { setBookingStatus } from '../lib/booking'
import { STATE_COLOR } from '../lib/projects'
import { fullName } from '../lib/contacts'
import { formatDate, formatDateTime } from '../lib/format'
import { computeDashboard, loadDashboardData } from '../lib/dashboardStats'
import { useAuth } from '../lib/AuthContext'
import { useI18n } from '../i18n'
import ReminderRow from '../components/dashboard/ReminderRow'
import {
  ColumnChart, HBars, Meter, StackedBar, StatTile,
  compactNumber, formatNumber, monthLabel,
} from '../components/dashboard/charts'
import { Badge, Button, Card, Loadable, PageTitle } from '../components/ui'
import { useFeatureUse } from '../lib/useFeatureUse'

/**
 * The dashboard, and the screen the app opens on.
 *
 * Top to bottom: the five numbers, every project's progress, where the
 * work stands, money and pipeline, then the day's agenda. What needs
 * attention sits LAST — the first thing a studio sees is its business,
 * not its problems. Every figure still links to the rows behind it.
 */
export default function Dashboard() {
  useFeatureUse('dashboard')
  const { t } = useI18n()

  const [data, setData] = useState(null)
  const [refreshing, setRefreshing] = useState(false)
  const [loadFailure, setLoadFailure] = useState(null)

  async function load() {
    // A refetch after "done" holds the previous render, faded — the
    // screen never flashes back to a spinner.
    if (data) setRefreshing(true)
    setLoadFailure(null)
    try {
      setData(await loadDashboardData())
    } catch (caught) {
      setLoadFailure(caught)
    } finally {
      setRefreshing(false)
    }
  }

  useEffect(() => {
    load()
  }, [])

  if (!data || loadFailure) {
    return <Loadable loading={!data && !loadFailure} failure={loadFailure} onRetry={load} t={t} />
  }

  return <DashboardView data={data} onChanged={load} refreshing={refreshing} />
}

const PROGRESS_ROWS = 8
const OVERDUE_ROWS = 6
const ORDINAL = ['var(--chart-ordinal-1)', 'var(--chart-ordinal-2)', 'var(--chart-ordinal-3)', 'var(--chart-ordinal-4)']
const LOCALE = { ar: 'ar-EG-u-nu-latn', en: 'en-GB' }

/** Pure: renders from rows already loaded, so a fixture can drive it. */
export function DashboardView({ data, onChanged, refreshing }) {
  const { t, language } = useI18n()
  const { settings } = useAuth()
  const currency = settings?.currency ?? ''

  const now = today()
  const stats = useMemo(() => computeDashboard(data), [data])
  const { tasks, reminders, bookings, projects, pairs, occasionGaps, definitions } = data

  const stageTitle = (key) => {
    const d = definitions.find((x) => x.stage_key === key)
    return (language === 'ar' ? d?.title_ar : d?.title_en) ?? key
  }
  const money = (n) => `${formatNumber(n, language)}${currency ? ` ${currency}` : ''}`
  const monthTitle = new Intl.DateTimeFormat(LOCALE[language] ?? LOCALE.en, {
    month: 'long',
    year: 'numeric',
  }).format(new Date())

  // ---------- agenda inputs ----------
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
      if (date && date > now && withinDays(date, 7)) rows.push({ kind: 'booking', date, row: booking })
    }
    for (const task of tasks) {
      if (task.due_date > now && withinDays(task.due_date, 7)) rows.push({ kind: 'task', date: task.due_date, row: task })
    }
    for (const reminder of reminders) {
      if (reminder.due_date > now && withinDays(reminder.due_date, 7)) {
        rows.push({ kind: 'reminder', date: reminder.due_date, row: reminder })
      }
    }
    return rows.sort((a, b) => a.date.localeCompare(b.date))
  }, [bookings, tasks, reminders, now])

  const revenuePoints = stats.invoicedByMonth.map((m) => ({
    key: m.key,
    label: monthLabel(m.date, language),
    longLabel: new Intl.DateTimeFormat(LOCALE[language] ?? LOCALE.en, { month: 'long', year: 'numeric' }).format(m.date),
    value: m.value,
  }))

  const attentionCount = overdueTasks.length + overdueReminders.length + needsAttention.length

  return (
    <div className={refreshing ? 'is-faded' : ''}>
      <PageTitle subtitle={t('dashboard.subtitle', { month: monthTitle })}>{t('nav.dashboard')}</PageTitle>

      {/* ---------- 1. THE FIVE NUMBERS ---------- */}
      <div className="mb-4 grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
        <StatTile
          label={t('dashboard.kpiActive')}
          value={stats.activeCount}
          note={t('dashboard.kpiActiveNote', { n: stats.onTrackCount })}
          to="/projects"
        />
        <StatTile
          label={t('dashboard.kpiPortfolio')}
          value={stats.valuedCount ? compactNumber(stats.portfolioValue, language) : '—'}
          suffix={stats.valuedCount ? currency : null}
          note={t('dashboard.kpiPortfolioNote', { n: stats.valuedCount, total: stats.activeCount })}
          to="/projects"
        />
        <StatTile
          label={t('dashboard.kpiInvoiced')}
          value={compactNumber(stats.invoiced.thisMonth, language)}
          suffix={currency}
          delta={stats.invoiced.delta}
          deltaLabel={t('dashboard.vsLastMonth')}
          trend={stats.invoicedByMonth.map((m) => m.value)}
          to="/reports"
        />
        <StatTile
          label={t('dashboard.kpiLeads')}
          value={stats.leads.thisMonth}
          delta={stats.leads.delta}
          deltaLabel={t('dashboard.vsLastMonth')}
          trend={stats.leadsByMonth.map((m) => m.value)}
          to="/leads"
        />
        <StatTile
          label={t('dashboard.kpiConversion')}
          value={stats.conversion.percent === null ? '—' : `${stats.conversion.percent}%`}
          note={t('dashboard.kpiConversionNote', {
            a: stats.conversion.numerator,
            b: stats.conversion.denominator,
          })}
          to="/reports"
        />
      </div>

      {/* ---------- 2. EVERY PROJECT'S PROGRESS · WHERE THEY STAND ---------- */}
      <div className="mb-4 grid gap-4 xl:grid-cols-5">
        <Card className="min-w-0 xl:col-span-3">
          <CardHeader
            title={t('dashboard.progressTitle')}
            hint={
              stats.avgProgress === null
                ? null
                : t('dashboard.progressHint', { percent: stats.avgProgress, n: stats.portfolio.length })
            }
          />
          {stats.portfolio.length === 0 ? (
            <p className="t-body text-text-secondary">{t('dashboard.progressEmpty')}</p>
          ) : (
            <div className="divide-y divide-separator-soft">
              {stats.portfolio.slice(0, PROGRESS_ROWS).map(({ project, contact, progress, daysSince }) => (
                <Link
                  key={project.id}
                  to={`/projects/${project.id}`}
                  className="grid items-center gap-x-4 gap-y-1.5 py-3 hover:opacity-80 sm:grid-cols-[minmax(0,1.6fr)_minmax(0,1.4fr)_3rem_auto]"
                >
                  <div className="min-w-0">
                    <p className="t-row-label truncate text-text">{project.name}</p>
                    <p className="t-meta truncate text-text-secondary">
                      {contact ? fullName(contact) : project.code}
                      {' · '}
                      {stageTitle(project.current_stage)}
                      {daysSince !== null && daysSince > 7 && ` · ${t('dashboard.daysSince', { days: daysSince })}`}
                    </p>
                  </div>
                  <Meter percent={progress} />
                  <span className="tabular t-meta text-end font-medium text-text">{progress}%</span>
                  <span className="justify-self-start sm:justify-self-end">
                    <Badge color={STATE_COLOR[project.state]}>{t(`project.state_${project.state}`)}</Badge>
                  </span>
                </Link>
              ))}
            </div>
          )}
          {stats.portfolio.length > PROGRESS_ROWS && (
            <Link to="/projects" className="t-meta mt-3 inline-block text-accent hover:underline">
              {t('dashboard.seeAllProjects', { n: stats.portfolio.length })}
            </Link>
          )}
        </Card>

        <Card className="min-w-0 xl:col-span-2">
          <CardHeader title={t('dashboard.stageTitle')} hint={t('dashboard.stageHint')} />
          <HBars
            rows={stats.byStage
              // Delivered and follow-up hold archived work, so they are
              // shown only when something is actually sitting there.
              .filter((s, index) => index < 8 || s.count > 0)
              .map((s) => ({
                key: s.key,
                label: language === 'ar' ? s.title_ar : s.title_en,
                value: s.count,
              }))}
            labelClass="w-36 sm:w-40"
          />
          <div className="mt-5 border-t border-separator-soft pt-4">
            <p className="t-section mb-3">{t('dashboard.stateTitle')}</p>
            <StackedBar
              segments={stats.byState.map((s) => ({
                key: s.key,
                label: t(`project.state_${s.key}`),
                count: s.count,
                color: STATE_COLOR[s.key],
              }))}
            />
          </div>
        </Card>
      </div>

      {/* ---------- 3. MONEY · PIPELINE ---------- */}
      <div className="mb-4 grid gap-4 xl:grid-cols-5">
        <Card className="min-w-0 xl:col-span-3">
          <CardHeader
            title={t('dashboard.revenueTitle')}
            hint={t('dashboard.revenueHint', { total: formatNumber(stats.invoiced.twelveMonths, language), currency })}
          />
          <ColumnChart
            points={revenuePoints}
            language={language}
            format={money}
            highlightIndex={revenuePoints.length - 1}
            height={280}
            tableLabel={t('dashboard.showTable')}
            chartLabel={t('dashboard.showChart')}
            periodLabel={t('dashboard.month')}
            valueLabel={t('dashboard.invoiced')}
            emptyLabel={t('dashboard.revenueEmpty')}
          />
        </Card>

        <Card className="min-w-0 xl:col-span-2">
          <CardHeader title={t('dashboard.funnelTitle')} hint={t('dashboard.funnelHint')} />
          <HBars
            rows={stats.funnel.map((step) => ({
              key: step.key,
              label: t(`reports.funnel_${step.key}`),
              value: step.count,
              hint: step.percent === null || step.percent > 100 ? null : t('dashboard.ofPrevious', { percent: step.percent }),
            }))}
            colorFor={(row, index) => ORDINAL[index]}
            labelClass="w-36 sm:w-40"
          />
          <div className="mt-5 border-t border-separator-soft pt-4">
            <p className="t-section mb-3">{t('dashboard.sourcesTitle')}</p>
            <HBars
              rows={stats.bySource.map((s) => ({
                key: s.id,
                label: language === 'ar' ? s.label_ar : s.label_en,
                value: s.count,
              }))}
              labelClass="w-36 sm:w-40"
              emptyLabel={t('dashboard.sourcesEmpty')}
            />
          </div>
        </Card>
      </div>

      {/* ---------- 4. TODAY · THE NEXT 7 DAYS ---------- */}
      <div className="mb-4 grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader title={t('dashboard.today')} />
          {todaysBookings.length === 0 && todaysTasks.length === 0 && todaysReminders.length === 0 ? (
            <p className="t-body text-text-secondary">{t('dashboard.todayEmpty')}</p>
          ) : (
            <div className="divide-y divide-separator-soft">
              {todaysBookings.map((booking) => (
                <div key={booking.id} className="flex flex-wrap items-center justify-between gap-3 py-3">
                  <div>
                    <p className="t-row-label text-text">{booking.client_name}</p>
                    <p className="t-meta text-text-secondary">
                      {formatDateTime(booking.slot_start, language)}
                      {booking.project && (
                        <>
                          {' · '}
                          <Link to={`/projects/${booking.project.id}`} className="font-mono text-accent hover:underline" dir="ltr">
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
                      onChanged()
                    }}
                  >
                    {t('dashboard.markDone')}
                  </Button>
                </div>
              ))}
              {todaysTasks.map((task) => (
                <DashTask key={task.id} task={task} onChanged={onChanged} language={language} t={t} />
              ))}
              {todaysReminders.map((reminder) => (
                <ReminderRow key={reminder.id} reminder={reminder} pairs={pairs} language={language} t={t} onChanged={onChanged} />
              ))}
            </div>
          )}
        </Card>

        <Card>
          <CardHeader title={t('dashboard.upcoming')} />
          {upcoming.length === 0 ? (
            <p className="t-body text-text-secondary">{t('dashboard.upcomingEmpty')}</p>
          ) : (
            <ol className="divide-y divide-separator-soft">
              {upcoming.map((entry, index) => (
                <li key={index} className="flex flex-wrap items-center gap-3 py-2.5 t-body">
                  <time className="t-meta w-28 shrink-0 text-text-secondary">{formatDate(entry.date, language)}</time>
                  {entry.kind === 'booking' && (
                    <Link to="/booking-setup" className="text-accent hover:underline">
                      {t('dashboard.consultationWith', { name: entry.row.client_name })}
                    </Link>
                  )}
                  {entry.kind === 'task' && (
                    <Link to={entry.row.project ? `/projects/${entry.row.project.id}` : '/tasks'} className="text-text hover:text-accent">
                      {entry.row.title}
                    </Link>
                  )}
                  {entry.kind === 'reminder' && (
                    <Link to={`/contacts/${entry.row.contact_id}`} className="text-text hover:text-accent">
                      {t(`reminders.kind_${entry.row.kind}`)}
                      {entry.row.contact && ` · ${fullName(entry.row.contact)}`}
                    </Link>
                  )}
                </li>
              ))}
            </ol>
          )}
        </Card>
      </div>

      {/* ---------- 5. NEEDS ATTENTION — last, on purpose ---------- */}
      {attentionCount > 0 && (
        <Card className="mb-4 border-transparent bg-warning-bg">
          <h2 className="t-card-title mb-1 text-warning-text">{t('dashboard.needsAttention')}</h2>
          <p className="t-meta mb-3 text-warning-text">{t('dashboard.needsAttentionHint', { n: attentionCount })}</p>
          <div className="divide-y divide-separator-soft">
            {needsAttention.map((project) => (
              <Link key={project.id} to={`/projects/${project.id}`} className="flex items-center justify-between gap-3 py-3 hover:opacity-80">
                <span className="t-row-label text-text">
                  <span className="font-mono t-meta text-text-secondary" dir="ltr">{project.code}</span>{' '}
                  {project.name}
                </span>
                <Badge color={STATE_COLOR[project.state]}>{t(`project.state_${project.state}`)}</Badge>
              </Link>
            ))}
            {overdueTasks.slice(0, OVERDUE_ROWS).map((task) => (
              <DashTask key={task.id} task={task} onChanged={onChanged} language={language} t={t} overdue />
            ))}
            {overdueReminders.map((reminder) => (
              <ReminderRow key={reminder.id} reminder={reminder} pairs={pairs} language={language} t={t} onChanged={onChanged} overdue />
            ))}
          </div>
          {overdueTasks.length > OVERDUE_ROWS && (
            <Link to="/tasks" className="t-meta mt-3 inline-block text-accent hover:underline">
              {t('dashboard.moreOverdue', { n: overdueTasks.length - OVERDUE_ROWS })}
            </Link>
          )}
        </Card>
      )}

      {/* Occasion dates missing — said out loud, never skipped quietly. */}
      {occasionGaps.length > 0 && (
        <Card className="mb-4 border-transparent bg-warning-bg">
          {occasionGaps.map(({ year, kinds }) => (
            <div key={year} className="mb-2">
              <p className="t-body text-warning-text">
                {t('dashboard.occasionsMissing', { count: kinds.length, year })}
              </p>
              <p className="t-meta mt-1 text-text-secondary">
                {kinds.map((key) => t(`occasions.${key}`)).join(' · ')}
              </p>
            </div>
          ))}
          <Link to="/settings?tab=occasions" className="t-body mt-2 inline-block text-accent hover:underline">
            {t('dashboard.occasionsEnter')}
          </Link>
        </Card>
      )}
    </div>
  )
}

function CardHeader({ title, hint }) {
  return (
    <div className="mb-4">
      <h2 className="t-card-title text-text">{title}</h2>
      {hint && <p className="t-meta mt-0.5 text-text-secondary">{hint}</p>}
    </div>
  )
}

function DashTask({ task, onChanged, language, t, overdue }) {
  return (
    <div className="flex flex-wrap items-center gap-3 py-3">
      <button
        onClick={async () => {
          await setTaskDone(task.id, true)
          onChanged()
        }}
        className="h-[18px] w-[18px] shrink-0 rounded-[6px] border border-separator hover:border-accent"
        title={t('tasks.markDone')}
      />
      <div className="min-w-0 flex-1">
        <p className="t-row-label text-text">{task.title}</p>
        <p className="t-meta flex flex-wrap gap-x-2 text-text-secondary">
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
            <span className={overdue ? 'font-medium text-warning' : ''}>{formatDate(task.due_date, language)}</span>
          )}
        </p>
      </div>
    </div>
  )
}
