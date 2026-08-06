import { supabase } from './supabase'

/**
 * The five dashboard numbers.
 *
 * Every one of them carries the rows it was computed from, so the
 * dashboard can open the list behind any figure. A number you cannot
 * drill into is a number you stop trusting.
 */

function startOfMonth() {
  const now = new Date()
  return new Date(now.getFullYear(), now.getMonth(), 1).toISOString()
}

/**
 * The same five numbers over an arbitrary window.
 *
 * The dashboard asks for this month, because a figure you glance at
 * daily has to mean "now". Reports asks for whatever range you picked.
 * Both go through one implementation so the two screens can never
 * disagree about what a conversion is.
 */
export async function loadInsights({ from, to } = {}) {
  const monthStart = from ?? startOfMonth()
  const windowEnd = to ?? null

  const inWindow = (stamp) =>
    Boolean(stamp) && stamp >= monthStart && (!windowEnd || stamp <= windowEnd)

  const [contacts, projects, stages, invoices] = await Promise.all([
    supabase.from('contacts').select('id, first_name, last_name, created_at, is_client, converted_at'),
    supabase.from('projects').select('id, code, name, contact_id, value, state, is_archived, current_stage'),
    supabase.from('project_stages').select('project_id, stage_key, completed_at'),
    supabase.from('invoices').select('project_id, amount'),
  ])

  const allContacts = contacts.data ?? []
  const allProjects = projects.data ?? []
  const allStages = stages.data ?? []
  const allInvoices = invoices.data ?? []

  // ---------- 1. Leads in the window ----------
  const leadsThisMonth = allContacts.filter((c) => inWindow(c.created_at))

  // ---------- 2. Conversion to consultation ----------
  // Time-bounded on purpose: converted IN THE WINDOW over created IN
  // THE WINDOW. A lifetime ratio only ever drifts downward and stops
  // meaning anything.
  const convertedThisMonth = allContacts.filter((c) => inWindow(c.converted_at))
  const toConsultation = {
    percent: leadsThisMonth.length
      ? Math.round((convertedThisMonth.length / leadsThisMonth.length) * 100)
      : null,
    numerator: convertedThisMonth.length,
    denominator: leadsThisMonth.length,
    rows: convertedThisMonth,
  }

  // ---------- 3. Conversion to contract ----------
  // Projects that PASSED the stage-03 gate, not projects that reached
  // it. Reaching stage 03 means the contract went out; passing it
  // means it came back signed and paid. Only the second is a
  // conversion.
  const passedContract = new Set(
    allStages
      .filter((s) => s.stage_key === '03_contract' && s.completed_at)
      .map((s) => s.project_id)
  )
  const clients = allContacts.filter((c) => c.is_client)
  const contractProjects = allProjects.filter((p) => passedContract.has(p.id))
  const toContract = {
    percent: clients.length
      ? Math.round((contractProjects.length / clients.length) * 100)
      : null,
    numerator: contractProjects.length,
    denominator: clients.length,
    rows: contractProjects,
  }

  // ---------- 4. Active projects ----------
  // A paused project is not active work, so on_hold is out along with
  // closed, and anything already delivered.
  const activeProjects = allProjects.filter(
    (p) => !p.is_archived && p.state !== 'closed' && p.state !== 'on_hold'
  )

  // ---------- 5. Average project value ----------
  const value = averageProjectValue(allProjects, allInvoices)

  return {
    leadsThisMonth: { count: leadsThisMonth.length, rows: leadsThisMonth },
    toConsultation,
    toContract,
    activeProjects: { count: activeProjects.length, rows: activeProjects },
    value,
  }
}

/**
 * Resolved per project, never globally:
 *
 *   1. the figure the designer entered, if there is one
 *   2. otherwise the sum of that project's invoices
 *   3. otherwise the project is EXCLUDED from the average
 *
 * A project with no value is never counted as zero — that would drag
 * the average down and make the number a lie. The counts come back
 * alongside so the dashboard can say how much of the figure the
 * designer set themselves.
 */
export function averageProjectValue(projects, invoices) {
  const invoicedTotals = {}
  for (const invoice of invoices) {
    if (!invoice.project_id) continue
    invoicedTotals[invoice.project_id] =
      (invoicedTotals[invoice.project_id] ?? 0) + Number(invoice.amount ?? 0)
  }

  const counted = []
  let fromEntered = 0
  let fromInvoices = 0

  for (const project of projects) {
    if (project.value !== null && project.value !== undefined) {
      counted.push({ ...project, resolved: Number(project.value), basis: 'entered' })
      fromEntered += 1
    } else if (invoicedTotals[project.id] > 0) {
      counted.push({ ...project, resolved: invoicedTotals[project.id], basis: 'invoices' })
      fromInvoices += 1
    }
    // neither → left out entirely
  }

  const total = counted.reduce((sum, p) => sum + p.resolved, 0)

  return {
    average: counted.length ? Math.round(total / counted.length) : null,
    covering: counted.length,
    fromEntered,
    fromInvoices,
    rows: counted,
  }
}
