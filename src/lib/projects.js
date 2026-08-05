import { supabase } from './supabase'

/**
 * Projects and the stage engine.
 *
 * The gate rules are not here — they live in the database, so that
 * "signed contract AND first payment, never one" holds no matter what
 * calls it. These are just the calls.
 */

export const PROJECT_STATES = [
  'on_track',
  'waiting_client',
  'needs_attention',
  'on_hold',
  'closed',
]

/** Colour per state, reusing the shared status palette. */
export const STATE_COLOR = {
  on_track: 'var(--success)',
  waiting_client: 'var(--warning)',
  needs_attention: 'var(--danger)',
  on_hold: 'var(--muted)',
  closed: 'var(--muted)',
}

export async function listStageDefinitions() {
  const { data, error } = await supabase
    .from('stage_definitions')
    .select('*')
    .order('sort_order')

  if (error) throw error
  return data ?? []
}

/** Active (false), delivered (true), or — with no argument — all of them. */
export async function listProjects(isArchived) {
  let query = supabase
    .from('projects')
    .select('*, contact:contacts(id, first_name, last_name, country)')
  if (isArchived !== undefined) query = query.eq('is_archived', isArchived)

  const { data, error } = await query.order('created_at', { ascending: false })
  if (error) throw error
  return data ?? []
}

export async function listProjectsForContact(contactId) {
  const { data, error } = await supabase
    .from('projects')
    .select('*')
    .eq('contact_id', contactId)
    .order('created_at', { ascending: false })

  if (error) throw error
  return data ?? []
}

export async function getProject(id) {
  const { data, error } = await supabase
    .from('projects')
    .select('*, contact:contacts(*)')
    .eq('id', id)
    .maybeSingle()

  if (error) throw error
  return data
}

export async function updateProject(id, patch) {
  const { data, error } = await supabase
    .from('projects')
    .update(patch)
    .eq('id', id)
    .select('*, contact:contacts(*)')
    .single()

  if (error) throw error
  return data
}

export async function listProjectStages(projectId) {
  const { data, error } = await supabase
    .from('project_stages')
    .select('*')
    .eq('project_id', projectId)
    .order('sort_order')

  if (error) throw error
  return data ?? []
}

export async function listChecklistItems(projectId) {
  const { data, error } = await supabase
    .from('checklist_items')
    .select('*')
    .eq('project_id', projectId)
    .order('sort_order')

  if (error) throw error
  return data ?? []
}

export async function setChecklistItemDone(id, isDone, profileId) {
  const { error } = await supabase
    .from('checklist_items')
    .update({
      is_done: isDone,
      done_at: isDone ? new Date().toISOString() : null,
      done_by: isDone ? profileId : null,
    })
    .eq('id', id)

  if (error) throw error
}

/* ---------------------------------------------------------------- */
/* The stage engine — all of these are database functions            */
/* ---------------------------------------------------------------- */

export async function createProject(values) {
  const { data, error } = await supabase.rpc('create_project', {
    p_contact_id: values.contact_id,
    p_name: values.name,
    p_address: values.address || null,
    p_area: values.area_sqm === '' ? null : Number(values.area_sqm),
    p_type: values.project_type || null,
    p_requirements: values.requirements || null,
  })

  if (error) throw error
  return data
}

export async function setGateFlag(stageId, flag, value) {
  const { error } = await supabase.rpc('set_gate_flag', {
    p_stage_id: stageId,
    p_flag: flag,
    p_value: value,
  })
  if (error) throw error
}

export async function overrideGate(stageId, reason) {
  const { error } = await supabase.rpc('override_gate', {
    p_stage_id: stageId,
    p_reason: reason,
  })
  if (error) throw error
}

export async function completeStage(stageId) {
  const { error } = await supabase.rpc('complete_stage', { p_stage_id: stageId })
  if (error) throw error
}

/* ---------------------------------------------------------------- */
/* Progress                                                          */
/* ---------------------------------------------------------------- */

/**
 * How far through the project we are, 0-100.
 *
 *   (stages completed + fraction of the current stage's checklist) / 10
 *
 * The literal reading — items done across all reached stages — does not
 * work with this data. Stages 05 to 09 ship with no checklist, so a
 * project sitting in stage 06 with stages 01-04 fully ticked would read
 * 100% while more than half the work is still ahead.
 *
 * Weighting by stage keeps the ring monotonic and honest: it can never
 * overstate, and it still moves as the current stage's checklist fills.
 */
export function projectProgress(stages, items) {
  const total = stages.length || 10
  const completed = stages.filter((s) => s.status === 'complete').length
  const active = stages.find((s) => s.status === 'active')

  let currentFraction = 0
  if (active) {
    const own = items.filter((item) => item.stage_key === active.stage_key)
    if (own.length > 0) {
      currentFraction = own.filter((item) => item.is_done).length / own.length
    }
  }

  return Math.round(((completed + currentFraction) / total) * 100)
}

/** Builds the timeline from what already exists — no separate event log. */
export function buildTimeline(stages, definitions, documents, approvals, language) {
  const label = (key) => {
    const d = definitions.find((x) => x.stage_key === key)
    return (language === 'ar' ? d?.title_ar : d?.title_en) ?? key
  }

  const events = []

  for (const stage of stages) {
    if (stage.completed_at) {
      events.push({
        at: stage.completed_at,
        kind: 'stage_complete',
        stage: label(stage.stage_key),
        skipped: stage.gate_state?.skipped === true,
      })
    }
    if (stage.overridden_at) {
      events.push({
        at: stage.overridden_at,
        kind: 'override',
        stage: label(stage.stage_key),
        reason: stage.override_reason,
      })
    }
  }

  for (const doc of documents) {
    events.push({ at: doc.created_at, kind: 'document', title: doc.title, id: doc.id })
  }

  // Every portal decision lands here — both the approvals and the
  // change requests, each against the stage it was made on.
  for (const approval of approvals ?? []) {
    events.push({
      at: approval.decided_at,
      kind: approval.decision === 'approved' ? 'approved' : 'changes_requested',
      stage: label(approval.stage_key),
      comment: approval.comment,
      onFile: Boolean(approval.item_ref),
    })
  }

  return events.sort((a, b) => new Date(b.at) - new Date(a.at))
}
