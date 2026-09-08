import 'server-only'

import { headers } from 'next/headers'

/**
 * The origin the current request actually arrived on.
 *
 * Deliberately *not* `SITE_URL`, which is pinned to production so a QR card
 * printed on a laptop still points at ourfilm.app. Anything the user is sent
 * away to and comes back from — a magic link, a Stripe Checkout page — has to
 * return them to the origin they started on, or developing locally means being
 * bounced into production mid-flow.
 *
 * `x-forwarded-*` first because Vercel terminates TLS at the edge, so `host`
 * alone would be the internal one and the protocol would be guessed wrong.
 */
export async function requestOrigin(): Promise<string> {
  const h = await headers()
  const host = h.get('x-forwarded-host') ?? h.get('host')
  if (!host) return 'http://localhost:3000'
  const proto = h.get('x-forwarded-proto') ?? 'https'
  return `${proto}://${host}`
}
