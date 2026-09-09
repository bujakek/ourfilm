/**
 * Reads the Stripe credentials, failing with something you can act on.
 *
 * Same shape and same reasoning as `lib/supabase/env.ts`: a function rather
 * than module-level constants, so a missing key fails the request that needed
 * it instead of the build. That matters more here than there — a Preview
 * deployment without Stripe keys still has to build and render every page
 * in the product, with only the checkout offer switched off.
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

/**
 * A live secret key is only ever legitimate on Vercel Production.
 *
 * Nothing else in the product distinguishes a deployment from a preview —
 * `stripeIsConfigured()` asks whether the keys are present, not where it is
 * running — so a live key scoped to "Production and Preview" makes every
 * preview URL of every branch able to charge a real card. Worse than it
 * sounds: Stripe's webhook endpoint points at ourfilm.app, so a preview
 * charge is never reported back, and the money moves with no `paid` row, no
 * album unlocked and no invoice issued.
 *
 * Refused only when `VERCEL_ENV` positively says this is not production. An
 * unset `VERCEL_ENV` (a local machine, CI) is left alone deliberately: the
 * failure mode of guessing wrong in that direction is production silently
 * unable to take money, which is far worse than the case this prevents.
 */
function liveKeyOutsideProduction(secretKey: string | undefined): boolean {
  if (!secretKey?.startsWith('sk_live_')) return false
  const vercelEnv = process.env.VERCEL_ENV
  return Boolean(vercelEnv) && vercelEnv !== 'production'
}

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
 * Live keys are set on Vercel Production and test keys locally; an
 * environment without all four gets no checkout button rather than one that
 * 500s. Filling in the variables is the entire switch — no code change.
 */
export function stripeIsConfigured(): boolean {
  const env = read()
  if (liveKeyOutsideProduction(env.secretKey)) return false
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

  if (liveKeyOutsideProduction(env.secretKey)) {
    throw new Error(
      `Refusing a live STRIPE_SECRET_KEY on VERCEL_ENV=${process.env.VERCEL_ENV}. ` +
        'Scope the live key to Production only and give Preview a sk_test_ ' +
        'key: Stripe delivers webhooks to the production URL, so a charge ' +
        'taken from a preview is never reported back and leaves money moved ' +
        'with no paid purchase, no unlocked album and no invoice.',
    )
  }

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
