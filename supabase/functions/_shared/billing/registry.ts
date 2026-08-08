import type { BillingProvider } from './types.ts'
import { stripeProvider } from './stripe.ts'

/**
 * The only place adapters are named.
 *
 * Adding Paddle, Lemon Squeezy or Paymob: write the adapter next to
 * stripe.ts and add one line here. Nothing else in the repository
 * changes — not apply.ts, not either Edge Function, not a table, not
 * a line of frontend code.
 */
const ADAPTERS: Record<string, BillingProvider> = {
  stripe: stripeProvider,
}

export function provider(): BillingProvider {
  const name = Deno.env.get('BILLING_PROVIDER') ?? 'stripe'
  const found = ADAPTERS[name]
  if (!found) throw new Error(`no billing adapter called "${name}"`)
  return found
}
