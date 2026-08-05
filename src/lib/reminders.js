import { supabase } from './supabase'

/**
 * Reminders.
 *
 * They belong to the CONTACT. A project is only ever a breadcrumb back
 * to the work that began the relationship, which is why delivering a
 * project — and archiving it — never takes its reminders off the
 * dashboard. Delivery ends the design work, not the relationship.
 */

const SELECT = '*, contact:contacts(id, first_name, last_name, birthday)'

/** The four occasions whose dates the designer types in every year. */
export const HIJRI_OCCASIONS = ['hijri_new_year', 'ramadan', 'eid_fitr', 'eid_adha']

export async function listReminders({ includeDone = false } = {}) {
  let query = supabase.from('reminders').select(SELECT).order('due_date', { nullsFirst: false })
  if (!includeDone) query = query.eq('is_done', false)

  const { data, error } = await query
  if (error) throw error
  return data ?? []
}

export async function setReminderDone(id, done) {
  const { error } = await supabase
    .from('reminders')
    .update({ is_done: done, done_at: done ? new Date().toISOString() : null })
    .eq('id', id)

  if (error) throw error
}

/* ---------------------------------------------------------------- */
/* Occasion dates — typed in, never computed                        */
/* ---------------------------------------------------------------- */

export async function listOccasionDates(year) {
  const { data, error } = await supabase
    .from('occasion_dates')
    .select('*')
    .eq('year', year)

  if (error) throw error
  return data ?? []
}

export async function saveOccasionDate(year, occasionKey, date) {
  const { error } = await supabase
    .from('occasion_dates')
    .upsert({ year, occasion_key: occasionKey, date }, { onConflict: 'workspace_id,year,occasion_key' })

  if (error) throw error
}

/** Fills in the reminders that were waiting for these dates. */
export async function syncOccasionReminders(year) {
  const { error } = await supabase.rpc('sync_occasion_reminders', { p_year: year })
  if (error) throw error
}

/**
 * Whether this year's Hijri dates are all in.
 *
 * The dashboard says so out loud when they are not, rather than
 * skipping the reminders in silence.
 */
export function missingOccasionDates(dates) {
  const entered = new Set(dates.map((d) => d.occasion_key))
  return HIJRI_OCCASIONS.filter((key) => !entered.has(key))
}

/**
 * The reminder's own message template, paired by key.
 *
 * A reminder with no template still shows — it just has nothing to
 * copy, which is the case for anything created as 'custom'.
 */
export function templateFor(reminder, pairs, language) {
  if (!reminder.template_key) return null
  const pair = pairs.find((p) => p.key === reminder.template_key)
  return pair?.[language] ?? pair?.ar ?? pair?.en ?? null
}
