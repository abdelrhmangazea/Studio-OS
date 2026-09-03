/**
 * Turning the database's structured refusals into something a
 * designer can act on.
 *
 * The triggers raise in a fixed shape:
 *
 *     LIMIT_REACHED:contacts:15:free
 *     FEATURE_LOCKED:client_portal_enabled:free
 *     TEMPLATE_LOCKED:design_contract:free
 *     READ_ONLY:this role cannot change anything
 *
 * That string is a contract, not a message. It is parsed here and
 * never shown to anybody — a person who hits a limit should be told
 * what the limit is and which plan lifts it, in their own language,
 * not handed a colon-separated token.
 */

import { recordFeatureUse } from './feedback'

/**
 * A refusal is a signal worth counting. The page-open counters cannot
 * tell "used the generator" from "opened it and was refused" — three
 * Free studios opened it twenty-one times during the beta and every
 * one of those was a refusal. This records the refusal itself, under
 * its own key, so the two are never confused again.
 */
function noted(refusal) {
  recordFeatureUse(`locked_${refusal.what}`)
  return refusal
}

/** The plan a workspace should move to for each restriction. */
const LIFTED_BY = {
  contacts: 'pro',
  projects: 'pro',
  seats: 'studio',
  client_portal_enabled: 'pro',
  document_generator_enabled: 'pro',
  fee_calculator_enabled: 'pro',
  reports_enabled: 'pro',
}

/**
 * @returns null when this is an ordinary error, or
 *   { kind, what, limit, planKey, liftedBy } when it is a plan refusal.
 */
export function parsePlanRefusal(failure) {
  const raw = String(
    failure?.message ?? failure?.msg ?? failure?.details ?? failure ?? ''
  )

  let match = raw.match(/LIMIT_REACHED:(\w+):(\d+):(\w+)/)
  if (match) {
    return noted({
      kind: 'limit',
      what: match[1],
      limit: Number(match[2]),
      planKey: match[3],
      liftedBy: LIFTED_BY[match[1]] ?? 'pro',
    })
  }

  match = raw.match(/FEATURE_LOCKED:(\w+):(\w+)/)
  if (match) {
    return noted({
      kind: 'feature',
      what: match[1],
      limit: null,
      planKey: match[2],
      liftedBy: LIFTED_BY[match[1]] ?? 'pro',
    })
  }

  match = raw.match(/TEMPLATE_LOCKED:([\w]+):(\w+)/)
  if (match) {
    return noted({
      kind: 'template',
      what: match[1],
      limit: null,
      planKey: match[2],
      liftedBy: 'pro',
    })
  }

  if (/READ_ONLY:/.test(raw)) {
    return { kind: 'readonly', what: null, limit: null, planKey: null, liftedBy: null }
  }

  return null
}

/**
 * The sentence itself.
 *
 * Two facts, always: what the limit is, and what lifts it. A message
 * that only says "you have reached your limit" leaves someone with
 * nowhere to go, which is the same as a dead end with extra words.
 */
export function planRefusalMessage(refusal, t) {
  if (!refusal) return ''

  if (refusal.kind === 'readonly') return t('plan.readOnly')

  const planName = t(`plan.name_${refusal.liftedBy}`)

  if (refusal.kind === 'limit') {
    return t(`plan.limit_${refusal.what}`, {
      limit: refusal.limit,
      current: t(`plan.name_${refusal.planKey}`),
      plan: planName,
    })
  }

  if (refusal.kind === 'template') {
    return t('plan.templateLocked', { plan: planName })
  }

  return t(`plan.feature_${refusal.what}`, { plan: planName })
}
