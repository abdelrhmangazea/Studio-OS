import { supabase } from './supabase'
import { listProjects, listStageDefinitions, projectProgress } from './projects'
import { listContacts } from './contacts'
import { listTasks } from './tasks'
import { listReminders, datelessOccasions } from './reminders'
import { listBookings } from './booking'
import { listTemplates, pairByKey } from './templates'

/**
 * Everything the dashboard shows, and the arithmetic behind it.
 *
 * Loading and computing are split on purpose: `computeDashboard` is a
 * pure function of rows, so the same numbers can be produced from a
 * fixture (the dev preview) or from the database, and a figure on
 * screen can always be traced back to the rows it came from.
 */

export const isActiveProject = (p) => !p.is_archived && p.state !== 'closed'

async function rows(query) {
  const { data, error } = await query
  if (error) throw error
  return data ?? []
}

export async function loadDashboardData() {
  const [
    projects, definitions, contacts, tasks, reminders, bookings, templates,
    invoices, contractStages, sources,
  ] = await Promise.all([
    listProjects(),
    listStageDefinitions(),
    listContacts(),
    listTasks(),
    listReminders(),
    listBookings(),
    listTemplates(),
    rows(supabase.from('invoices').select('id, project_id, contact_id, amount, status, issued_at, created_at')),
    // The contract gate, passed — the only stage row the funnel needs.
    rows(
      supabase
        .from('project_stages')
        .select('project_id, stage_key, completed_at')
        .eq('stage_key', '03_contract')
        .not('completed_at', 'is', null)
    ),
    rows(supabase.from('lead_sources').select('id, label_en, label_ar')),
  ])

  // Progress needs each active project's stages, then the checklist of
  // whichever stage is open — two queries, not two per project.
  const activeIds = projects.filter(isActiveProject).map((p) => p.id)
  let stages = []
  let items = []
  if (activeIds.length > 0) {
    stages = await rows(
      supabase
        .from('project_stages')
        .select('project_id, stage_key, sort_order, status')
        .in('project_id', activeIds)
    )
    const openKeys = [...new Set(stages.filter((s) => s.status === 'active').map((s) => s.stage_key))]
    if (openKeys.length > 0) {
      items = await rows(
        supabase
          .from('checklist_items')
          .select('project_id, stage_key, is_done')
          .in('project_id', activeIds)
          .in('stage_key', openKeys)
      )
    }
  }

  return {
    projects, definitions, contacts, tasks, reminders, bookings,
    pairs: pairByKey(templates),
    invoices, contractStages, sources, stages, items,
    occasionGaps: datelessOccasions(reminders),
  }
}

/** The last `count` calendar months, oldest first, as {key, date}. */
export function monthKeys(count, now = new Date()) {
  const out = []
  for (let i = count - 1; i >= 0; i -= 1) {
    const date = new Date(now.getFullYear(), now.getMonth() - i, 1)
    out.push({
      key: `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`,
      date,
    })
  }
  return out
}

const monthOf = (stamp) => String(stamp ?? '').slice(0, 7)

/** Signed percentage change, or null when there is nothing to compare to. */
export function percentDelta(current, previous) {
  if (!previous) return null
  return Math.round(((current - previous) / previous) * 100)
}

export const STATE_KEYS = ['on_track', 'waiting_client', 'needs_attention', 'on_hold']

export function computeDashboard(data, now = new Date()) {
  const {
    projects = [], definitions = [], contacts = [], invoices = [],
    stages = [], items = [], contractStages = [], bookings = [], sources = [],
  } = data

  const months = monthKeys(12, now)
  const thisKey = months[11].key
  const lastKey = months[10].key
  const yearStart = `${now.getFullYear()}-01-01`
  const inYear = (stamp) => Boolean(stamp) && String(stamp) >= yearStart

  // ---------- money, by month ----------
  // A draft is a number nobody has been asked to pay yet.
  const billed = invoices.filter((i) => i.status !== 'draft')
  const issued = (i) => i.issued_at ?? i.created_at
  const perMonth = (list, when, weight) =>
    months.map((m) => ({
      ...m,
      value: list
        .filter((row) => monthOf(when(row)) === m.key)
        .reduce((sum, row) => sum + weight(row), 0),
    }))

  const invoicedByMonth = perMonth(billed, issued, (i) => Number(i.amount ?? 0))
  const leadsByMonth = perMonth(contacts, (c) => c.created_at, () => 1)
  const at = (series, key) => series.find((m) => m.key === key)?.value ?? 0

  const invoiced = {
    thisMonth: at(invoicedByMonth, thisKey),
    lastMonth: at(invoicedByMonth, lastKey),
    twelveMonths: invoicedByMonth.reduce((s, m) => s + m.value, 0),
    collectedThisMonth: billed
      .filter((i) => i.status === 'paid' && monthOf(issued(i)) === thisKey)
      .reduce((s, i) => s + Number(i.amount ?? 0), 0),
  }
  invoiced.delta = percentDelta(invoiced.thisMonth, invoiced.lastMonth)

  const leads = {
    thisMonth: at(leadsByMonth, thisKey),
    lastMonth: at(leadsByMonth, lastKey),
  }
  leads.delta = percentDelta(leads.thisMonth, leads.lastMonth)

  // ---------- the portfolio ----------
  const invoicedByProject = {}
  for (const i of invoices) {
    if (!i.project_id) continue
    invoicedByProject[i.project_id] = (invoicedByProject[i.project_id] ?? 0) + Number(i.amount ?? 0)
  }
  // The designer's own figure first, invoices second, nothing third —
  // a project with no value is never counted as zero.
  const resolvedValue = (p) => {
    if (p.value !== null && p.value !== undefined) return Number(p.value)
    return invoicedByProject[p.id] > 0 ? invoicedByProject[p.id] : null
  }

  const active = projects.filter(isActiveProject)
  const portfolio = active
    .map((project) => {
      const contact = contacts.find((c) => c.id === project.contact_id) ?? project.contact ?? null
      const own = stages.filter((s) => s.project_id === project.id)
      const ownItems = items.filter((i) => i.project_id === project.id)
      return {
        project,
        contact,
        progress: projectProgress(own, ownItems),
        value: resolvedValue(project),
        daysSince: contact?.last_contact_at
          ? Math.floor((now - new Date(contact.last_contact_at)) / 86400000)
          : null,
      }
    })
    .sort((a, b) => b.progress - a.progress)

  const valued = portfolio.filter((r) => r.value !== null)
  const avgProgress = portfolio.length
    ? Math.round(portfolio.reduce((s, r) => s + r.progress, 0) / portfolio.length)
    : null

  const byStage = definitions.map((d) => ({
    key: d.stage_key,
    title_en: d.title_en,
    title_ar: d.title_ar,
    count: active.filter((p) => p.current_stage === d.stage_key).length,
  }))

  const byState = STATE_KEYS.map((key) => ({
    key,
    count: active.filter((p) => p.state === key).length,
  }))

  // ---------- the year's pipeline ----------
  const leadsYear = contacts.filter((c) => inYear(c.created_at))
  const bookedIds = new Set(
    bookings.filter((b) => b.status !== 'cancelled' && inYear(b.created_at)).map((b) => b.contact_id)
  )
  const consultationsYear = contacts.filter((c) => bookedIds.has(c.id))
  const signedIds = new Set(contractStages.filter((s) => inYear(s.completed_at)).map((s) => s.project_id))
  const contractsYear = projects.filter((p) => signedIds.has(p.id))
  const deliveredYear = projects.filter((p) => inYear(p.delivered_at))

  const funnel = [
    { key: 'leads', count: leadsYear.length },
    { key: 'consultations', count: consultationsYear.length },
    { key: 'contracts', count: contractsYear.length },
    { key: 'delivered', count: deliveredYear.length },
  ].map((step, index, all) => ({
    ...step,
    // From the PREVIOUS step — the drop between two steps is the
    // thing a studio can act on.
    percent:
      index === 0 || all[index - 1].count === 0
        ? null
        : Math.round((step.count / all[index - 1].count) * 100),
  }))

  const conversion = {
    percent: leadsYear.length ? Math.round((contractsYear.length / leadsYear.length) * 100) : null,
    numerator: contractsYear.length,
    denominator: leadsYear.length,
  }

  const bySource = sources
    .map((s) => ({ ...s, count: leadsYear.filter((c) => c.source_id === s.id).length }))
    .filter((s) => s.count > 0)
    .sort((a, b) => b.count - a.count)
    .slice(0, 5)

  return {
    months,
    invoicedByMonth,
    leadsByMonth,
    invoiced,
    leads,
    portfolio,
    avgProgress,
    portfolioValue: valued.reduce((s, r) => s + r.value, 0),
    valuedCount: valued.length,
    activeCount: active.length,
    onTrackCount: active.filter((p) => p.state === 'on_track').length,
    byStage,
    byState,
    funnel,
    conversion,
    bySource,
  }
}
