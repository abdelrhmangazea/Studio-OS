import { supabase } from './supabase'

/**
 * Reading an emailed auth link — confirmation, recovery, email change.
 *
 * WHY THIS FILE EXISTS
 *
 * Two screens used to do this with `setTimeout(800)` then getSession().
 * That is a guess, and it is wrong in three ways:
 *
 *   1. It handles ONE of the shapes a link can arrive in. GoTrue sends
 *      the session in the URL fragment (implicit flow, our default),
 *      but also emits ?code= (PKCE) and ?token_hash=&type= depending
 *      on template and settings. The other two silently did nothing.
 *   2. It reports every failure as "expired". A link that failed
 *      because the redirect was not allow-listed, or because it was
 *      already used, is not expired, and telling somebody to request
 *      a new one sends them round the same loop forever.
 *   3. 800ms is a guess. On a slow connection the exchange has not
 *      finished; on a fast one it finished 700ms ago.
 *
 * So: read whatever shape arrived, say what actually went wrong, and
 * wait on the real signal rather than a timer.
 */

/** localhost or 127.0.0.1 — the symptom of an unset Site URL. */
export function landedOnLocalhost() {
  return ['localhost', '127.0.0.1', '0.0.0.0'].includes(window.location.hostname)
}

/**
 * Is this a recovery link that landed somewhere other than the reset
 * screen?
 *
 * This is the actual failure people hit. When Supabase rejects a
 * redirect_to that is not allow-listed, it falls back to the project's
 * Site URL — and the fallback is the BARE origin. The /auth/reset path
 * is thrown away, the token fragment is kept. So the link opens the
 * app at "/" carrying a valid recovery token, the client picks it up,
 * signs the person in, and drops them on the dashboard. They never see
 * a password field, and nothing anywhere says why.
 *
 * Catching it here means the reset flow still works even while the
 * dashboard setting is wrong.
 */
export function isStrandedRecoveryLink() {
  const hash = new URLSearchParams(window.location.hash.replace(/^#/, ''))
  const query = new URLSearchParams(window.location.search)
  const type = hash.get('type') ?? query.get('type')

  return type === 'recovery' && window.location.pathname !== '/auth/reset'
}

/** GoTrue reports failures in the URL, not as a thrown error. */
function linkFailure() {
  const hash = new URLSearchParams(window.location.hash.replace(/^#/, ''))
  const query = new URLSearchParams(window.location.search)
  const pick = (key) => hash.get(key) ?? query.get(key)

  const code = pick('error_code') || pick('error')
  if (!code) return null

  return { code, description: pick('error_description') || code }
}

/**
 * @returns {{ session: object|null, failure: {code, description}|null }}
 */
export async function consumeAuthLink() {
  const failure = linkFailure()
  if (failure) return { session: null, failure }

  const query = new URLSearchParams(window.location.search)
  const hash = new URLSearchParams(window.location.hash.replace(/^#/, ''))

  // --- PKCE: ?code=... ---
  const code = query.get('code')
  if (code) {
    const { data, error } = await supabase.auth.exchangeCodeForSession(code)
    if (error) return { session: null, failure: { code: error.code ?? 'exchange_failed', description: error.message } }
    return { session: data?.session ?? null, failure: null }
  }

  // --- Hashed token: ?token_hash=...&type=recovery ---
  const tokenHash = query.get('token_hash') ?? hash.get('token_hash')
  const type = query.get('type') ?? hash.get('type')
  if (tokenHash && type) {
    const { data, error } = await supabase.auth.verifyOtp({ token_hash: tokenHash, type })
    if (error) return { session: null, failure: { code: error.code ?? 'verify_failed', description: error.message } }
    return { session: data?.session ?? null, failure: null }
  }

  // --- Implicit: #access_token=... ---
  // detectSessionInUrl is on, so the client consumes this itself. Wait
  // for it to land rather than guessing how long that takes.
  const deadline = Date.now() + 4000
  for (;;) {
    const { data } = await supabase.auth.getSession()
    if (data?.session) return { session: data.session, failure: null }
    if (Date.now() > deadline) break
    await new Promise((resolve) => setTimeout(resolve, 120))
  }

  return { session: null, failure: { code: 'no_session', description: 'no session in link' } }
}
