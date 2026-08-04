import { COUNTRIES } from '../data/countries'

/**
 * Phone numbers are stored as two columns: a real international dialing
 * code (+20) and the national part as digits only. Never as one blob.
 *
 * Validation deliberately checks the dialing code hard and the number
 * loosely: the code must be one this app knows about, the number must be
 * digits of a plausible length. Full per-country numbering rules would
 * mean shipping a large library to reject numbers that are usually fine.
 */

const VALID_DIAL_CODES = new Set(COUNTRIES.map((country) => country.dial))

/** Strips spaces, dashes and brackets — anything that is not a digit. */
export function digitsOnly(value) {
  return String(value ?? '').replace(/\D/g, '')
}

export function isValidDialCode(code) {
  return VALID_DIAL_CODES.has(String(code ?? '').trim())
}

/**
 * Returns null when the phone is fine, or a translation key describing
 * what is wrong. An entirely empty phone is allowed — a lead captured
 * from Instagram may only have a handle at first.
 */
export function validatePhone(code, number) {
  const digits = digitsOnly(number)
  const trimmedCode = String(code ?? '').trim()

  if (!trimmedCode && !digits) return null

  if (!trimmedCode) return 'validation.phoneCodeMissing'
  if (!isValidDialCode(trimmedCode)) return 'validation.phoneCodeInvalid'
  if (!digits) return 'validation.phoneNumberMissing'
  if (digits.length < 6 || digits.length > 14) return 'validation.phoneNumberInvalid'

  return null
}

/**
 * "+20", "1066792806"  ->  "+20 106 679 2806"
 *
 * Groups of three from the left; a lone trailing digit joins the group
 * before it, which is what produces the familiar 3-3-4 shape.
 */
export function formatPhone(code, number) {
  const digits = digitsOnly(number)
  if (!digits) return ''

  const groups = []
  for (let i = 0; i < digits.length; i += 3) groups.push(digits.slice(i, i + 3))

  if (groups.length > 1 && groups[groups.length - 1].length === 1) {
    const stray = groups.pop()
    groups[groups.length - 1] += stray
  }

  const national = groups.join(' ')
  return code ? `${code} ${national}` : national
}

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export function isValidEmail(value) {
  return EMAIL_PATTERN.test(String(value ?? '').trim())
}

/**
 * Whole days since a timestamp. Used for the "days since last contact"
 * column, which falls back to the date the lead was added — a lead
 * nobody has ever called is the most urgent kind, so it must not read
 * as a blank.
 */
export function daysSince(timestamp) {
  if (!timestamp) return null
  const then = new Date(timestamp)
  if (Number.isNaN(then.getTime())) return null
  return Math.floor((Date.now() - then.getTime()) / 86400000)
}

/** Grey under a week, orange after 7 days, red after 14. */
export function stalenessColor(days) {
  if (days === null) return 'text-text-secondary'
  if (days >= 14) return 'text-danger'
  if (days >= 7) return 'text-warning'
  return 'text-text-secondary'
}
