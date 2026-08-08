import { supabase } from './supabase'

/**
 * The workspace's plan, and everything the subscription screen needs.
 *
 * Nothing here decides anything. Every limit and every feature gate
 * lives in the database — these calls exist so the UI can show the
 * same truth, not so it can enforce a second, weaker copy of it.
 */

export async function mySubscription() {
  const { data, error } = await supabase.rpc('my_subscription')
  if (error) throw error
  return data
}

export async function listPlans() {
  const { data, error } = await supabase
    .from('plans')
    .select('*')
    .eq('active', true)
    .order('sort_order')

  if (error) throw error
  return data ?? []
}

/** Two months free, computed rather than stored, so they cannot drift. */
export const yearlyPrice = (plan) => Number(plan?.price_monthly ?? 0) * 10

export async function redeemCode(code) {
  const { data, error } = await supabase.rpc('redeem_access_code', { p_code: code })
  if (error) throw error
  return data
}

export async function myTemplateAccess() {
  const { data, error } = await supabase.rpc('my_template_access')
  if (error) throw error
  return data
}

/** A template is locked when the plan names a subset and this key is not in it. */
export function isTemplateLocked(template, access) {
  if (!access || access.unlimited) return false
  if (!template?.is_system) return false          // theirs, never locked
  if (template.type === 'checklist') return false // the product itself
  const keys = access.usable_keys
  return Array.isArray(keys) ? !keys.includes(template.key) : false
}

/* ---------------------------- team ---------------------------- */

export async function listInvites() {
  const { data, error } = await supabase
    .from('workspace_invites')
    .select('*')
    .order('created_at', { ascending: false })

  if (error) throw error
  return data ?? []
}

export async function createInvite(role, label) {
  const { data, error } = await supabase.rpc('create_invite', {
    p_role: role,
    p_label: label ?? null,
  })
  if (error) throw error
  return data
}

export async function revokeInvite(id) {
  const { error } = await supabase
    .from('workspace_invites')
    .update({ revoked_at: new Date().toISOString() })
    .eq('id', id)
  if (error) throw error
}

export const peekInvite = async (token) => {
  const { data, error } = await supabase.rpc('peek_invite', { p_token: token })
  if (error) throw error
  return data
}

export const acceptInvite = async (token) => {
  const { data, error } = await supabase.rpc('accept_invite', { p_token: token })
  if (error) throw error
  return data
}

/* ------------------------- admin only ------------------------- */

export async function adminListCodes() {
  const { data, error } = await supabase.rpc('admin_list_codes')
  if (error) throw error
  return data ?? []
}

export async function adminCreateCode(fields) {
  const { data, error } = await supabase.rpc('admin_create_code', {
    p_code: fields.code,
    p_plan_key: fields.planKey,
    p_type: fields.type,
    p_days: fields.days ?? null,
    p_max_uses: fields.maxUses ?? null,
    p_note: fields.note ?? null,
  })
  if (error) throw error
  return data
}

export const adminRevokeCode = (id) => rpc('admin_revoke_code', { p_id: id })
export const adminSetCodeDuration = (id, days) =>
  rpc('admin_set_code_duration', { p_id: id, p_days: days })
export const adminExtensionPreview = (id) => rpc('admin_extension_preview', { p_id: id })
export const adminExtendWorkspaces = (id, days) =>
  rpc('admin_extend_workspaces', { p_id: id, p_extra_days: days })
export const adminEndAccess = (workspaceId) =>
  rpc('admin_end_access', { p_workspace: workspaceId })
export const adminListWorkspaces = () => rpc('admin_list_workspaces')
export const adminSetPlan = (workspaceId, planKey, days) =>
  rpc('admin_set_plan', { p_workspace: workspaceId, p_plan_key: planKey, p_days: days ?? null })

async function rpc(name, args) {
  const { data, error } = await supabase.rpc(name, args)
  if (error) throw error
  return data
}
