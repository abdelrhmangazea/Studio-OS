import { applyEvent } from '../_shared/billing/apply.ts'
import { provider } from '../_shared/billing/registry.ts'

/**
 * The webhook. NO JWT — the processor has none.
 *
 * That is exactly why it is a separate function from `billing`.
 * Mixing an unauthenticated route in with authenticated ones is how
 * an auth bypass gets shipped: one misplaced early-return and the
 * whole file is open.
 *
 * The signature IS the authentication. Verified before the body is
 * parsed, so an unverified payload is never even looked at.
 *
 * Deploy with --no-verify-jwt.
 */
Deno.serve(async (req) => {
  if (req.method !== 'POST') return new Response('method not allowed', { status: 405 })

  const signature = req.headers.get('stripe-signature') ?? req.headers.get('x-signature') ?? ''
  if (!signature) return new Response('missing signature', { status: 400 })

  // The RAW body. Reading it as JSON first and re-serialising would
  // change the bytes and break every signature check.
  const raw = await req.text()

  const billing = provider()
  const event = await billing.verifyAndParseWebhook(raw, signature)

  // null means the signature did not check out, or it is an event
  // type we do not act on. Either way: nothing is trusted, nothing
  // is written.
  if (!event) return new Response('rejected', { status: 400 })

  try {
    const outcome = await applyEvent(billing.name, event)
    // 200 for duplicates too — anything else and the processor
    // retries the same event forever.
    return new Response(JSON.stringify({ outcome }), {
      status: 200,
      headers: { 'content-type': 'application/json' },
    })
  } catch (caught) {
    console.error('[billing-webhook]', caught)
    // A real failure DOES deserve a retry.
    return new Response('could not apply', { status: 500 })
  }
})
