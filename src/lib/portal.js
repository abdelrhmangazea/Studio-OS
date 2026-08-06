import { supabase } from './supabase'

/** The portal, as the signed-in designer manages it. */

/* ---------------------------------------------------------------- */
/* The link                                                          */
/* ---------------------------------------------------------------- */

export async function getPortalLink(projectId) {
  const { data, error } = await supabase
    .from('portal_links')
    .select('token, created_at')
    .eq('project_id', projectId)
    .eq('is_active', true)
    .maybeSingle()

  if (error) throw error
  return data
}

/**
 * Issues a link, or replaces the one that exists.
 *
 * Regenerating revokes the old token in the same transaction, so a
 * project never has two working links.
 */
export async function issuePortalLink(projectId) {
  const { data, error } = await supabase.rpc('issue_portal_link', { p_project_id: projectId })
  if (error) throw error
  return data
}

export async function revokePortalLink(projectId) {
  const { error } = await supabase.rpc('revoke_portal_link', { p_project_id: projectId })
  if (error) throw error
}

export function portalUrl(token) {
  return `${window.location.origin}/portal/${token}`
}

/* ---------------------------------------------------------------- */
/* Files                                                             */
/* ---------------------------------------------------------------- */

export async function listFiles(projectId) {
  const { data, error } = await supabase
    .from('files')
    .select('*')
    .eq('project_id', projectId)
    .order('uploaded_at', { ascending: false })

  if (error) throw error
  return data ?? []
}

/**
 * Uploads a file against a stage.
 *
 * Nothing reaches the client here: is_published_to_portal defaults to
 * false, and publishing is a separate, deliberate act.
 *
 * The storage path is deliberately OPAQUE — a random uuid and the
 * filename, encoding neither the workspace nor the project. The portal
 * hands this path to the client so they can download, and a path that
 * spelled out internal ids would be handing those over too.
 *
 * The row is written BEFORE the object, because the storage policy
 * authorises by looking the path up in this table. If the upload then
 * fails, the row is removed rather than left pointing at nothing.
 */
export async function uploadFile({ projectId, stageKey, file }) {
  const safeName = file.name.replace(/[^\w.\-]+/g, '_')
  const path = `${crypto.randomUUID()}/${safeName}`

  const { data, error } = await supabase
    .from('files')
    .insert({
      project_id: projectId,
      stage_key: stageKey,
      file_url: path,
      filename: file.name,
    })
    .select('*')
    .single()

  if (error) throw error

  const { error: uploadError } = await supabase.storage
    .from('project-files')
    .upload(path, file, { contentType: file.type })

  if (uploadError) {
    await supabase.from('files').delete().eq('id', data.id)
    throw uploadError
  }

  return data
}

export async function setFilePublished(fileId, published) {
  const { error } = await supabase
    .from('files')
    .update({ is_published_to_portal: published })
    .eq('id', fileId)

  if (error) throw error
}

export async function deleteFile(file) {
  await supabase.storage.from('project-files').remove([file.file_url])
  const { error } = await supabase.from('files').delete().eq('id', file.id)
  if (error) throw error
}

/** The designer's own view of a file, through a short-lived signed URL. */
export async function fileUrl(path) {
  const { data, error } = await supabase.storage
    .from('project-files')
    .createSignedUrl(path, 300)

  if (error) return null
  return data.signedUrl
}

/* ---------------------------------------------------------------- */
/* Approvals and revisions                                           */
/* ---------------------------------------------------------------- */

export async function listApprovals(projectId) {
  const { data, error } = await supabase
    .from('approvals')
    .select('*')
    .eq('project_id', projectId)
    .order('decided_at', { ascending: false })

  if (error) throw error
  return data ?? []
}

export async function getRevisions(projectId) {
  const { data, error } = await supabase
    .from('revisions')
    .select('*')
    .eq('project_id', projectId)
    .maybeSingle()

  if (error) throw error
  return data
}

export async function setRevisionAllowance(projectId, allowance) {
  const { error } = await supabase
    .from('revisions')
    .update({ free_allowance: allowance })
    .eq('project_id', projectId)

  if (error) throw error
}

/** Change requests still waiting on the designer — the counter on the project. */
export function openChangeRequests(approvals) {
  const requests = approvals.filter((row) => row.decision === 'changes_requested')

  // A change request counts as answered once an approval lands after it
  // for the same thing, stage or file alike.
  return requests.filter(
    (request) =>
      !approvals.some(
        (other) =>
          other.decision === 'approved' &&
          other.stage_key === request.stage_key &&
          (other.item_ref ?? null) === (request.item_ref ?? null) &&
          new Date(other.decided_at) > new Date(request.decided_at)
      )
  )
}
