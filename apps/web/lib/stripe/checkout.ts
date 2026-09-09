import 'server-only'

import { requestOrigin } from '@/lib/request-origin'
import { createClient } from '@/lib/supabase/server'
import { LEGAL_VERSION } from '@/lib/company'
import type { Locale } from '@/lib/i18n'

import { getStripe } from './client'
import { stripeEnv } from './env'

/** Stripe's minimum is 30 minutes; the buffer avoids clock/transport skew. */
const CHECKOUT_ATTEMPT_TTL_SECONDS = 45 * 60

/** PostgREST's code for a unique-constraint violation. */
const UNIQUE_VIOLATION = '23505'

/**
 * Which arrangement sells this event, and therefore who issues the document.
 *
 * `managed` is Stripe Managed Payments: Link, LLC is the merchant of record,
 * remits the indirect taxes and issues the customer-facing document. `direct`
 * is an ordinary Stripe charge with OurFilm as the seller, which is what makes
 * a Hungarian invoice — and NAV reporting — our own obligation.
 *
 * The split is not a preference. Managed Payments does not currently do Apple
 * Pay on HUF, and a QR-code product whose buyers are on phones cannot give up
 * the one-tap payment. English events keep Managed Payments, where Apple Pay
 * on USD works and Link keeps the tax and documentation burden.
 *
 * Keyed on the same locale that picks the Price, so the currency and the legal
 * arrangement can never disagree about which sale this is.
 */
export type Settlement = 'managed' | 'direct'

export function settlementFor(locale: Locale): Settlement {
  return locale === 'en' ? 'managed' : 'direct'
}

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
  locale,
  termsAcceptedAt,
}: {
  eventId: string
  slug: string
  ownerId: string
  ownerEmail: string | null
  locale: Locale
  /** Server timestamp created only after the explicit checkbox was checked. */
  termsAcceptedAt: string
}): Promise<string> {
  const origin = await requestOrigin()
  const supabase = await createClient()

  // Reserve before talking to Stripe. Concurrent requests for the same event
  // receive the same attempt id and canonical acceptance timestamp, making the
  // Stripe request byte-for-byte identical and therefore safe to retry with one
  // idempotency key. After expiry the RPC atomically rotates the attempt.
  const { data: attempt, error: attemptError } = await supabase
    .rpc('reserve_event_checkout', {
      p_event_id: eventId,
      p_terms_accepted_at: termsAcceptedAt,
      p_ttl_seconds: CHECKOUT_ATTEMPT_TTL_SECONDS,
    })
    .single()

  if (attemptError) throw attemptError

  const canonicalTermsAcceptedAt = new Date(
    attempt.terms_accepted_at,
  ).toISOString()
  const env = stripeEnv()
  const settlement = settlementFor(locale)
  const eventPriceId = locale === 'en' ? env.eventPriceUsdId : env.eventPriceId

  // `purchases.id`, decided here rather than by the database, because it is
  // also Billingo's `vendor_id` — the key that lets a timed-out invoice
  // request be recognised instead of issued twice. It must therefore exist
  // before Stripe is asked for money.
  //
  // The attempt id and not a fresh uuid: concurrent callers share one
  // idempotency key, and Stripe refuses a key replayed with different
  // parameters. The attempt id is the one value that is random per attempt and
  // identical across the callers that race for it.
  const purchaseId = attempt.attempt_id

  const metadata = {
    event_id: eventId,
    owner_id: ownerId,
    locale,
    settlement,
    purchase_id: purchaseId,
    legal_version: LEGAL_VERSION,
    terms_accepted_at: canonicalTermsAcceptedAt,
    early_performance_requested: 'true',
  }

  const session = await getStripe().checkout.sessions.create(
    {
      mode: 'payment',
      ...(settlement === 'managed'
        ? {
            // Link acts as merchant of record: it calculates and remits
            // supported indirect taxes, issues the customer-facing transaction
            // documents, and handles payment-level support, refunds, fraud and
            // disputes.
            managed_payments: { enabled: true as const },
          }
        : {
            // OurFilm is the seller here, so everything Link was doing becomes
            // ours. A Hungarian invoice must carry the buyer's name and
            // address even when the buyer is a private individual, and Stripe
            // is the only place to ask for them without putting a second form
            // in front of someone who just paid with one tap.
            billing_address_collection: 'required' as const,
            customer_creation: 'always' as const,
            // The declaration is the seller's own now. Recorded on the Session
            // so the webhook can refuse to invoice a payment that carries no
            // accepted terms.
            consent_collection: { terms_of_service: 'required' as const },
            custom_text: {
              terms_of_service_acceptance: {
                message:
                  'Elfogadom az ÁSZF-et, kérem a szolgáltatás azonnali, a 14 napos elállási időn belüli megkezdését, és tudomásul veszem, hogy a teljesítés megkezdésével elveszítem az elállási jogomat.',
              },
            },
            // Deliberately no `automatic_tax` and no `invoice_creation`: the
            // sale is alanyi adómentes, so there is no VAT to calculate, and
            // the document that satisfies Hungarian law is the Billingo
            // invoice, not a Stripe receipt.
          }),
      line_items: [{ price: eventPriceId, quantity: 1 }],
      expires_at: Math.floor(new Date(attempt.expires_at).getTime() / 1_000),
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
      metadata,
      // Copied onto the PaymentIntent as well, because a refund webhook carries a
      // charge rather than a session and would otherwise have no route back to
      // the event.
      payment_intent_data: { metadata },
      customer_email: ownerEmail ?? undefined,
      locale,
    },
    {
      idempotencyKey: `event-checkout:${eventId}:${attempt.attempt_id}`,
    },
  )

  if (!session.url) {
    throw new Error('Stripe returned a checkout session with no URL')
  }

  // What Stripe says it will charge, which is what will be invoiced. A price
  // id pointing at the wrong currency is otherwise invisible until a host has
  // paid and Billingo refuses the document.
  const expectedCurrency = settlement === 'direct' ? 'huf' : 'usd'
  if (
    session.amount_total === null ||
    session.amount_total <= 0 ||
    session.currency?.toLowerCase() !== expectedCurrency
  ) {
    await expireQuietly(session.id)
    throw new Error(
      `Stripe returned an invalid ${expectedCurrency.toUpperCase()} checkout amount`,
    )
  }

  const { error } = await supabase.from('purchases').insert({
    id: purchaseId,
    event_id: eventId,
    owner_id: ownerId,
    stripe_checkout_session_id: session.id,
    settlement,
    // Host-supplied, and therefore not trusted: the webhook compares these
    // against what Stripe reports before anything is invoiced. What they buy
    // is a ledger row that says what was asked for, even if no webhook ever
    // arrives.
    amount_minor: session.amount_total,
    currency: session.currency,
    status: 'pending',
  })

  // Two concurrent callers receive the same Stripe Session. The first insert
  // records it; the second sees the session-id unique constraint, which is the
  // expected proof that both requests converged rather than a billing failure.
  if (error && error.code !== UNIQUE_VIOLATION) {
    if (settlement === 'direct') {
      // Not best effort on this path. The webhook has to have somewhere
      // durable to put the invoice snapshot, and `purchases.id` is already
      // committed to as Billingo's idempotency key — so if the row cannot
      // exist, the session must not either. Better a host who sees an error
      // than a host who pays and never receives an invoice.
      await expireQuietly(session.id)
      throw error
    }
    // Managed Payments keeps the old behaviour: Link issues the document, the
    // webhook upserts on the session id, and the row is a trace rather than a
    // precondition.
    console.error('Could not record pending purchase', error)
  }

  return session.url
}

/**
 * Cancel a session we are about to abandon.
 *
 * Swallowed on purpose: this only ever runs while another error is being
 * raised, and losing that error to a cleanup failure would replace a
 * diagnosable problem with a silent one. An unexpired session left open is
 * harmless — it expires on its own, and the reservation rotates with it.
 */
async function expireQuietly(sessionId: string): Promise<void> {
  await getStripe()
    .checkout.sessions.expire(sessionId)
    .catch(() => null)
}
