import { supabase } from './supabase'

/**
 * Tasks.
 *
 * Overdue is not stored — it is `not done and due before today`,
 * decided at read time. Nothing expires an item or rolls it out of
 * sight: an overdue task stays overdue, and stays visible, until
 * somebody actually closes it.
 */

const SELECT = '*, contact:contacts(id, first_name, last_name), project:projects(id, code, name)'

export async function listTasks({ includeDone = false } = {}) {
  let query = supabase.from('tasks').select(SELECT).order('due_date', { nullsFirst: false })
  if (!includeDone) query = query.eq('is_done', false)

  const { data, error } = await query
  if (error) throw error
  return data ?? []
}

export async function createTask(row) {
  const { data, error } = await supabase
    .from('tasks')
    .insert({ ...row, source: 'manual' })
    .select(SELECT)
    .single()

  if (error) throw error
  return data
}

export async function setTaskDone(id, done) {
  const { error } = await supabase
    .from('tasks')
    .update({ is_done: done, done_at: done ? new Date().toISOString() : null })
    .eq('id', id)

  if (error) throw error
}

export async function deleteTask(id) {
  const { error } = await supabase.from('tasks').delete().eq('id', id)
  if (error) throw error
}

/** Local midnight today, as a YYYY-MM-DD string. */
export function today() {
  const now = new Date()
  return [
    now.getFullYear(),
    String(now.getMonth() + 1).padStart(2, '0'),
    String(now.getDate()).padStart(2, '0'),
  ].join('-')
}

export function isOverdue(item) {
  return !item.is_done && item.due_date && item.due_date < today()
}

export function isToday(item) {
  return !item.is_done && item.due_date === today()
}

/** The three groups the Tasks screen shows, in that order. */
export function groupTasks(tasks) {
  const now = today()
  return {
    overdue: tasks.filter((t) => !t.is_done && t.due_date && t.due_date < now),
    today: tasks.filter((t) => !t.is_done && t.due_date === now),
    upcoming: tasks.filter((t) => !t.is_done && (!t.due_date || t.due_date > now)),
  }
}

/** Days from today, for "the next 7 days" style windows. */
export function withinDays(dateString, days) {
  if (!dateString) return false
  const start = new Date(today())
  const end = new Date(start)
  end.setDate(end.getDate() + days)
  const target = new Date(dateString)
  return target >= start && target <= end
}
