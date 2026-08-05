import { createClient } from '@supabase/supabase-js'

/**
 * The client portal's only route into the database.
 *
 * Three SECURITY DEFINER functions, each of which resolves the token
 * to exactly one project before it reads anything. There is no `anon`
 * policy on portal_links, files, approvals, revisions, projects or
 * project_stages, so this client cannot reach another project — or
 * another studio — even if it tried.
 *
 * A separate instance with no session, so a signed-in designer opening
 * their own client's portal sees precisely what the client sees.
 *
 * The token travels in the request body, never in a query string.
 */
const publicClient = createClient(
  import.meta.env.VITE_SUPABASE_URL,
  import.meta.env.VITE_SUPABASE_ANON_KEY,
  { auth: { persistSession: false, autoRefreshToken: false } }
)

/** Returns null for an unknown, revoked, or deactivated link. */
export async function fetchPortal(token) {
  const { data, error } = await publicClient.rpc('portal_project', { p_token: token })
  if (error) throw error
  return data
}

/**
 * Approve, or ask for changes.
 *
 * fileId null approves the current stage — that is the decision that
 * opens the gate. Passing a fileId records a decision about that one
 * file, which never opens a gate.
 */
export async function submitDecision(token, { decision, comment, fileId }) {
  const { data, error } = await publicClient.rpc('portal_submit_decision', {
    p_token: token,
    p_decision: decision,
    p_comment: comment || null,
    p_file_id: fileId || null,
  })
  if (error) throw error
  return data
}

/** The Bucket 5 receipt flow, reused as-is. */
export async function uploadPortalReceipt(token, uploadPrefix, file) {
  const extension = file.name.split('.').pop().toLowerCase()
  const path = `${uploadPrefix}/receipt-${Date.now()}.${extension}`

  const { error: uploadError } = await publicClient.storage
    .from('receipts')
    .upload(path, file, { contentType: file.type })

  if (uploadError) throw uploadError

  const { error } = await publicClient.rpc('portal_attach_receipt', {
    p_token: token,
    p_path: path,
  })
  if (error) throw error

  return path
}

/**
 * Downloads a published file.
 *
 * The bucket is private, so this is NOT a plain link — the request
 * carries the anon key and is judged by the read policy, which admits
 * a file only while it is published AND its project still has a live
 * link. Revoking therefore stops downloads at the same moment it
 * closes the portal.
 */
export async function downloadPortalFile(path, filename) {
  const { data, error } = await publicClient.storage.from('project-files').download(path)
  if (error) throw error

  const url = URL.createObjectURL(data)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  document.body.appendChild(link)
  link.click()
  link.remove()
  URL.revokeObjectURL(url)
}
