import { supabase } from './supabase'

/** Supplier quotations against a project. */

export async function listQuotations(projectId) {
  const { data, error } = await supabase
    .from('quotations')
    .select('*, supplier:suppliers(id, name, category)')
    .eq('project_id', projectId)
    .order('requested_at', { ascending: false })

  if (error) throw error
  return data ?? []
}

export async function requestQuotation(row) {
  const { data, error } = await supabase.from('quotations').insert(row).select('*').single()
  if (error) throw error
  return data
}

export async function updateQuotation(id, patch) {
  const { error } = await supabase.from('quotations').update(patch).eq('id', id)
  if (error) throw error
}

/**
 * Accepting one rejects the others for the same stage.
 *
 * The database also enforces one accepted quotation per project per
 * stage, so a race between two tabs cannot leave two accepted.
 */
export async function acceptQuotation(quotation) {
  const others = await supabase
    .from('quotations')
    .update({ status: 'rejected' })
    .eq('project_id', quotation.project_id)
    .eq('status', 'accepted')

  if (others.error) throw others.error

  const { error } = await supabase
    .from('quotations')
    .update({ status: 'accepted', received_at: quotation.received_at ?? new Date().toISOString() })
    .eq('id', quotation.id)

  if (error) throw error
}

export async function deleteQuotation(id) {
  const { error } = await supabase.from('quotations').delete().eq('id', id)
  if (error) throw error
}

export async function listSupplierCategories() {
  const { data, error } = await supabase
    .from('supplier_categories')
    .select('*')
    .order('sort_order')

  if (error) throw error
  return data ?? []
}
