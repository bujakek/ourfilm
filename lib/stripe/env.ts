/**
 * Reads the Stripe credentials, failing with something you can act on.
 *
 * Same shape and same reasoning as `lib/supabase/env.ts`: a function rather
 * than module-level constants, so a missing key fails the request that needed
 * it instead of the build. That matters more here than there — Stripe is not
 * wired up yet, and every page in the product has to keep building and
 * rendering while it is not.
 *
 * None of these are `NEXT_PUBLIC_`. Checkout runs entirely server-side: the
 * session is created in a Server Action which redirects to Stripe's hosted
 * page, so the browser never needs a publishable key and never sees a card
 * number.
 */

export type StripeEnv = {
  secretKey: string
  webhookSecret: string
  /** HUF Price ID of the one-time per-event purchase. */
  eventPriceId: string
  /** USD Price ID of the one-time per-event purchase. */
  eventPriceUsdId: string
}

const KEYS = {
  secretKey: 'STRIPE_SECRET_KEY',
  webhookSecret: 'STRIPE_WEBHOOK_SECRET',
  eventPriceId: 'STRIPE_PRICE_EVENT',
  eventPriceUsdId: 'STRIPE_PRICE_EVENT_USD',
} as const

function read(): Partial<StripeEnv> {
  return {
    secretKey: process.env[KEYS.secretKey],
    webhookSecret: process.env[KEYS.webhookSecret],
    eventPriceId: process.env[KEYS.eventPriceId],
    eventPriceUsdId: process.env[KEYS.eventPriceUsdId],
  }
}

/**
 * Whether payments are switched on at all.
 *
 * There is no Stripe account yet, so this is `false` in every environment
 * today, and the UI has to stay honest about that rather than offering a
 * button that 500s. Once the account exists, filling in the three variables is
 * the entire switch — no code change.
 */
export function stripeIsConfigured(): boolean {
  const env = read()
  return Boolean(
    env.secretKey &&
    env.webhookSecret &&
    env.eventPriceId &&
    env.eventPriceUsdId,
  )
}

export function stripeEnv(): StripeEnv {
  const env = read()
  const missing = (Object.keys(KEYS) as (keyof StripeEnv)[])
    .filter((key) => !env[key])
    .map((key) => KEYS[key])

  if (missing.length > 0) {
    throw new Error(
      `Missing ${missing.join(', ')}. Create the Stripe account, then add ` +
        `these to .env.local and to the Vercel project. STRIPE_PRICE_EVENT ` +
        `and STRIPE_PRICE_EVENT_USD are Price IDs (price_…) of the one-time ` +
        `per-event product, not the Product ID (prod_…).`,
    )
  }

  return env as StripeEnv
}
