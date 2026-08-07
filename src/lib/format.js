/**
 * Dates, in the reader's language.
 *
 * Arabic uses the Gregorian calendar with Latin digits here on purpose:
 * these are working dates in a business tool, and mixing digit systems
 * across a table makes it harder to scan, not easier.
 *
 * Two things this file has to get right, both found by the Bucket 9
 * timezone check:
 *
 *  1. A CALENDAR DATE is not an instant. tasks.due_date and
 *     reminders.due_date are `date` columns — "2026-08-09" means that
 *     day, everywhere. Passing it to new Date() parses it as midnight
 *     UTC, and formatting that in a zone behind UTC shows the day
 *     before. So a plain date is formatted as written and never
 *     converted.
 *
 *  2. An INSTANT must be shown in the studio's timezone, not the
 *     reader's. A booking at 11:00 Cairo is one instant; a designer
 *     whose laptop is set to Dubai was seeing 12:00 and would have
 *     arrived an hour late. Anything showing a booking time passes
 *     the studio's timezone.
 */

const LOCALE = { ar: 'ar-EG-u-nu-latn', en: 'en-GB' }

/** "2026-08-09" — a calendar date, with no time and no zone. */
const PLAIN_DATE = /^\d{4}-\d{2}-\d{2}$/

export function formatDate(value, language, timeZone) {
  if (!value) return ''

  const options = { day: '2-digit', month: 'short', year: 'numeric' }

  // A plain date is rendered as the day it says. Reading it as UTC
  // midnight and converting would move it by one day for any reader
  // west of UTC.
  if (typeof value === 'string' && PLAIN_DATE.test(value)) {
    const [year, month, day] = value.split('-').map(Number)
    return new Intl.DateTimeFormat(LOCALE[language] ?? LOCALE.en, options)
      .format(new Date(year, month - 1, day))
  }

  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return ''

  return new Intl.DateTimeFormat(LOCALE[language] ?? LOCALE.en, {
    ...options,
    ...(timeZone ? { timeZone } : {}),
  }).format(date)
}

/**
 * @param timeZone  the STUDIO's timezone. Omit only where the moment is
 *                  an audit stamp ("uploaded 3 Aug 14:02") rather than
 *                  an appointment somebody has to turn up to.
 */
export function formatDateTime(value, language, timeZone) {
  if (!value) return ''
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return ''

  return new Intl.DateTimeFormat(LOCALE[language] ?? LOCALE.en, {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
    ...(timeZone ? { timeZone } : {}),
  }).format(date)
}
