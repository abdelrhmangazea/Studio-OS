import { supabase } from './supabase'

/**
 * Beta feedback, and the counts that decide what survives it.
 *
 * Nothing here is sent anywhere. A report is a row in the database
 * that we read on the internal screen — the product still sends no
 * email and no WhatsApp.
 */

/**
 * The caller supplies only what they typed. Workspace and author come
 * from the session inside the function, so a report cannot be filed
 * against another studio.
 */
export async function submitFeedback({ kind, message, page }) {
  const { data, error } = await supabase.rpc('submit_feedback', {
    p_kind: kind,
    p_message: message,
    p_page: page ?? null,
    // Enough to reproduce it without asking the designer to describe
    // their browser. No client data, nothing they typed elsewhere.
    p_context: {
      language: document.documentElement.lang || null,
      theme: document.documentElement.dataset.theme || null,
      viewport: `${window.innerWidth}x${window.innerHeight}`,
      user_agent: navigator.userAgent.slice(0, 300),
      sent_at: new Date().toISOString(),
    },
  })

  if (error) throw error
  return data
}

/** What this studio has already sent, so they can see it landed. */
export async function listMyFeedback() {
  const { data, error } = await supabase
    .from('feedback')
    .select('id, kind, state, message, page, reply, created_at')
    .order('created_at', { ascending: false })

  if (error) throw error
  return data ?? []
}

/**
 * A count, nothing more.
 *
 * Deliberately fire-and-forget: a feature must never fail to open
 * because the counter was unreachable. The count is for us, the
 * feature is for them.
 */
export function recordFeatureUse(feature) {
  supabase.rpc('record_feature_use', { p_feature: feature }).then(
    () => {},
    () => {}
  )
}

/* ---------------- internal, platform admins only ---------------- */

export async function isPlatformAdmin() {
  const { data, error } = await supabase.rpc('is_platform_admin')
  if (error) return false
  return Boolean(data)
}

export async function adminOverview() {
  const { data, error } = await supabase.rpc('admin_overview')
  if (error) throw error
  return data
}

/**
 * Every report, across every studio. This is the one query in the
 * product that crosses workspaces, and it is allowed by a policy that
 * covers this table and feature_usage only.
 */
export async function adminListFeedback(state) {
  let query = supabase
    .from('feedback')
    .select('id, workspace_id, kind, state, message, page, context, reply, created_at')
    .order('created_at', { ascending: false })
    .limit(300)

  if (state) query = query.eq('state', state)

  const { data, error } = await query
  if (error) throw error
  return data ?? []
}

export async function adminUpdateFeedback(id, patch) {
  const { data, error } = await supabase
    .from('feedback')
    .update(patch)
    .eq('id', id)
    .select('*')
    .single()

  if (error) throw error
  return data
}
