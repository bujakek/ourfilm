import 'server-only'

import { billingoIsConfigured } from '@/lib/billingo/env'
import { stripeIsConfigured } from '@/lib/stripe/env'

/** A real payment may start only when it can also be invoiced. */
export function checkoutIsConfigured(): boolean {
  return stripeIsConfigured() && billingoIsConfigured()
}
