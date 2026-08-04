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
export async function resolveAutoFields({ contact, settings, profile, language }) {
  const contractSentAt = contact ? await findContractSentDate(contact.id) : null

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
    currency: settings?.currency ?? null,
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

    // Everything below needs projects, bookings or portal links, which
    // are Buckets 4-6. Explicitly null so they render as [[markers]]
    // rather than silently disappearing.
    project_name: null,
    project_code: null,
    project_description: null,
    project_type: null,
    property_address: null,
    consultation_date: null,
    consultation_time: null,
    consultation_mode: null,
    consultation_duration: null,
    consultation_type: null,
    booking_link: null,
    portal_link: null,
  }

  return values
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
