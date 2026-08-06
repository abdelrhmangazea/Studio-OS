import { supabase } from './supabase'

/** Suppliers, and the projects they worked on. */

export async function listSuppliers() {
  const { data, error } = await supabase
    .from('suppliers')
    .select('*')
    .order('name')

  if (error) throw error
  return data ?? []
}

export async function createSupplier(row) {
  const { data, error } = await supabase.from('suppliers').insert(row).select('*').single()
  if (error) throw error
  return data
}

export async function updateSupplier(id, patch) {
  const { data, error } = await supabase
    .from('suppliers')
    .update(patch)
    .eq('id', id)
    .select('*')
    .single()

  if (error) throw error
  return data
}

export async function deleteSupplier(id) {
  const { error } = await supabase.from('suppliers').delete().eq('id', id)
  if (error) throw error
}

/* ---------------------------------------------------------------- */
/* Which suppliers worked on which project                           */
/* ---------------------------------------------------------------- */

export async function listProjectSuppliers(projectId) {
  const { data, error } = await supabase
    .from('project_suppliers')
    .select('*, supplier:suppliers(*)')
    .eq('project_id', projectId)
    .order('created_at')

  if (error) throw error
  return data ?? []
}

export async function attachSupplier(projectId, supplierId, role) {
  const { error } = await supabase
    .from('project_suppliers')
    .insert({ project_id: projectId, supplier_id: supplierId, role: role || null })

  if (error) throw error
}

export async function detachSupplier(id) {
  const { error } = await supabase.from('project_suppliers').delete().eq('id', id)
  if (error) throw error
}

/** Every project a supplier has been used on — their track record. */
export async function listSupplierProjects(supplierId) {
  const { data, error } = await supabase
    .from('project_suppliers')
    .select('id, role, project:projects(id, code, name, delivered_at)')
    .eq('supplier_id', supplierId)

  if (error) throw error
  return data ?? []
}
