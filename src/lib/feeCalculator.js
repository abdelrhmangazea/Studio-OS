import { supabase } from './supabase'

/** Saved calculations — how a project was priced, months later. */

export async function listCalculations(projectId) {
  const { data, error } = await supabase
    .from('fee_calculations')
    .select('*')
    .eq('project_id', projectId)
    .order('created_at', { ascending: false })

  if (error) throw error
  return data ?? []
}

export async function saveCalculation({ projectId, method, inputs, result }) {
  const { data, error } = await supabase
    .from('fee_calculations')
    .insert({ project_id: projectId, method, inputs, result })
    .select('*')
    .single()

  if (error) throw error
  return data
}

export async function deleteCalculation(id) {
  const { error } = await supabase.from('fee_calculations').delete().eq('id', id)
  if (error) throw error
}

/** Which methods this studio actually reaches for. */
export async function methodUsage() {
  const { data, error } = await supabase.rpc('pricing_method_usage')
  if (error) throw error
  return data ?? []
}

/**
 * Pushes a result into the project's value field, and optionally into
 * the five fee_phase inputs the proposal document reads.
 *
 * The phases are stored on the calculation rather than on the project,
 * because they belong to a particular quote — repricing should not
 * silently rewrite what a client was already sent.
 */
export async function applyToProject(projectId, value) {
  const { error } = await supabase.from('projects').update({ value }).eq('id', projectId)
  if (error) throw error
}
