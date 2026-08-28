import 'server-only'

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
  ownerEmail,
}: {
  eventId: string
  slug: string
  ownerId: string
  ownerEmail: string | null
}): Promise<string> {
  const origin = await requestOrigin()
  const purchaseId = randomUUID()

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
      terms_version: LEGAL_VERSION,
    },
    // Copied onto the PaymentIntent as well, because a refund webhook carries a
    // charge rather than a session and would otherwise have no route back to
    // the event.
    payment_intent_data: {
      metadata: {
        event_id: eventId,
        owner_id: ownerId,
        purchase_id: purchaseId,
        terms_version: LEGAL_VERSION,
      },
    },
    customer_email: ownerEmail ?? undefined,
    // Tax IDs are attached to a Customer in payment mode. We keep the id for
    // reconciliation, while the invoice itself always uses our own snapshot.
    customer_creation: 'always',
    billing_address_collection: 'required',
    tax_id_collection: { enabled: true, required: 'never' },
    consent_collection: { terms_of_service: 'required' },
    custom_text: {
      submit: {
        message:
          'Az OurFilm pilot jelenleg kizárólag magyar számlázási címmel használható.',
      },
      terms_of_service_acceptance: {
        message:
          'Elfogadom az ÁSZF-et, kérem a szolgáltatás azonnali, a 14 napos elállási időn belüli megkezdését, és tudomásul veszem, hogy a teljesítés megkezdésével elveszítem az elállási jogomat.',
      },
    },
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

  // This is no longer best effort. Stripe will collect the immutable invoice
  // snapshot and declarations, but the ledger row must exist before it accepts
  // money so the webhook always has somewhere durable to store them.
  const supabase = await createClient()
  const { error } = await supabase.from('purchases').insert({
    id: purchaseId,
    event_id: eventId,
    owner_id: ownerId,
    stripe_checkout_session_id: session.id,
    amount_minor: session.amount_total,
    currency: session.currency,
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
