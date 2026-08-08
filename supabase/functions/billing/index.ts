import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.48.1'
import { admin } from '../_shared/billing/apply.ts'
import { provider } from '../_shared/billing/registry.ts'

/**
 * Checkout, the customer portal, cancel, resume, change plan.
 *
 * JWT REQUIRED on every route. The caller's identity comes from
 * their token and the workspace is read from their profile — never
 * from the request body, which they control.
 *
 * Nothing here writes a plan. Checkout returns a URL; the database
 * changes when the webhook says the money moved, and not before.
 */
const cors = {
  'access-control-allow-origin': Deno.env.get('APP_URL') ?? '*',
  'access-control-allow-headers': 'authorization, content-type',
  'access-control-allow-methods': 'POST, OPTIONS',
}

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...cors, 'content-type': 'application/json' },
  })

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })
  if (req.method !== 'POST') return json({ error: 'method not allowed' }, 405)

  const auth = req.headers.get('Authorization') ?? ''
  if (!auth.startsWith('Bearer ')) return json({ error: 'not signed in' }, 401)

  // Who is calling — established from their token, by Supabase.
  const asUser = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_ANON_KEY') ?? '',
    { global: { headers: { Authorization: auth } }, auth: { persistSession: false } },
  )

  const { data: userData } = await asUser.auth.getUser()
  const user = userData?.user
  if (!user) return json({ error: 'not signed in' }, 401)

  const db = admin()

  const { data: profile } = await db
    .from('profiles')
    .select('workspace_id, role')
    .eq('id', user.id)
    .maybeSingle()

  if (!profile) return json({ error: 'no workspace' }, 403)
  // Billing is an owner action. A member with a token cannot change
  // what the studio pays.
  if (profile.role !== 'owner') return json({ error: 'owner only' }, 403)

  const workspaceId = profile.workspace_id
  const { action, planKey, period } = await req.json().catch(() => ({}))
  const billing = provider()
  const appUrl = Deno.env.get('APP_URL') ?? ''

  const { data: sub } = await db
    .from('subscriptions')
    .select('provider_customer_id, provider_subscription_id')
    .eq('workspace_id', workspaceId)
    .maybeSingle()

  try {
    if (action === 'checkout') {
      const { data: plan } = await db
        .from('plans')
        .select('*')
        .eq('key', planKey)
        .maybeSingle()

      if (!plan) return json({ error: 'unknown plan' }, 400)
      // A plan whose displayed price has not been reconciled with the
      // processor cannot be sold. See admin_price_check.
      if (!plan.is_live) return json({ error: 'plan is not available yet' }, 400)

      const priceId =
        period === 'yearly' ? plan.provider_price_yearly : plan.provider_price_monthly
      if (!priceId) return json({ error: 'no price configured' }, 400)

      const { url } = await billing.createCheckoutSession({
        workspaceId,
        planKey,
        period: period === 'yearly' ? 'yearly' : 'monthly',
        priceId,
        customerEmail: user.email ?? undefined,
        existingCustomerId: sub?.provider_customer_id ?? null,
        // The return page reads nothing and writes nothing. It waits
        // for the webhook.
        successUrl: `${appUrl}/settings?checkout=done#subscription`,
        cancelUrl: `${appUrl}/settings?checkout=cancelled#subscription`,
      })
      return json({ url })
    }

    if (action === 'portal') {
      if (!sub?.provider_customer_id) return json({ error: 'no billing account yet' }, 400)
      const { url } = await billing.createPortalSession({
        customerId: sub.provider_customer_id,
        returnUrl: `${appUrl}/settings#subscription`,
      })
      return json({ url })
    }

    if (action === 'cancel' || action === 'resume') {
      if (!sub?.provider_subscription_id) return json({ error: 'nothing to change' }, 400)
      if (action === 'cancel') await billing.cancelSubscription(sub.provider_subscription_id)
      else await billing.resumeSubscription(sub.provider_subscription_id)
      // Deliberately NOT writing the status here. The webhook does
      // that, so there is one source of truth rather than two that
      // can disagree.
      return json({ ok: true, note: 'the change lands when the webhook confirms it' })
    }

    return json({ error: 'unknown action' }, 400)
  } catch (caught) {
    console.error('[billing]', caught)
    return json({ error: 'billing request failed' }, 500)
  }
})
