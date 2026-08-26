import { formatHuf, legalConfig } from '@/lib/legal/config'

/**
 * What one event costs, as a host reads it.
 *
 * The authoritative amount is the Stripe Price (`STRIPE_PRICE_EVENT`); this is
 * only the label. The figure itself now comes from `legalConfig.service`,
 * which is also what the ÁSZF's section 6 prints — a product screen and a
 * contract quoting two different prices is the one disagreement that is
 * genuinely expensive, and it can no longer happen.
 *
 * Client-safe on purpose. `lib/billing.ts` is `server-only` (it reads the
 * database), and both of the components that need this line are client
 * components.
 *
 * If the Price in Stripe changes, this changes with it. Nothing derives one
 * from the other: reading the Price over the API to render a label would put a
 * network call on a screen that must work offline in a venue.
 */
export const EVENT_PRICE_LABEL = formatHuf(legalConfig.service.priceHuf)
