import { createClient } from '@supabase/supabase-js'

/**
 * The public booking page's only route into the database.
 *
 * Five SECURITY DEFINER functions, each returning a hand-picked column
 * list. There is no `anon` policy on any table, so this client cannot
 * read contacts, projects or anybody else's bookings even if it tried.
 *
 * A separate client instance with no session, so a signed-in designer
 * previewing their own page sees exactly what a visitor sees.
 */
const publicClient = createClient(
  import.meta.env.VITE_SUPABASE_URL,
  import.meta.env.VITE_SUPABASE_ANON_KEY,
  { auth: { persistSession: false, autoRefreshToken: false } }
)

export async function fetchBookingPage(slug) {
  const { data, error } = await publicClient.rpc('public_booking_page', { p_slug: slug })
  if (error) throw error
  return data
}

export async function fetchSlots(slug, sessionTypeId, from, to) {
  const { data, error } = await publicClient.rpc('public_available_slots', {
    p_slug: slug,
    p_session_type: sessionTypeId,
    p_from: from,
    p_to: to,
  })
  if (error) throw error
  return data ?? []
}

export async function submitBooking(values) {
  const { data, error } = await publicClient.rpc('public_create_booking', {
    p_slug: values.slug,
    p_session_type: values.sessionTypeId,
    p_slot_start: values.slotStart,
    p_name: values.name,
    p_email: values.email || null,
    p_phone_code: values.phoneCode || null,
    p_phone: values.phone || null,
    p_brief: values.brief || null,
    p_answers: values.answers ?? {},
  })
  if (error) throw error
  return data
}

export async function fetchBookingStatus(token) {
  const { data, error } = await publicClient.rpc('public_booking_status', { p_token: token })
  if (error) throw error
  return data
}

/**
 * Uploads the transfer receipt, then records it.
 *
 * The bucket is private and capped at 5MB with a mime whitelist, and
 * the path must sit inside this booking's own folder — both the storage
 * policy and the function check that independently.
 */
export async function uploadReceipt(token, uploadPrefix, file) {
  const extension = file.name.split('.').pop().toLowerCase()
  const path = `${uploadPrefix}/receipt-${Date.now()}.${extension}`

  const { error: uploadError } = await publicClient.storage
    .from('receipts')
    .upload(path, file, { contentType: file.type })

  if (uploadError) throw uploadError

  const { error } = await publicClient.rpc('public_attach_receipt', {
    p_token: token,
    p_path: path,
  })
  if (error) throw error

  return path
}
