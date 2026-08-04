import { supabase } from './supabase'

/** Templates, the questionnaire, and the record of what was generated. */

export async function listTemplates() {
  const { data, error } = await supabase
    .from('templates')
    .select('*')
    .order('type')
    .order('sort_order')
    .order('key')

  if (error) throw error
  return data ?? []
}

/**
 * Groups the flat rows into one entry per key, holding both languages.
 * The Templates screen shows the pair side by side, so the pairing has
 * to happen by key + language — never by array order.
 */
export function pairByKey(rows) {
  const byKey = new Map()

  for (const row of rows) {
    if (!byKey.has(row.key)) {
      byKey.set(row.key, {
        key: row.key,
        type: row.type,
        channel: row.channel,
        stage: row.stage,
        sort_order: row.sort_order,
        is_system: row.is_system,
        active: row.active,
        ar: null,
        en: null,
      })
    }
    byKey.get(row.key)[row.language] = row
  }

  return [...byKey.values()].sort(
    (a, b) => a.sort_order - b.sort_order || a.key.localeCompare(b.key)
  )
}

export async function updateTemplate(id, patch) {
  const { data, error } = await supabase
    .from('templates')
    .update(patch)
    .eq('id', id)
    .select('*')
    .single()

  if (error) throw error
  return data
}

export async function createTemplate(row) {
  const { data, error } = await supabase.from('templates').insert(row).select('*').single()
  if (error) throw error
  return data
}

/** Duplicates both language rows of a key under a new key. */
export async function duplicateTemplate(pair) {
  const stamp = Date.now().toString(36)
  const newKey = `${pair.key}_copy_${stamp}`

  const rows = ['ar', 'en']
    .map((lang) => pair[lang])
    .filter(Boolean)
    .map((row) => ({
      key: newKey,
      type: row.type,
      channel: row.channel,
      stage: row.stage,
      language: row.language,
      title: `${row.title} (copy)`,
      subject: row.subject,
      body: row.body,
      is_system: false,
      active: true,
      sort_order: row.sort_order,
    }))

  const { data, error } = await supabase.from('templates').insert(rows).select('*')
  if (error) throw error
  return data
}

/** Deactivating hides a template without destroying it. */
export async function setPairActive(pair, active) {
  const ids = ['ar', 'en'].map((lang) => pair[lang]?.id).filter(Boolean)
  const { error } = await supabase.from('templates').update({ active }).in('id', ids)
  if (error) throw error
}

export async function getQuestionnaire() {
  const { data, error } = await supabase
    .from('questionnaire_templates')
    .select('*')
    .maybeSingle()

  if (error) throw error
  return data
}

/** Restores the seeded templates. Templates you made are untouched. */
export async function resetSystemTemplates() {
  const { data, error } = await supabase.rpc('reset_system_templates')
  if (error) throw error
  return data
}

/* ---------------------------------------------------------------- */
/* Generated documents                                               */
/* ---------------------------------------------------------------- */

export async function saveGeneratedDocument(row) {
  const { data, error } = await supabase
    .from('generated_documents')
    .insert(row)
    .select('*')
    .single()

  if (error) throw error
  return data
}

export async function listGeneratedDocuments(contactId) {
  const { data, error } = await supabase
    .from('generated_documents')
    .select('*')
    .eq('contact_id', contactId)
    .order('created_at', { ascending: false })

  if (error) throw error
  return data ?? []
}
