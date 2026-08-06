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

    // ---- the studio as a legal entity ----
    studio_legal_name:             settings?.legal_name ?? null,
    studio_registration_number:    settings?.registration_number ?? null,
    studio_registered_address:     settings?.registered_address ?? null,
    studio_country:                settings?.country ?? null,
    studio_representative_name:    settings?.representative_name ?? null,
    studio_representative_id:      settings?.representative_id ?? null,
    studio_representative_id_type: idTypeLabel(settings?.representative_id_type, language),
    studio_representative_issuer:  settings?.representative_issuer ?? null,
    governing_law:                 settings?.governing_law ?? null,
    dispute_venue:                 settings?.dispute_venue ?? null,
    minimum_project_value:         settings?.minimum_project_value ?? null,

    // VAT is stored as a rate and a treatment; the contract reads them
    // as words, so the enum never reaches the page.
    vat_rate: settings?.vat_rate === null || settings?.vat_rate === undefined
      ? null
      : `${settings.vat_rate}%`,
    vat_treatment: vatTreatmentLabel(settings?.vat_treatment, language),

    // ---- the client as a signing party ----
    client_address:   contact?.address ?? null,
    client_id_number: contact?.id_number ?? null,
    client_id_type:   idTypeLabel(contact?.id_type, language),
    client_id_issuer: contact?.id_issuer ?? null,

    // ---- hourly rates ----
    rate_lead_designer:    settings?.hourly_rates?.lead_designer ?? null,
    rate_senior_assistant: settings?.hourly_rates?.senior_assistant ?? null,
    rate_design_manager:   settings?.hourly_rates?.design_manager ?? null,
    rate_office_designer:  settings?.hourly_rates?.office_designer ?? null,
    rate_office_admin:     settings?.hourly_rates?.office_admin ?? null,

    // The contract must quote the SAME allowance the portal counts
    // against, so it reads the one column rather than a copy.
    revision_allowance: settings?.default_revision_allowance ?? null,

    // Derived from the booking availability, never stored twice — the
    // contract cannot claim hours the booking page does not offer.
    ...(await workingTime(language)),
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

/** An id type reaches the document as a word, never as its enum value. */
function idTypeLabel(type, language) {
  if (!type) return null
  const labels = {
    national_id:             { ar: 'بطاقة رقم قومي', en: 'National ID' },
    passport:                { ar: 'جواز سفر',       en: 'Passport' },
    residency:               { ar: 'إقامة',          en: 'Residency' },
    commercial_registration: { ar: 'سجل تجاري',      en: 'Commercial registration' },
  }
  return labels[type]?.[language] ?? labels[type]?.ar ?? type
}

/** "تشمل" / "لا تشمل", not "inclusive" / "exclusive". */
function vatTreatmentLabel(treatment, language) {
  if (!treatment) return null
  const labels = {
    inclusive: { ar: 'تشمل',    en: 'inclusive of' },
    exclusive: { ar: 'لا تشمل', en: 'exclusive of' },
  }
  return labels[treatment]?.[language] ?? labels[treatment]?.ar ?? treatment
}

const DAY_NAMES = {
  ar: ['الأحد', 'الإثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة', 'السبت'],
  en: ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'],
}

/**
 * Working days and hours, read out of the booking availability.
 *
 * Deliberately NOT stored on studio_settings. If they were, the
 * contract could promise hours the booking page does not offer, and
 * nothing would ever notice. One source, two readers.
 *
 * Consecutive days collapse into a range: "الأحد إلى الخميس".
 */
async function workingTime(language) {
  const { data } = await supabase
    .from('booking_settings')
    .select('availability')
    .maybeSingle()

  const rules = data?.availability ?? []
  if (rules.length === 0) return { working_days: null, working_hours: null }

  const names = DAY_NAMES[language] ?? DAY_NAMES.ar
  const days = [...new Set(rules.map((r) => r.day))].sort((a, b) => a - b)

  // Collapse runs of consecutive days.
  const groups = []
  for (const day of days) {
    const last = groups.at(-1)
    if (last && day === last.at(-1) + 1) last.push(day)
    else groups.push([day])
  }

  const joiner = language === 'ar' ? ' إلى ' : ' to '
  const separator = language === 'ar' ? '، ' : ', '
  const working_days = groups
    .map((g) => (g.length > 1 ? names[g[0]] + joiner + names[g.at(-1)] : names[g[0]]))
    .join(separator)

  const starts = rules.map((r) => r.start).sort()
  const ends = rules.map((r) => r.end).sort()
  const from = starts[0]
  const to = ends.at(-1)
  const working_hours =
    language === 'ar' ? `من ${from} إلى ${to}` : `${from} to ${to}`

  return { working_days, working_hours }
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
