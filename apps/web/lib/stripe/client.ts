import 'server-only'

import Stripe from 'stripe'

import { stripeEnv } from './env'

/**
 * The Stripe client.
 *
 * The API version is pinned rather than left to the account default. An
 * unpinned client silently changes behaviour the day someone flips the version
 * in the Stripe dashboard, and pinning it in code means a `pnpm up stripe`
 * that moves the default shows up here as a type error — which is exactly when
 * you want to be reading the changelog, rather than the first time a webhook
 * arrives in a shape the handler did not expect.
 *
 * Cached across invocations: Fluid Compute reuses function instances, so a
 * fresh client per request would rebuild the same HTTP agent for nothing.
 */
let cached: Stripe | null = null

export function getStripe(): Stripe {
  if (cached) return cached
  cached = new Stripe(stripeEnv().secretKey, {
    apiVersion: '2026-07-29.dahlia',
    // Shows up in the Stripe dashboard's request log beside each call, which
    // is the difference between "something charged this card" and "the event
    // checkout action did".
    appInfo: { name: 'OurFilm', url: 'https://ourfilm.app' },
  })
  return cached
}
