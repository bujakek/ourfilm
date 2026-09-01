import { createAdminClient } from '@/lib/supabase/admin'
import { getStripe } from '@/lib/stripe/client'
import { stripeEnv } from '@/lib/stripe/env'
import { NextResponse } from 'next/server'
import type Stripe from 'stripe'

// Never cached, never prerendered: this is a machine endpoint that mutates.
export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

type AdminClient = ReturnType<typeof createAdminClient>

/** PostgREST's code for a unique-constraint violation. */
const UNIQUE_VIOLATION = '23505'

/**
 * Stripe's server-to-server report of what actually happened.
 *
 * This is the *only* thing that marks a purchase paid. The browser coming back
 * to `?checkout=success` proves nothing — a host can type that URL, and a host
 * who closes the tab on Stripe's success page still deserves their album — so
 * the redirect is a UI hint and this is the truth.
 *
 * It lives under `/api/` rather than in the Hungarian route namespace the rest
 * of the app uses because no human ever navigates here, and because the URL
 * gets pasted into the Stripe dashboard where `/api/stripe/webhook` is
 * self-explanatory and `/fizetes/visszajelzes` is not.
 */
export async function POST(request: Request) {
  const signature = request.headers.get('stripe-signature')
  if (!signature) {
    return new NextResponse('Missing stripe-signature header', { status: 400 })
  }

  // The raw body, byte for byte. Parsing it first and re-serialising would
  // change the whitespace and break the signature — this is the single most
  // common way a Stripe webhook fails to verify.
  const payload = await request.text()

  let event: Stripe.Event
  try {
    event = await getStripe().webhooks.constructEventAsync(
      payload,
      signature,
      stripeEnv().webhookSecret,
    )
  } catch (e) {
    // 400, deliberately not 500: an unverifiable payload is not a transient
    // failure and there is nothing to gain from Stripe retrying it for three
    // days. It is either an attacker or a mismatched STRIPE_WEBHOOK_SECRET,
    // and both want a hard answer.
    console.error('Stripe signature verification failed', e)
    return new NextResponse('Signature verification failed', { status: 400 })
  }

  const db = createAdminClient()

  // Stripe delivers at least once and retries anything that is not 2xx.
  // Claiming the event id here turns the common duplicate into a no-op.
  const { data: claimed, error: claimError } = await db
    .from('stripe_webhook_events')
    .insert({ id: event.id, type: event.type })
    .select('id')
    .maybeSingle()

  if (claimError && claimError.code !== UNIQUE_VIOLATION) {
    console.error('Could not record webhook event', claimError)
    return new NextResponse('Could not record event', { status: 500 })
  }

  if (!claimed) {
    const { data: seen } = await db
      .from('stripe_webhook_events')
      .select('processed_at')
      .eq('id', event.id)
      .maybeSingle()

    // A row with no `processed_at` is an attempt that crashed partway. Falling
    // through and running it again is the right move — every handler below is
    // written to be repeatable — and is why this is not an unconditional skip.
    if (seen?.processed_at) {
      return NextResponse.json({ received: true, duplicate: true })
    }
  }

  try {
    switch (event.type) {
      // `completed` fires the moment checkout finishes; for a card that
      // already means the money moved. `async_payment_succeeded` is the same
      // outcome arriving late for payment methods that settle out of band,
      // and both land on the same handler, which is idempotent.
      case 'checkout.session.completed':
      case 'checkout.session.async_payment_succeeded':
        await recordPaidSession(db, event.data.object)
        break

      case 'checkout.session.async_payment_failed':
        await recordTerminalSession(db, event.data.object, 'failed')
        break

      case 'checkout.session.expired':
        await recordTerminalSession(db, event.data.object, 'expired')
        break

      case 'charge.refunded':
        await recordRefund(db, event.data.object)
        break

      // Everything else is acknowledged and ignored. Answering 2xx is what
      // stops Stripe retrying events we deliberately do not handle; narrowing
      // the subscription in the dashboard is the better fix, but this keeps a
      // widened subscription from generating three days of noise.
      default:
        break
    }
  } catch (e) {
    // 500 so Stripe retries. `processed_at` stays null, so the retry gets past
    // the duplicate check above and runs the handler again.
    console.error(`Stripe webhook handler failed for ${event.type}`, e)
    return new NextResponse('Handler failed', { status: 500 })
  }

  await db
    .from('stripe_webhook_events')
    .update({ processed_at: new Date().toISOString() })
    .eq('id', event.id)

  return NextResponse.json({ received: true })
}

/** Stripe hands back expandable fields as either an id or the whole object. */
function idOf(
  value: string | { id: string } | null | undefined,
): string | null {
  if (!value) return null
  return typeof value === 'string' ? value : value.id
}

/**
 * Record a settled checkout, and with it the entitlement that lifts the cap.
 *
 * An upsert rather than an update: the pending row the checkout action writes
 * is best effort, so this has to work whether or not it exists. Keyed on the
 * session id, which is unique and is what makes replaying this event harmless.
 */
async function recordPaidSession(
  db: AdminClient,
  session: Stripe.Checkout.Session,
) {
  // A completed session is not necessarily a paid one — a delayed payment
  // method completes checkout and settles later, and marking it paid now would
  // hand out an album for money that has not arrived.
  if (session.payment_status !== 'paid') return

  const identity = await sessionIdentity(db, session)
  if (!identity) return

  const { error } = await db.from('purchases').upsert(
    {
      event_id: identity.eventId,
      owner_id: identity.ownerId,
      stripe_checkout_session_id: session.id,
      stripe_payment_intent_id: idOf(session.payment_intent),
      stripe_customer_id: idOf(session.customer),
      amount_minor: session.amount_total,
      currency: session.currency,
      status: 'paid',
      paid_at: new Date().toISOString(),
      failed_at: null,
      expired_at: null,
    },
    { onConflict: 'stripe_checkout_session_id' },
  )

  if (error) throw error
}

/**
 * Keep failed and abandoned attempts in the ledger without granting access.
 *
 * These are terminal states for one Checkout Session, not for the event. A host
 * can start a new attempt after the reservation expires, and a later paid row
 * for that event still lifts the cap normally.
 */
async function recordTerminalSession(
  db: AdminClient,
  session: Stripe.Checkout.Session,
  status: 'failed' | 'expired',
) {
  const identity = await sessionIdentity(db, session)
  if (!identity) return

  const terminalAt = new Date().toISOString()
  const { error } = await db.from('purchases').upsert(
    {
      event_id: identity.eventId,
      owner_id: identity.ownerId,
      stripe_checkout_session_id: session.id,
      stripe_payment_intent_id: idOf(session.payment_intent),
      stripe_customer_id: idOf(session.customer),
      amount_minor: session.amount_total,
      currency: session.currency,
      status,
      failed_at: status === 'failed' ? terminalAt : null,
      expired_at: status === 'expired' ? terminalAt : null,
    },
    { onConflict: 'stripe_checkout_session_id' },
  )

  if (error) throw error
}

/** Resolve the application identifiers shared by every Session handler. */
async function sessionIdentity(
  db: AdminClient,
  session: Stripe.Checkout.Session,
): Promise<{ eventId: string; ownerId: string } | null> {
  const eventId = session.metadata?.event_id ?? session.client_reference_id
  if (!eventId) {
    // Nothing to attach the event to. Retrying the identical payload cannot add
    // metadata, so retain the Stripe event in the audit table and reconcile it
    // from the Dashboard rather than asking Stripe to retry for three days.
    console.error(`Checkout session ${session.id} carried no event_id`)
    return null
  }

  let ownerId = session.metadata?.owner_id ?? null
  if (!ownerId) {
    const { data: event } = await db
      .from('events')
      .select('owner_id')
      .eq('id', eventId)
      .maybeSingle()
    ownerId = event?.owner_id ?? null
  }
  if (!ownerId) {
    console.error(`No owner for event ${eventId} (session ${session.id})`)
    return null
  }

  return { eventId, ownerId }
}

/**
 * Take the entitlement back when the money goes back.
 *
 * Only on a *full* refund. A partial refund — a goodwill gesture, a price
 * adjustment — still leaves the album paid for, and revoking it would mean a
 * host who was given 2 000 Ft back loses a wedding album.
 */
async function recordRefund(db: AdminClient, charge: Stripe.Charge) {
  if (charge.amount_refunded < charge.amount) return

  const paymentIntentId = idOf(charge.payment_intent)
  if (!paymentIntentId) return

  const { error } = await db
    .from('purchases')
    .update({
      status: 'refunded',
      refunded_at: new Date().toISOString(),
    })
    .eq('stripe_payment_intent_id', paymentIntentId)

  if (error) throw error
}
