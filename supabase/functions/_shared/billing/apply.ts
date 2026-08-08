import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.48.1'
import type { NormalisedEvent } from './types.ts'

/**
 * A verified event becomes database state. Knows nothing about any
 * processor — it only ever sees a NormalisedEvent.
 *
 * Runs as the service role, which bypasses RLS. That is correct and
 * necessary: the webhook has no session and is not acting for a user.
 * It is also why this file writes ONLY to subscriptions and
 * billing_events, and touches nothing else.
 */
export function admin() {
  return createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
    { auth: { persistSession: false } },
  )
}

/**
 * @returns 'applied' | 'duplicate' | 'ignored'
 *
 * Stripe retries. It is documented behaviour, not an edge case, and
 * it will happen in the first week. The unique index on
 * (provider, event_id) is what makes a second delivery a no-op
 * instead of a second month — claim the id FIRST, and if the claim
 * finds nothing, stop before touching the subscription.
 */
export async function applyEvent(providerName: string, event: NormalisedEvent) {
  const db = admin()

  const { data: claimed, error: claimError } = await db
    .from('billing_events')
    .insert({
      provider: providerName,
      event_id: event.eventId,
      type: event.type,
      payload: event as unknown as Record<string, unknown>,
    })
    .select('id')
    .maybeSingle()

  // A conflict on the unique index is the duplicate case, and it is a
  // success: return 200 so the processor stops retrying. A 500 here
  // makes it retry forever.
  if (claimError && claimError.code === '23505') return 'duplicate'
  if (claimError) throw claimError
  if (!claimed) return 'duplicate'

  if (!event.workspaceId) return 'ignored'

  const patch: Record<string, unknown> = {
    provider: providerName,
    provider_customer_id: event.customerId,
    provider_subscription_id: event.subscriptionId,
  }

  if (event.planKey) patch.plan_key = event.planKey
  if (event.currentPeriodEnd) patch.current_period_end = event.currentPeriodEnd

  if (event.type === 'subscription.cancelled') {
    patch.status = 'cancelled'
    patch.cancelled_at = new Date().toISOString()
  } else if (event.type === 'payment.failed') {
    // Not cancelled. The period end still governs, so a card that
    // failed this morning does not lock somebody out of a client
    // meeting this afternoon.
    patch.status = 'past_due'
  } else if (event.status) {
    patch.status = event.status
  }

  const { error } = await db
    .from('subscriptions')
    .update(patch)
    .eq('workspace_id', event.workspaceId)

  if (error) throw error
  return 'applied'
}
