import { supabase } from './supabase'
import { digitsOnly } from './phone'

/**
 * Every contacts query in one place.
 *
 * None of these filter by workspace. They do not need to — Row Level
 * Security does it in the database, so a bug here cannot leak another
 * studio's data.
 */

const CONTACT_COLUMNS = '*'

export async function listContacts(isClient) {
  const { data, error } = await supabase
    .from('contacts')
    .select(CONTACT_COLUMNS)
    .eq('is_client', isClient)
    .order('created_at', { ascending: false })

  if (error) throw error
  return data ?? []
}

export async function getContact(id) {
  const { data, error } = await supabase
    .from('contacts')
    .select(CONTACT_COLUMNS)
    .eq('id', id)
    .maybeSingle()

  if (error) throw error
  return data
}

export async function createContact(values) {
  const { data, error } = await supabase
    .from('contacts')
    .insert(values)
    .select(CONTACT_COLUMNS)
    .single()

  if (error) throw error
  return data
}

export async function updateContact(id, patch) {
  const { data, error } = await supabase
    .from('contacts')
    .update(patch)
    .eq('id', id)
    .select(CONTACT_COLUMNS)
    .single()

  if (error) throw error
  return data
}

/** Manual conversion. Bucket 5 will also trigger this on booking. */
export async function convertToClient(id) {
  return updateContact(id, { is_client: true, converted_at: new Date().toISOString() })
}

/**
 * Warns about a duplicate email — it never blocks. Two family members
 * sharing an address is normal and not the app's business to refuse.
 */
export async function findDuplicateEmail(email, excludeId) {
  const trimmed = String(email ?? '').trim()
  if (!trimmed) return null

  let query = supabase
    .from('contacts')
    .select('id, first_name, last_name')
    .ilike('email', trimmed)
    .limit(1)

  if (excludeId) query = query.neq('id', excludeId)

  const { data, error } = await query
  if (error) return null
  return data?.[0] ?? null
}

/** Global search across name, email and phone. */
export async function searchContacts(term) {
  const trimmed = term.trim()
  if (trimmed.length < 2) return []

  const like = `%${trimmed}%`
  const filters = [
    `first_name.ilike.${like}`,
    `last_name.ilike.${like}`,
    `email.ilike.${like}`,
  ]

  const digits = digitsOnly(trimmed)
  if (digits) filters.push(`phone_number.ilike.%${digits}%`)

  const { data, error } = await supabase
    .from('contacts')
    .select('id, first_name, last_name, email, phone_country_code, phone_number, is_client')
    .or(filters.join(','))
    .limit(20)

  if (error) throw error
  return data ?? []
}

/* ---------------------------------------------------------------- */
/* Notes                                                             */
/* ---------------------------------------------------------------- */

export async function listNotes(contactId) {
  const { data, error } = await supabase
    .from('notes')
    .select('id, body, created_at, created_by')
    .eq('contact_id', contactId)
    .order('created_at', { ascending: false })

  if (error) throw error
  return data ?? []
}

/** The database trigger bumps the contact's last_contact_at for us. */
export async function addNote(contactId, body) {
  const { data, error } = await supabase
    .from('notes')
    .insert({ contact_id: contactId, body })
    .select('id, body, created_at, created_by')
    .single()

  if (error) throw error
  return data
}

export async function deleteNote(id) {
  const { error } = await supabase.from('notes').delete().eq('id', id)
  if (error) throw error
}

/* ---------------------------------------------------------------- */
/* Display helpers                                                   */
/* ---------------------------------------------------------------- */

export function fullName(contact) {
  if (!contact) return ''
  return [contact.first_name, contact.last_name].filter(Boolean).join(' ')
}

/** Falls back to the date added, so a never-contacted lead still ages. */
export function contactClock(contact) {
  return contact?.last_contact_at || contact?.created_at || null
}
