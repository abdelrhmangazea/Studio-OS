import { supabase } from './supabase'

/**
 * The three things a studio can do to its own data: bin it, take a
 * copy of it, or close the account entirely.
 *
 * Grouped in one file because they are the same conversation — "what
 * happens to my work if I change my mind" — and a designer reading
 * this repo should find the answers together.
 */

/* ---------------------------- the bin ---------------------------- */

export const softDeleteContact = (id) => rpc('soft_delete_contact', { p_id: id })
export const restoreContact = (id) => rpc('restore_contact', { p_id: id })
export const softDeleteProject = (id) => rpc('soft_delete_project', { p_id: id })
export const restoreProject = (id) => rpc('restore_project', { p_id: id })

export async function listDeleted() {
  const { data, error } = await supabase.rpc('deleted_items')
  if (error) throw error
  return data ?? { contacts: [], projects: [] }
}

async function rpc(name, args) {
  const { data, error } = await supabase.rpc(name, args)
  if (error) throw error
  return data
}

/** Days left before something in the bin is destroyed for good. */
export function daysLeft(purgesAt) {
  if (!purgesAt) return null
  const ms = new Date(purgesAt).getTime() - Date.now()
  return Math.max(0, Math.ceil(ms / 86400000))
}

/* --------------------------- the export --------------------------- */

/**
 * Every table this workspace owns, in one file.
 *
 * RLS does the scoping — each select returns only this workspace's
 * rows, so the export cannot contain anyone else's data even by
 * mistake. Nothing here is a privileged query.
 *
 * Uploaded FILES are not included. They live in Storage, and the
 * database holds only their paths. Saying so in the file itself
 * beats letting someone discover it when they need the archive.
 */
const EXPORTED_TABLES = [
  'contacts',
  'notes',
  'projects',
  'project_stages',
  'checklist_items',
  'files',
  'approvals',
  'revisions',
  'generated_documents',
  'templates',
  'bookings',
  'session_types',
  'booking_questions',
  'booking_settings',
  'blocked_dates',
  'invoices',
  'receipts',
  'quotations',
  'suppliers',
  'project_suppliers',
  'time_logs',
  'fee_calculations',
  'tasks',
  'reminders',
  'occasion_dates',
  'lead_statuses',
  'lead_sources',
  'studio_settings',
  'workspaces',
  'profiles',
  'feedback',
]

export async function buildExport() {
  const tables = {}
  const failed = []

  for (const table of EXPORTED_TABLES) {
    const { data, error } = await supabase.from(table).select('*')
    if (error) failed.push({ table, reason: error.message })
    else tables[table] = data ?? []
  }

  return {
    exported_at: new Date().toISOString(),
    generated_by: 'Studio OS',
    note:
      'Every row this studio owns. Uploaded files are NOT included — ' +
      'the database stores only their paths, and the files themselves ' +
      'live in Supabase Storage. Download those separately if you need them.',
    row_counts: Object.fromEntries(
      Object.entries(tables).map(([name, rows]) => [name, rows.length])
    ),
    // Reported rather than swallowed. An export that quietly skipped a
    // table is worse than one that says which.
    tables_that_failed: failed,
    tables,
  }
}

/** Hands the archive to the browser as a download. */
export function downloadExport(archive, studioName) {
  const stamp = new Date().toISOString().slice(0, 10)
  const safe = (studioName || 'studio').replace(/[^\w؀-ۿ-]+/g, '-')

  const blob = new Blob([JSON.stringify(archive, null, 2)], {
    type: 'application/json',
  })
  const url = URL.createObjectURL(blob)

  const link = document.createElement('a')
  link.href = url
  link.download = `${safe}-studio-os-${stamp}.json`
  document.body.appendChild(link)
  link.click()
  link.remove()

  URL.revokeObjectURL(url)
}

/* ------------------------ closing the account ------------------------ */

/**
 * Irreversible. The confirmation is the studio's own name, typed —
 * the database checks it, not this function, so it cannot be skipped
 * by calling the RPC directly.
 */
export async function deleteMyAccount(confirmation) {
  const { data, error } = await supabase.rpc('delete_my_account', {
    p_confirmation: confirmation,
  })
  if (error) throw error
  return data
}
