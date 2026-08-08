/**
 * The billing interface.
 *
 * Nothing outside this folder knows which processor is in use. The
 * Edge Functions call these methods; apply.ts writes the database
 * from a NormalisedEvent. Neither imports a vendor SDK.
 *
 * ADDING A SECOND PROVIDER means writing one file next to stripe.ts
 * and adding one line to registry.ts. If it ever forces a change in
 * apply.ts or in either function, the abstraction was wrong and that
 * is worth saying out loud rather than patching around.
 */

/** The five things that can happen to a subscription, in our words. */
export type NormalisedEventType =
  | 'subscription.activated'
  | 'subscription.updated'
  | 'subscription.cancelled'
  | 'payment.succeeded'
  | 'payment.failed'

export type NormalisedStatus = 'active' | 'past_due' | 'cancelled'

export interface NormalisedEvent {
  /** The provider's own id. The idempotency key — see billing_events. */
  eventId: string
  type: NormalisedEventType
  /** Carried in provider metadata from checkout. Never taken from the browser. */
  workspaceId: string | null
  customerId: string | null
  subscriptionId: string | null
  planKey: string | null
  status: NormalisedStatus | null
  currentPeriodEnd: string | null
}

export interface NormalisedPrice {
  id: string
  /** Major units — 29 means 29 dollars, not 29 cents. */
  amount: number
  currency: string
  interval: 'month' | 'year' | null
}

export interface CheckoutRequest {
  workspaceId: string
  planKey: string
  period: 'monthly' | 'yearly'
  priceId: string
  customerEmail?: string
  existingCustomerId?: string | null
  successUrl: string
  cancelUrl: string
}

export interface BillingProvider {
  readonly name: string

  createCheckoutSession(req: CheckoutRequest): Promise<{ url: string }>
  createPortalSession(a: { customerId: string; returnUrl: string }): Promise<{ url: string }>

  cancelSubscription(subscriptionId: string): Promise<void>
  resumeSubscription(subscriptionId: string): Promise<void>
  changePlan(a: { subscriptionId: string; priceId: string }): Promise<void>

  /**
   * Verify FIRST, parse second. Returns null when the signature does
   * not check out — the caller rejects, and never sees a parsed body
   * it might be tempted to trust.
   */
  verifyAndParseWebhook(rawBody: string, signature: string): Promise<NormalisedEvent | null>

  /**
   * What the processor will ACTUALLY charge. The app computes yearly
   * as ten months; this is the number the customer's card sees. If
   * the two disagree, somebody is shown one price and charged
   * another — so a plan cannot be marked live until they match.
   */
  fetchPrice(priceId: string): Promise<NormalisedPrice | null>
}
