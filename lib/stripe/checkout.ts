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
  const eventPriceId = locale === 'en' ? env.eventPriceUsdId : env.eventPriceId

  const session = await getStripe().checkout.sessions.create(
    {
      mode: 'payment',
      // Link acts as merchant of record: it calculates and remits supported
      // indirect taxes, issues the customer-facing transaction documents, and
      // handles payment-level support, refunds, fraud and disputes.
      managed_payments: { enabled: true },
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
      metadata: {
        event_id: eventId,
        owner_id: ownerId,
        locale,
        legal_version: LEGAL_VERSION,
        terms_accepted_at: canonicalTermsAcceptedAt,
        early_performance_requested: 'true',
      },
      // Copied onto the PaymentIntent as well, because a refund webhook carries a
      // charge rather than a session and would otherwise have no route back to
      // the event.
      payment_intent_data: {
        metadata: {
          event_id: eventId,
          owner_id: ownerId,
          locale,
          legal_version: LEGAL_VERSION,
          terms_accepted_at: canonicalTermsAcceptedAt,
          early_performance_requested: 'true',
        },
      },
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

  // Best effort, and intentionally not part of the happy path's correctness.
  // The webhook upserts on this session id, so it fills the row in if this
  // insert never happened; what the row buys us is a record that *someone
  // started paying*, which is the only trace left when a webhook is
  // misconfigured and the money is real.
  const { error } = await supabase.from('purchases').insert({
    event_id: eventId,
    owner_id: ownerId,
    stripe_checkout_session_id: session.id,
    status: 'pending',
  })
  // Two concurrent callers receive the same Stripe Session. The first insert
  // records it; the second sees the session-id unique constraint, which is the
  // expected proof that both requests converged rather than a billing failure.
  if (error && error.code !== UNIQUE_VIOLATION) {
    console.error('Could not record pending purchase', error)
  }

  return session.url
}
