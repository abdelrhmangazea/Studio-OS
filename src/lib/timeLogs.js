import { supabase } from './supabase'

/**
 * Time logs.
 *
 * Manual entry only — no timer, nothing running in the background.
 * Minutes are stored, hours are shown: a designer thinks in "an hour
 * and a half", and storing 90 avoids ever rounding it away.
 */

export async function listTimeLogs(projectId) {
  const { data, error } = await supabase
    .from('time_logs')
    .select('*')
    .eq('project_id', projectId)
    .order('logged_at', { ascending: false })

  if (error) throw error
  return data ?? []
}

export async function addTimeLog(row) {
  const { data, error } = await supabase.from('time_logs').insert(row).select('*').single()
  if (error) throw error
  return data
}

export async function deleteTimeLog(id) {
  const { error } = await supabase.from('time_logs').delete().eq('id', id)
  if (error) throw error
}

/** Every project's logged minutes, for the profitability report. */
export async function minutesByProject() {
  const { data, error } = await supabase.from('time_logs').select('project_id, minutes')
  if (error) throw error

  const totals = {}
  for (const row of data ?? []) {
    totals[row.project_id] = (totals[row.project_id] ?? 0) + row.minutes
  }
  return totals
}

export function hoursFrom(minutes) {
  return Math.round(((minutes ?? 0) / 60) * 10) / 10
}

export function totalByStage(logs) {
  const totals = {}
  for (const log of logs) {
    const key = log.stage_key ?? '—'
    totals[key] = (totals[key] ?? 0) + log.minutes
  }
  return totals
}
