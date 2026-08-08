import Stripe from 'https://esm.sh/stripe@17.5.0?target=deno'
import type {
  BillingProvider,
  CheckoutRequest,
  NormalisedEvent,
  NormalisedEventType,
  NormalisedPrice,
  NormalisedStatus,
} from './types.ts'

/**
 * THE ONLY FILE IN THIS REPOSITORY THAT IMPORTS STRIPE.
 *
 * Everything it knows about Stripe stops here. The rest of the
 * system sees NormalisedEvent and nothing else.
 */

const secret = Deno.env.get('STRIPE_SECRET_KEY') ?? ''
const webhookSecret = Deno.env.get('STRIPE_WEBHOOK_SECRET') ?? ''

const stripe = new Stripe(secret, {
  apiVersion: '2024-12-18.acacia',
  // Deno has no Node crypto. Without this the SDK throws on startup
  // rather than on first use, which is a confusing way to find out.
  httpClient: Stripe.createFetchHttpClient(),
})

/** Stripe's vocabulary → ours. Anything unmapped is ignored, not guessed at. */
const EVENT_MAP: Record<string, NormalisedEventType> = {
  'checkout.session.completed': 'subscription.activated',
  'customer.subscription.created': 'subscription.activated',
  'customer.subscription.updated': 'subscription.updated',
  'customer.subscription.deleted': 'subscription.cancelled',
  'invoice.payment_succeeded': 'payment.succeeded',
  'invoice.payment_failed': 'payment.failed',
}

const STATUS_MAP: Record<string, NormalisedStatus> = {
  active: 'active',
  trialing: 'active',
  past_due: 'past_due',
  unpaid: 'past_due',
  canceled: 'cancelled',
  incomplete_expired: 'cancelled',
}

export const stripeProvider: BillingProvider = {
  name: 'stripe',

  async createCheckoutSession(req: CheckoutRequest) {
    const session = await stripe.checkout.sessions.create({
      mode: 'subscription',
      line_items: [{ price: req.priceId, quantity: 1 }],
      success_url: req.successUrl,
      cancel_url: req.cancelUrl,
      customer: req.existingCustomerId ?? undefined,
      customer_email: req.existingCustomerId ? undefined : req.customerEmail,
      // The workspace travels with the session and comes back on the
      // webhook. This is the ONLY way the workspace is identified —
      // never from a query string on the return URL, which the person
      // being charged can edit.
      metadata: { workspace_id: req.workspaceId, plan_key: req.planKey },
      subscription_data: {
        metadata: { workspace_id: req.workspaceId, plan_key: req.planKey },
      },
    })

    if (!session.url) throw new Error('stripe returned no checkout url')
    return { url: session.url }
  },

  async createPortalSession({ customerId, returnUrl }) {
    const session = await stripe.billingPortal.sessions.create({
      customer: customerId,
      return_url: returnUrl,
    })
    return { url: session.url }
  },

  async cancelSubscription(subscriptionId) {
    // At period end, not immediately. Somebody who cancels on day 3
    // of a month they paid for keeps the rest of it.
    await stripe.subscriptions.update(subscriptionId, { cancel_at_period_end: true })
  },

  async resumeSubscription(subscriptionId) {
    await stripe.subscriptions.update(subscriptionId, { cancel_at_period_end: false })
  },

  async changePlan({ subscriptionId, priceId }) {
    const current = await stripe.subscriptions.retrieve(subscriptionId)
    const item = current.items.data[0]
    await stripe.subscriptions.update(subscriptionId, {
      items: [{ id: item.id, price: priceId }],
      proration_behavior: 'create_prorations',
    })
  },

  async verifyAndParseWebhook(rawBody, signature) {
    let event: Stripe.Event
    try {
      // constructEventAsync, not constructEvent: Deno's crypto is
      // async-only and the sync version throws here.
      event = await stripe.webhooks.constructEventAsync(rawBody, signature, webhookSecret)
    } catch {
      // Bad signature, wrong secret, replayed payload with a stale
      // timestamp. All of them mean: do not trust this, do not parse it.
      return null
    }

    const type = EVENT_MAP[event.type]
    if (!type) return null

    const object = event.data.object as Record<string, unknown>

    // A subscription arrives on some events and an invoice on others.
    // Pull the same facts out of either shape.
    const subscriptionId =
      (object.id && event.type.startsWith('customer.subscription') ? object.id : null) ??
      object.subscription ??
      null

    const metadata = (object.metadata ?? {}) as Record<string, string>
    const rawStatus = object.status as string | undefined
    const periodEnd = object.current_period_end as number | undefined

    return {
      eventId: event.id,
      type,
      workspaceId: metadata.workspace_id ?? null,
      customerId: (object.customer as string) ?? null,
      subscriptionId: (subscriptionId as string) ?? null,
      planKey: metadata.plan_key ?? null,
      status: rawStatus ? (STATUS_MAP[rawStatus] ?? null) : null,
      currentPeriodEnd: periodEnd ? new Date(periodEnd * 1000).toISOString() : null,
    }
  },

  async fetchPrice(priceId): Promise<NormalisedPrice | null> {
    try {
      const price = await stripe.prices.retrieve(priceId)
      return {
        id: price.id,
        // Stripe holds minor units. Everything above this line works
        // in whole currency, so the conversion happens here and only
        // here.
        amount: (price.unit_amount ?? 0) / 100,
        currency: (price.currency ?? 'usd').toUpperCase(),
        interval: (price.recurring?.interval as 'month' | 'year' | undefined) ?? null,
      }
    } catch {
      return null
    }
  },
}
