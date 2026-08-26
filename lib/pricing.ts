/**
 * What one event costs, as a host reads it.
 *
 * The authoritative amount is the Stripe Price (`STRIPE_PRICE_EVENT`) — this is
 * only the label, and it is a constant rather than two string literals because
 * it now appears in two places: the billing card in settings and the plan
 * choice on the last onboarding screen. A price that disagrees with itself
 * across two screens of the same product is worse than either number.
 *
 * Client-safe on purpose. `lib/billing.ts` is `server-only` (it reads the
 * database), and both of the components that need this line are client
 * components.
 *
 * If the Price in Stripe changes, this changes with it. Nothing derives one
 * from the other: reading the Price over the API to render a label would put a
 * network call on a screen that must work offline in a venue.
 */
export const EVENT_PRICE_LABEL = '12 900 Ft'
