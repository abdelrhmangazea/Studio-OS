import { supabase } from '../supabase'

/**
 * What every method shares, applied AFTER it returns its base figure.
 *
 * Complexity, margin, VAT and the range live here rather than inside
 * the six methods, so a seventh method needs to know nothing about
 * them and removing one of the six takes none of them with it.
 *
 * Order matters and is fixed: base → complexity → margin → VAT.
 * Margin on top of complexity, VAT on top of everything, because VAT
 * is charged on what you actually invoice.
 */
export function applyCommon(calculated, { complexity, config, settings }) {
  const steps = [...calculated.steps]
  let running = calculated.base

  const multiplier = Number(config?.complexity?.[complexity]) || 1
  if (multiplier !== 1) {
    const after = running * multiplier
    steps.push({
      label: `pricing.complexity_${complexity}`,
      detail: `× ${multiplier}`,
      amount: after - running,
    })
    running = after
  }

  const margin = Number(config?.margin) || 0
  if (margin) {
    const after = running * (1 + margin / 100)
    steps.push({ label: 'pricing.margin', detail: `+${margin}%`, amount: after - running })
    running = after
  }

  const net = running

  // VAT reads the same two settings the contract does. "inclusive"
  // means the price already contains it, so nothing is added — it is
  // shown so the designer can see what is inside the number.
  const vatRate = Number(settings?.vat_rate) || 0
  const inclusive = settings?.vat_treatment === 'inclusive'
  let gross = net
  let vat = 0

  if (vatRate) {
    if (inclusive) {
      vat = net - net / (1 + vatRate / 100)
      steps.push({ label: 'pricing.vatInclusive', detail: `${vatRate}%`, amount: vat })
    } else {
      vat = net * (vatRate / 100)
      gross = net + vat
      steps.push({ label: 'pricing.vatAdded', detail: `+${vatRate}%`, amount: vat })
    }
  }

  const low = Number(config?.range?.low) || 0.85
  const high = Number(config?.range?.high) || 1.2

  return {
    steps,
    net: round(net),
    vat: round(vat),
    recommended: round(gross),
    low: round(gross * low),
    high: round(gross * high),
    currency: settings?.currency ?? '',
  }
}

function round(n) {
  return Math.round((Number(n) || 0) * 100) / 100
}

/**
 * Splits a total across the five proposal phases.
 *
 * A method that enters its phases directly keeps them — the split is
 * for methods that produce one number and have to divide it.
 */
export function splitIntoPhases(total, config, values, method) {
  if (method?.entersPhasesDirectly) {
    return [1, 2, 3, 4, 5].map((n) => Number(values[`phase_${n}`]) || 0)
  }

  const split = config?.phase_split ?? { 1: 25, 2: 30, 3: 20, 4: 10, 5: 15 }
  return [1, 2, 3, 4, 5].map((n) => round(total * ((Number(split[n]) || 0) / 100)))
}

/**
 * What comparable projects were actually invoiced.
 *
 * Comparable means the same project type and within ±25% of the area.
 * Below three matches it reports the count and NO average — one past
 * project is an anecdote, and an average of it is a lie with a decimal
 * point.
 */
export async function comparableProjects({ projectId, area, projectType }) {
  const { data: projects } = await supabase
    .from('projects')
    .select('id, code, name, area_sqm, project_type, value')

  const { data: invoices } = await supabase.from('invoices').select('project_id, amount')

  const invoiced = {}
  for (const invoice of invoices ?? []) {
    if (!invoice.project_id) continue
    invoiced[invoice.project_id] = (invoiced[invoice.project_id] ?? 0) + Number(invoice.amount ?? 0)
  }

  const numericArea = Number(area) || 0

  const matches = (projects ?? [])
    .filter((p) => p.id !== projectId)
    .filter((p) => !projectType || p.project_type === projectType)
    .filter((p) => {
      if (!numericArea || !p.area_sqm) return false
      const ratio = Number(p.area_sqm) / numericArea
      return ratio >= 0.75 && ratio <= 1.25
    })
    .map((p) => ({ ...p, resolved: p.value != null ? Number(p.value) : invoiced[p.id] ?? null }))
    .filter((p) => p.resolved !== null && p.resolved > 0)

  if (matches.length < 3) {
    return { enough: false, count: matches.length, rows: matches, average: null }
  }

  const average = matches.reduce((sum, p) => sum + p.resolved, 0) / matches.length
  return { enough: true, count: matches.length, rows: matches, average: round(average) }
}
