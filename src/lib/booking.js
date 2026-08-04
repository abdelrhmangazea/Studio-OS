import { supabase } from './supabase'

/** Booking, as the signed-in designer sees it. */

export const WEEKDAYS = [0, 1, 2, 3, 4, 5, 6]

export async function getBookingSettings() {
  const { data, error } = await supabase.from('booking_settings').select('*').maybeSingle()
  if (error) throw error
  return data
}

export async function saveBookingSettings(id, patch) {
  const query = id
    ? supabase.from('booking_settings').update(patch).eq('id', id)
    : supabase.from('booking_settings').insert(patch)

  const { data, error } = await query.select('*').single()
  if (error) throw error
  return data
}

export async function listSessionTypes() {
  const { data, error } = await supabase.from('session_types').select('*').order('sort_order')
  if (error) throw error
  return data ?? []
}

export async function listBookingQuestions() {
  const { data, error } = await supabase.from('booking_questions').select('*').order('sort_order')
  if (error) throw error
  return data ?? []
}

export async function listBlockedDates() {
  const { data, error } = await supabase.from('blocked_dates').select('*').order('date')
  if (error) throw error
  return data ?? []
}

const crud = (table) => ({
  async create(row) {
    const { data, error } = await supabase.from(table).insert(row).select('*').single()
    if (error) throw error
    return data
  },
  async update(id, patch) {
    const { data, error } = await supabase.from(table).update(patch).eq('id', id).select('*').single()
    if (error) throw error
    return data
  },
  async remove(id) {
    const { error } = await supabase.from(table).delete().eq('id', id)
    if (error) throw error
  },
})

export const sessionTypes = crud('session_types')
export const bookingQuestions = crud('booking_questions')
export const blockedDates = crud('blocked_dates')

/* ---------------------------------------------------------------- */
/* Bookings                                                          */
/* ---------------------------------------------------------------- */

export async function listBookings() {
  const { data, error } = await supabase
    .from('bookings')
    .select('*, session_type:session_types(*), contact:contacts(*), project:projects(*)')
    .order('slot_start', { ascending: false })

  if (error) throw error
  return data ?? []
}

export async function getBooking(id) {
  const { data, error } = await supabase
    .from('bookings')
    .select('*, session_type:session_types(*), contact:contacts(*), project:projects(*)')
    .eq('id', id)
    .maybeSingle()

  if (error) throw error
  return data
}

export async function countUnseenBookings() {
  const { count, error } = await supabase
    .from('bookings')
    .select('id', { count: 'exact', head: true })
    .is('seen_at', null)

  if (error) return 0
  return count ?? 0
}

export async function markBookingSeen(id) {
  await supabase.from('bookings').update({ seen_at: new Date().toISOString() }).eq('id', id)
}

export async function setBookingStatus(id, status) {
  const { data, error } = await supabase
    .from('bookings')
    .update({ status })
    .eq('id', id)
    .select('*')
    .single()

  if (error) throw error
  return data
}

/* ---------------------------------------------------------------- */
/* Invoices and receipts — no gateway, ever                          */
/* ---------------------------------------------------------------- */

export async function listInvoices(bookingId) {
  const { data, error } = await supabase
    .from('invoices')
    .select('*, receipts(*)')
    .eq('booking_id', bookingId)
    .order('created_at', { ascending: false })

  if (error) throw error
  return data ?? []
}

export async function issueInvoice(row) {
  const { data, error } = await supabase
    .from('invoices')
    .insert({ ...row, status: 'sent', issued_at: new Date().toISOString() })
    .select('*, receipts(*)')
    .single()

  if (error) throw error
  return data
}

/**
 * Confirming a receipt is the ONLY thing that makes a booking confirmed.
 * Nothing is verified automatically; this human action is the truth.
 */
export async function confirmReceipt(receipt, profileId, bookingId) {
  const { error } = await supabase
    .from('receipts')
    .update({ confirmed: true, confirmed_by: profileId, confirmed_at: new Date().toISOString() })
    .eq('id', receipt.id)

  if (error) throw error

  await supabase.from('invoices').update({ status: 'paid' }).eq('id', receipt.invoice_id)
  if (bookingId) await setBookingStatus(bookingId, 'confirmed')
}

/** A private bucket, so the designer views receipts through signed URLs. */
export async function receiptUrl(path) {
  const { data, error } = await supabase.storage.from('receipts').createSignedUrl(path, 300)
  if (error) return null
  return data.signedUrl
}
