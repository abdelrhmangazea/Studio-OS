import { isValidEmail, validatePhone } from './phone'

/** A blank lead. Everything except the first name is optional. */
export const EMPTY_CONTACT = {
  first_name: '',
  last_name: '',
  email: '',
  phone_country_code: '+20',
  phone_number: '',
  country: '',
  nationality: '',
  address: '',
  birthday: '',
  source_id: '',
  status_id: '',
  next_action_at: '',
}

/**
 * Returns { field: 'translation.key' } for anything that must be fixed
 * before saving. An empty object means the record is good to go.
 */
export function validateContact(form) {
  const errors = {}

  if (!String(form.first_name ?? '').trim()) {
    errors.first_name = 'validation.firstNameRequired'
  }

  const email = String(form.email ?? '').trim()
  if (email && !isValidEmail(email)) {
    errors.email = 'validation.emailInvalid'
  }

  const phoneError = validatePhone(form.phone_country_code, form.phone_number)
  if (phoneError) errors.phone = phoneError

  return errors
}

/**
 * Turns form state into a database row. Empty strings become null so
 * the database holds nothing rather than blanks — which keeps the
 * "is this set?" checks in later buckets honest.
 */
export function toContactRow(form) {
  const blankToNull = (value) => {
    const trimmed = String(value ?? '').trim()
    return trimmed === '' ? null : trimmed
  }

  return {
    first_name: String(form.first_name).trim(),
    last_name: blankToNull(form.last_name),
    email: blankToNull(form.email),
    phone_country_code: blankToNull(form.phone_country_code),
    phone_number: blankToNull(String(form.phone_number ?? '').replace(/\D/g, '')),
    country: blankToNull(form.country),
    nationality: blankToNull(form.nationality),
    address: blankToNull(form.address),
    birthday: blankToNull(form.birthday),
    source_id: blankToNull(form.source_id),
    status_id: blankToNull(form.status_id),
    next_action_at: blankToNull(form.next_action_at),
  }
}

/** Database row back into form state, with nulls as empty strings. */
export function toContactForm(contact) {
  if (!contact) return { ...EMPTY_CONTACT }
  const text = (value) => value ?? ''

  return {
    first_name: text(contact.first_name),
    last_name: text(contact.last_name),
    email: text(contact.email),
    phone_country_code: text(contact.phone_country_code) || '+20',
    phone_number: text(contact.phone_number),
    country: text(contact.country),
    nationality: text(contact.nationality),
    address: text(contact.address),
    birthday: text(contact.birthday),
    source_id: text(contact.source_id),
    status_id: text(contact.status_id),
    next_action_at: text(contact.next_action_at),
  }
}
