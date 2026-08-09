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
  // --- the write guards, FIRST ---
  //
  // The database refuses a write by raising a tagged string:
  // READ_ONLY / LIMIT_REACHED / FEATURE_LOCKED / TEMPLATE_LOCKED.
  // planLimits.js parses these for the screens that show a rich
  // notice, but every OTHER screen goes through this function — and
  // none of these matched, so a viewer clicking "save for client" was
  // told "something went wrong, try again". She had no permission and
  // no amount of trying again was going to change that.
  //
  // These sit above the generic database patterns on purpose: a
  // READ_ONLY refusal is also technically a permission error, and the
  // specific message is the useful one.
  [/READ_ONLY:/, 'errors.readOnly'],
  [/LIMIT_REACHED:/, 'errors.limitReached'],
  [/FEATURE_LOCKED:/, 'errors.featureLocked'],
  [/TEMPLATE_LOCKED:/, 'errors.templateLocked'],

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

/* ------------------------------------------------------------------
 * The two public pages
 *
 * The booking page and the client portal are not inside the app's
 * language provider — they render in whichever language the studio
 * chose, using a local t(ar, en). So they cannot call errorMessage(),
 * which needs a dictionary lookup.
 *
 * These are also the pages where a raw English Postgres sentence is
 * worst: the reader is the studio's client, not a designer, and they
 * have no idea what "exclusion_violation" or "too many requests"
 * means. Every message the public RPCs can raise is listed here.
 * ------------------------------------------------------------------ */

const PUBLIC_PATTERNS = [
  [/too many requests|rate limit/i, {
    ar: 'محاولات كتير في وقت قصير. استنى شوية وحاول تاني.',
    en: 'Too many attempts in a short time. Please wait a moment and try again.',
  }],
  [/just booked by someone else/i, {
    ar: 'للأسف الموعد ده اتحجز توّه. اختر وقتاً آخر.',
    en: 'That time was just taken. Please choose another.',
  }],
  [/time is not available/i, {
    ar: 'الموعد ده مش متاح. اختر وقتاً آخر.',
    en: 'That time is not available. Please choose another.',
  }],
  [/booking page is not available|session type is not available/i, {
    ar: 'صفحة الحجز دي مش متاحة حالياً.',
    en: 'This booking page is not available right now.',
  }],
  [/no longer active/i, {
    ar: 'الرابط ده لم يعد صالحاً.',
    en: 'This link is no longer active.',
  }],
  [/describe the change/i, {
    ar: 'من فضلك اكتب التعديل المطلوب قبل الإرسال.',
    en: 'Please describe the change you would like before sending.',
  }],
  [/no invoice to pay yet/i, {
    ar: 'مفيش فاتورة للدفع لسه.',
    en: 'There is no invoice to pay yet.',
  }],
  [/a name is required/i, {
    ar: 'الاسم مطلوب.',
    en: 'Please enter your name.',
  }],
  [/does not belong to|not part of this project|that question does not take/i, {
    ar: 'الملف ده مش تابع للطلب ده.',
    en: 'That file does not belong to this request.',
  }],
  [/payload too large|exceeded the maximum/i, {
    ar: 'الملف أكبر من الحد المسموح.',
    en: 'That file is larger than the limit.',
  }],
  [/mime type|not supported/i, {
    ar: 'نوع الملف ده غير مدعوم.',
    en: 'That file type is not supported.',
  }],
  [/failed to fetch|networkerror|load failed/i, {
    ar: 'مفيش اتصال بالإنترنت. راجع الشبكة وحاول تاني.',
    en: 'No connection. Check your network and try again.',
  }],
]

const PUBLIC_GENERIC = {
  ar: 'حصل خطأ. حاول تاني، ولو استمر تواصل مع الاستوديو.',
  en: 'Something went wrong. Please try again, or contact the studio.',
}

/**
 * @param failure  whatever was caught
 * @param rtl      true when the page is rendering in Arabic
 */
export function publicErrorMessage(failure, rtl) {
  const raw = String(rawTextOf(failure) ?? '')

  if (failure) {
    // eslint-disable-next-line no-console
    console.error('[studio-os]', failure)
  }

  for (const [pattern, pair] of PUBLIC_PATTERNS) {
    if (pattern.test(raw)) return rtl ? pair.ar : pair.en
  }

  return rtl ? PUBLIC_GENERIC.ar : PUBLIC_GENERIC.en
}
