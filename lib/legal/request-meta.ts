import 'server-only'

import { createHash } from 'node:crypto'
import { headers } from 'next/headers'

/**
 * The evidence metadata a legal declaration carries, and nothing more.
 *
 * A withdrawal declaration and a content report both have to be attributable
 * — "when did this arrive, and did it come from one person or from a script" —
 * without turning either form into an identity collection exercise. So two
 * fields: a salted hash of the client address, and the user agent string.
 *
 * **The address is never stored.** A hash is enough to rate-limit and enough
 * to show a pattern of abuse; the address itself would be a personal datum
 * kept for years in a table whose whole purpose is to be produced in a
 * dispute. The salt is what stops the hash being reversible by trying four
 * billion candidates, which an unsalted IPv4 hash trivially is.
 */

const MAX_USER_AGENT = 400

export type RequestMeta = {
  ipHash: string | null
  userAgent: string | null
}

/**
 * Per-deployment salt.
 *
 * Without it the hashes are still not addresses, but they are enumerable — so
 * `LEGAL_IP_SALT` is a launch blocker rather than an optimisation. The
 * fallback keeps development working rather than making every form throw.
 */
function ipSalt(): string {
  return process.env.LEGAL_IP_SALT ?? 'ourfilm-dev-unsalted'
}

/** First entry of `x-forwarded-for`, which on Vercel is the real client. */
function clientAddress(forwardedFor: string | null, realIp: string | null) {
  const first = forwardedFor?.split(',')[0]?.trim()
  return first || realIp?.trim() || null
}

export async function readRequestMeta(): Promise<RequestMeta> {
  const store = await headers()
  const address = clientAddress(
    store.get('x-forwarded-for'),
    store.get('x-real-ip'),
  )
  const userAgent = store.get('user-agent')

  return {
    ipHash: address
      ? createHash('sha256').update(`${ipSalt()}:${address}`).digest('hex')
      : null,
    userAgent: userAgent ? userAgent.slice(0, MAX_USER_AGENT) : null,
  }
}
