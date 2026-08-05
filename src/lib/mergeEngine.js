import { supabase } from './supabase'
import { fullName } from './contacts'
import { formatPhone } from './phone'
import { formatDate } from './format'
import { countryName } from '../data/countries'
import { FIELD_BY_NAME, isKnownField, isPromptField } from '../data/mergeFields'

/**
 * The merge-field engine.
 *
 * Three jobs:
 *   1. find every {{field}} in a template
 *   2. resolve the auto ones from the database
 *   3. render, marking anything unresolved as [[field]] — loudly, never
 *      as a blank, so nothing is ever sent with an invisible gap
 */

const FIELD_PATTERN = /\{\{(\w+)\}\}/g

/** Every distinct {{field}} in the given text, in order of appearance. */
export function extractFields(...texts) {
  const found = []
  for (const text of texts) {
    for (const match of String(text ?? '').matchAll(FIELD_PATTERN)) {
      if (!found.includes(match[1])) found.push(match[1])
    }
  }
  return found
}

export function splitFields(fields) {
  return {
    auto: fields.filter((f) => isKnownField(f) && !isPromptField(f)),
    prompt: fields.filter((f) => isPromptField(f)),
    unknown: fields.filter((f) => !isKnownField(f)),
  }
}

/** The Friday of the current week — these updates go out on a Friday. */
function endOfWeek() {
  const date = new Date()
  const daysUntilFriday = (5 - date.getDay() + 7) % 7
  date.setDate(date.getDate() + daysUntilFriday)
  return date
}

/**
 * Resolves every auto field it can. A field with no value resolves to
 * null, which the renderer turns into a visible [[marker]].
 *
 * `language` is the template's language, not the designer's — a document
 * written in Arabic formats its dates in Arabic even if the app is in
 * English.
 */
export async function resolveAutoFields({
  contact,
  settings,
  profile,
  project,
  booking,
  invoice,
  language,
}) {
  const contractSentAt = contact ? await findContractSentDate(contact.id) : null
  const bookingLink = await findBookingLink()

  const values = {
    // contacts
    client_first_name: contact?.first_name ?? null,
    client_full_name: contact ? fullName(contact) : null,
    client_email: contact?.email ?? null,
    client_phone: contact?.phone_number
      ? formatPhone(contact.phone_country_code, contact.phone_number)
      : null,
    client_country: contact?.country ? countryName(contact.country, language) : null,

    // studio_settings
    studio_name: settings?.studio_name ?? null,
    // An issued invoice carries its own currency; the studio default is
    // only the fallback for documents generated without one.
    currency: invoice?.currency ?? settings?.currency ?? null,
    designer_phone: settings?.contact_phone ?? null,
    designer_email: settings?.contact_email ?? null,
    designer_website: settings?.website ?? null,

    // profiles
    designer_name: profile?.name ?? null,
    designer_title: profile?.title ?? null,

    // system dates
    today_date: formatDate(new Date(), language),
    week_ending_date: formatDate(endOfWeek(), language),

    // generated_documents
    contract_sent_date: contractSentAt ? formatDate(contractSentAt, language) : null,

    // projects — resolved once a document is generated from inside one
    project_name: project?.name ?? null,
    project_code: project?.code ?? null,
    project_description: project?.requirements ?? null,
    project_type: project?.project_type ?? null,
    property_address: project?.address ?? null,

    // bookings — resolved once a document is generated from a booking
    consultation_date: booking ? formatDate(booking.slot_start, language) : null,
    consultation_time: booking ? formatBookingTime(booking, language) : null,
    consultation_mode: booking?.session_type
      ? (language === 'ar' ? booking.session_type.label_ar : booking.session_type.label_en)
      : null,
    consultation_duration: booking?.session_type
      ? `${booking.session_type.duration_minutes} ${language === 'ar' ? 'دقيقة' : 'minutes'}`
      : null,
    consultation_type: booking?.session_type
      ? (language === 'ar' ? booking.session_type.label_ar : booking.session_type.label_en)
      : null,
    booking_link: bookingLink,

    // invoices — the amount stops being a question once a real invoice
    // exists. The figure entered when it was issued is the only one that
    // can be right, so it is never re-typed.
    invoice_amount: invoice?.amount ?? null,

    // The project's live portal link. Empty until one is issued, and
    // empty again the moment it is revoked — a revoked token must never
    // be merged into a message.
    portal_link: project ? await findPortalLink(project.id) : null,
  }

  return values
}

/**
 * Prompt fields an issued invoice answers on its own.
 *
 * The generator subtracts these from the questions it asks, so
 * generating from a real invoice never asks for an amount it already
 * knows. Generated without an invoice, they stay questions.
 */
export function invoiceSuppliedFields(invoice) {
  return invoice ? ['invoice_amount'] : []
}

/** The consultation time, in the STUDIO's timezone — never the reader's. */
function formatBookingTime(booking, language) {
  const tz = booking.timezone ?? 'Africa/Cairo'
  return new Intl.DateTimeFormat(language === 'ar' ? 'ar-EG-u-nu-latn' : 'en-GB', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
    timeZone: tz,
  }).format(new Date(booking.slot_start))
}

/** The studio's own public booking URL, if it has one turned on. */
async function findBookingLink() {
  const { data } = await supabase
    .from('booking_settings')
    .select('public_slug, is_active')
    .maybeSingle()

  if (!data?.is_active || !data.public_slug) return null
  return `${window.location.origin}/book/${data.public_slug}`
}

/** This project's live portal URL, if it has one turned on. */
async function findPortalLink(projectId) {
  const { data } = await supabase
    .from('portal_links')
    .select('token')
    .eq('project_id', projectId)
    .eq('is_active', true)
    .maybeSingle()

  if (!data?.token) return null
  return `${window.location.origin}/portal/${data.token}`
}

/** When the contract message was last generated for this contact. */
async function findContractSentDate(contactId) {
  const { data } = await supabase
    .from('generated_documents')
    .select('created_at')
    .eq('contact_id', contactId)
    .eq('template_key', 'contract_send')
    .order('created_at', { ascending: false })
    .limit(1)

  return data?.[0]?.created_at ?? null
}

/**
 * Replaces every {{field}} with its value.
 *
 * A field with no value becomes [[field]] — deliberately ugly, so it is
 * impossible to miss in the preview or in an exported document.
 */
export function renderTemplate(text, values) {
  return String(text ?? '').replace(FIELD_PATTERN, (whole, name) => {
    const value = values[name]
    if (value === undefined || value === null || String(value).trim() === '') {
      return `[[${name}]]`
    }
    return String(value)
  })
}

/** Which fields used by this template still have no value. */
export function unresolvedFields(fields, values) {
  return fields.filter((name) => {
    const value = values[name]
    return value === undefined || value === null || String(value).trim() === ''
  })
}
