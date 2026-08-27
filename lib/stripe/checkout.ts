import 'server-only'

import type { BillingDetails } from '@/lib/billing-details'
import { LEGAL_VERSION } from '@/lib/company'
import { requestOrigin } from '@/lib/request-origin'
import { createClient } from '@/lib/supabase/server'
import { randomUUID } from 'node:crypto'

import { getStripe } from './client'
import { stripeEnv } from './env'

/**
 * Creates one Checkout Session for one event and returns the URL to send the
 * host to.
 *
 * Shared by the two places a host can start paying: the billing card in
 * settings, and the plan choice on the last onboarding screen. It lives here
 * rather than in either of them because everything it sets is the kind of
 * detail that is silently wrong when it drifts — which metadata the webhook
 * reads, which URL Stripe returns to, whether the PaymentIntent carries the
 * event id a refund would otherwise have no route back from.
 *
 * Callers own the guards. This does not check whether payments are configured
 * or whether the event is already unlimited: those refusals have different
 * wording and a different destination depending on where the host is standing.
 */
export async function createEventCheckoutUrl({
  eventId,
  slug,
  ownerId,
  billingDetails,
}: {
  eventId: string
  slug: string
  ownerId: string
  billingDetails: BillingDetails
}): Promise<string> {
  const origin = await requestOrigin()
  const purchaseId = randomUUID()
  const acceptedAt = new Date().toISOString()

  const session = await getStripe().checkout.sessions.create({
    mode: 'payment',
    line_items: [{ price: stripeEnv().eventPriceId, quantity: 1 }],
    // Back to the settings page rather than the event page: the billing card
    // that explains the outcome lives there. That holds for a host arriving
    // straight from onboarding too — the sentence they need after paying is
    // "this album is unlimited", not the QR code.
    success_url: `${origin}/host/events/${slug}/settings?checkout=success`,
    cancel_url: `${origin}/host/events/${slug}/settings?checkout=cancelled`,
    // Both, and not by accident. `metadata` is what the webhook reads;
    // `client_reference_id` is what shows up in the Stripe dashboard's search,
    // which is where you will be looking at 2am when a host says they paid and
    // the album is still capped.
    client_reference_id: eventId,
    metadata: {
      event_id: eventId,
      owner_id: ownerId,
      purchase_id: purchaseId,
    },
    // Copied onto the PaymentIntent as well, because a refund webhook carries a
    // charge rather than a session and would otherwise have no route back to
    // the event.
    payment_intent_data: {
      metadata: {
        event_id: eventId,
        owner_id: ownerId,
        purchase_id: purchaseId,
      },
    },
    customer_email: billingDetails.email,
    locale: 'hu',
  })

  if (!session.url) {
    throw new Error('Stripe returned a checkout session with no URL')
  }

  if (
    session.amount_total === null ||
    session.amount_total <= 0 ||
    session.currency?.toLowerCase() !== 'huf'
  ) {
    await getStripe()
      .checkout.sessions.expire(session.id)
      .catch(() => null)
    throw new Error('Stripe returned an invalid HUF checkout amount')
  }

  // This is no longer best effort. Billingo needs an immutable invoice address,
  // and Stripe metadata is intentionally not used as a personal-data store. If
  // the ledger row cannot be written, expire the unpaid session rather than
  // accepting money that cannot be invoiced automatically.
  const supabase = await createClient()
  const { error } = await supabase.from('purchases').insert({
    id: purchaseId,
    event_id: eventId,
    owner_id: ownerId,
    stripe_checkout_session_id: session.id,
    amount_minor: session.amount_total,
    currency: session.currency,
    billing_type: billingDetails.type,
    billing_name: billingDetails.name,
    billing_email: billingDetails.email,
    billing_country_code: billingDetails.countryCode,
    billing_post_code: billingDetails.postCode,
    billing_city: billingDetails.city,
    billing_address: billingDetails.address,
    billing_tax_number: billingDetails.taxNumber,
    terms_version: LEGAL_VERSION,
    terms_accepted_at: acceptedAt,
    early_performance_consent_at: acceptedAt,
    status: 'pending',
    invoice_status: 'not_started',
  })
  if (error) {
    await getStripe()
      .checkout.sessions.expire(session.id)
      .catch(() => null)
    throw error
  }

  return session.url
}
