/**
 * Turns anything a failure can be into one readable sentence.
 *
 * Three things go wrong without this, and all three happened here:
 *
 *   1. Supabase Auth returns its text in `msg`, PostgREST in `message`,
 *      and a network failure in neither. Reading only `.message` gives
 *      undefined, and `undefined || fallback` silently swallows the
 *      real cause.
 *   2. An error OBJECT reaches JSX and React renders it as `{}` — which
 *      is exactly what the signup screen was showing.
 *   3. A raw Postgres string reaches a designer: "new row violates
 *      row-level security policy for table objects" means nothing to
 *      anyone outside this codebase.
 *
 * So: recognise what we can and say it plainly; for anything else show
 * one generic sentence and put the detail in the console, where it is
 * useful to us and invisible to them.
 */

const PATTERNS = [
  // --- auth ---
  [/email.*not confirmed|not confirmed|confirm your email/i, 'errors.emailNotConfirmed'],
  [/invalid login credentials/i, 'errors.badCredentials'],
  [/already registered|already been registered/i, 'errors.emailTaken'],
  [/password should be at least|password.*too short/i, 'errors.passwordTooShort'],
  [/error sending.*email|smtp/i, 'errors.mailNotSent'],
  [/rate limit|too many requests/i, 'errors.tooManyAttempts'],
  [/token has expired|invalid.*token|otp_expired|expired/i, 'errors.linkExpired'],
  [/jwt expired|session.*expired/i, 'errors.sessionExpired'],

  // --- database ---
  [/row-level security/i, 'errors.notYours'],
  [/duplicate key|already exists|unique constraint/i, 'errors.duplicate'],
  [/violates foreign key|still referenced/i, 'errors.inUse'],
  [/violates check constraint/i, 'errors.invalidValue'],
  [/permission denied/i, 'errors.notAllowed'],

  // --- network / storage ---
  [/failed to fetch|networkerror|load failed/i, 'errors.offline'],
  [/payload too large|exceeded the maximum/i, 'errors.fileTooBig'],
  [/mime type|not supported/i, 'errors.fileType'],
]

/** Every place an error might be hiding its text. */
function rawTextOf(failure) {
  if (!failure) return ''
  if (typeof failure === 'string') return failure

  return (
    failure.msg ??
    failure.message ??
    failure.error_description ??
    failure.error ??
    failure.details ??
    failure.hint ??
    ''
  )
}

/**
 * @param failure  whatever was caught
 * @param t        the translator
 * @param fallback key used when nothing matches
 */
export function errorMessage(failure, t, fallback = 'errors.generic') {
  const raw = String(rawTextOf(failure) ?? '')

  // Keep the real thing where a developer can find it. It never
  // reaches the screen.
  if (failure) {
    // eslint-disable-next-line no-console
    console.error('[studio-os]', failure)
  }

  for (const [pattern, key] of PATTERNS) {
    if (pattern.test(raw)) return t(key)
  }

  return t(fallback)
}

/**
 * Guarantees a string reaches JSX.
 *
 * Anything that is not already a string becomes the generic sentence,
 * so an error object can never be rendered as {} again.
 */
export function safeText(value, t) {
  if (typeof value === 'string') return value
  if (!value) return ''
  return errorMessage(value, t)
}
