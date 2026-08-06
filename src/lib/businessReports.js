import { supabase } from './supabase'
import { minutesByProject, hoursFrom } from './timeLogs'

/**
 * The four business reports.
 *
 * Every figure carries the rows behind it, so each one drills in and
 * each one exports. A number with no list under it is a number nobody
 * can check.
 */

export async function loadBusinessReports({ from, to }) {
  const inWindow = (stamp) =>
    Boolean(stamp) && (!from || stamp >= from) && (!to || stamp <= to)

  const [contacts, projects, stages, invoices, bookings, sources, minutes] = await Promise.all([
    supabase.from('contacts').select('id, first_name, last_name, created_at, converted_at, is_client, source_id'),
    supabase.from('projects').select('id, code, name, contact_id, project_type, value, delivered_at, created_at, is_archived, state'),
    supabase.from('project_stages').select('project_id, stage_key, completed_at'),
    supabase.from('invoices').select('project_id, contact_id, amount, issued_at, created_at, status'),
    supabase.from('bookings').select('id, contact_id, created_at, status'),
    supabase.from('lead_sources').select('id, label_ar, label_en'),
    minutesByProject(),
  ])

  const allContacts = contacts.data ?? []
  const allProjects = projects.data ?? []
  const allStages = stages.data ?? []
  const allInvoices = invoices.data ?? []
  const allBookings = bookings.data ?? []
  const allSources = sources.data ?? []

  const invoicedByProject = {}
  const invoicedByContact = {}
  for (const invoice of allInvoices) {
    const when = invoice.issued_at ?? invoice.created_at
    if (!inWindow(when)) continue
    const amount = Number(invoice.amount ?? 0)
    if (invoice.project_id) invoicedByProject[invoice.project_id] = (invoicedByProject[invoice.project_id] ?? 0) + amount
    if (invoice.contact_id) invoicedByContact[invoice.contact_id] = (invoicedByContact[invoice.contact_id] ?? 0) + amount
  }

  // Projects past the stage-03 gate — signed and paid, not merely sent.
  const signed = new Set(
    allStages.filter((s) => s.stage_key === '03_contract' && s.completed_at).map((s) => s.project_id)
  )

  // ---------- 1. FUNNEL ----------
  const leads = allContacts.filter((c) => inWindow(c.created_at))
  const bookedContacts = new Set(
    allBookings.filter((b) => inWindow(b.created_at) && b.status !== 'cancelled').map((b) => b.contact_id)
  )
  const consultations = allContacts.filter((c) => bookedContacts.has(c.id))
  const contracted = allProjects.filter((p) => signed.has(p.id))
  const delivered = allProjects.filter((p) => p.delivered_at && inWindow(p.delivered_at))

  const funnel = [
    { key: 'leads', rows: leads },
    { key: 'consultations', rows: consultations },
    { key: 'contracts', rows: contracted },
    { key: 'delivered', rows: delivered },
  ].map((step, index, all) => ({
    ...step,
    count: step.rows.length,
    // Conversion from the PREVIOUS step, not from the top — the drop
    // between two stages is the thing you can act on.
    percent:
      index === 0 || all[index - 1].rows.length === 0
        ? null
        : Math.round((step.rows.length / all[index - 1].rows.length) * 100),
  }))

  // ---------- 2. REVENUE ----------
  const byMonth = {}
  for (const invoice of allInvoices) {
    const when = invoice.issued_at ?? invoice.created_at
    if (!inWindow(when)) continue
    const month = String(when).slice(0, 7)
    byMonth[month] = (byMonth[month] ?? 0) + Number(invoice.amount ?? 0)
  }

  const byType = {}
  for (const project of allProjects) {
    const total = invoicedByProject[project.id] ?? 0
    if (!total) continue
    const type = project.project_type || '—'
    byType[type] ??= { type, total: 0, count: 0 }
    byType[type].total += total
    byType[type].count += 1
  }

  const valued = allProjects
    .map((p) => (p.value != null ? Number(p.value) : invoicedByProject[p.id] ?? null))
    .filter((v) => v !== null && v > 0)

  const revenue = {
    months: Object.entries(byMonth).sort().map(([month, total]) => ({ month, total })),
    byType: Object.values(byType).sort((a, b) => b.total - a.total),
    averageValue: valued.length ? Math.round(valued.reduce((s, v) => s + v, 0) / valued.length) : null,
    valuedCount: valued.length,
    total: Object.values(byMonth).reduce((s, v) => s + v, 0),
  }

  // ---------- 3. PROFITABILITY ----------
  // A project with no logged time has no effective rate — it is left
  // out rather than shown as infinite.
  const profitability = allProjects
    .map((project) => {
      const value = project.value != null ? Number(project.value) : invoicedByProject[project.id] ?? 0
      const hours = hoursFrom(minutes[project.id] ?? 0)
      return { ...project, value, hours, rate: hours > 0 ? Math.round(value / hours) : null }
    })
    .filter((p) => p.hours > 0 && p.value > 0)
    .sort((a, b) => b.rate - a.rate)

  const withoutTime = allProjects.filter((p) => !(minutes[p.id] > 0)).length

  // ---------- 4. SOURCE PERFORMANCE ----------
  const sourceRows = allSources.map((source) => {
    const own = allContacts.filter((c) => c.source_id === source.id && inWindow(c.created_at))
    const ownIds = new Set(own.map((c) => c.id))
    const ownProjects = allProjects.filter((p) => ownIds.has(p.contact_id))

    return {
      ...source,
      leads: own.length,
      consultations: own.filter((c) => bookedContacts.has(c.id)).length,
      contracts: ownProjects.filter((p) => signed.has(p.id)).length,
      invoiced: own.reduce((sum, c) => sum + (invoicedByContact[c.id] ?? 0), 0),
      rows: own,
    }
  }).sort((a, b) => b.invoiced - a.invoiced)

  return { funnel, revenue, profitability, withoutTime, sources: sourceRows }
}
