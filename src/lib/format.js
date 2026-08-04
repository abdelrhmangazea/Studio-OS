/**
 * Dates, in the reader's language.
 *
 * Arabic uses the Gregorian calendar with Latin digits here on purpose:
 * these are working dates in a business tool, and mixing digit systems
 * across a table makes it harder to scan, not easier.
 */

const LOCALE = { ar: 'ar-EG-u-nu-latn', en: 'en-GB' }

export function formatDate(value, language) {
  if (!value) return ''
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return ''

  return new Intl.DateTimeFormat(LOCALE[language] ?? LOCALE.en, {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  }).format(date)
}

export function formatDateTime(value, language) {
  if (!value) return ''
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return ''

  return new Intl.DateTimeFormat(LOCALE[language] ?? LOCALE.en, {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date)
}
