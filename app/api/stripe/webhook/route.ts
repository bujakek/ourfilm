import { createAdminClient } from '@/lib/supabase/admin'
import {
  cancelBillingoInvoice,
  ensureBillingoInvoice,
} from '@/lib/billingo/invoicing'
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
        {
          const purchaseId = await recordPaidSession(
            db,
            event.data.object,
            event.created,
          )
          if (purchaseId) await ensureBillingoInvoice(db, purchaseId)
        }
        break

      case 'charge.refunded':
        {
          const purchaseId = await recordRefund(db, event.data.object)
          if (purchaseId) await cancelBillingoInvoice(db, purchaseId)
        }
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
 * The checkout action must have written a pending row with the immutable
 * billing snapshot before Stripe accepts payment. The session id and purchase
 * id must both match, which makes replaying this event harmless.
 */
async function recordPaidSession(
  db: AdminClient,
  session: Stripe.Checkout.Session,
  stripeEventCreated: number,
): Promise<string | null> {
  // A completed session is not necessarily a paid one — a delayed payment
  // method completes checkout and settles later, and marking it paid now would
  // hand out an album for money that has not arrived.
  if (session.payment_status !== 'paid') return null

  const eventId = session.metadata?.event_id ?? session.client_reference_id
  if (!eventId) {
    // Nothing to attach the payment to. Throwing would make Stripe retry an
    // event that can never succeed, so this is logged loudly and accepted —
    // the session id is in the log and the dashboard, which is enough to
    // reconcile it by hand.
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

  const { data: purchase, error: readError } = await db
    .from('purchases')
    .select('*')
    .eq('stripe_checkout_session_id', session.id)
    .maybeSingle()

  if (readError) throw readError
  if (!purchase) {
    throw new Error(
      `Checkout session ${session.id} has no purchase with billing details`,
    )
  }

  if (
    (purchase.event_id !== null && purchase.event_id !== eventId) ||
    (purchase.owner_id !== null && purchase.owner_id !== ownerId) ||
    purchase.id !== session.metadata?.purchase_id
  ) {
    throw new Error(`Checkout session ${session.id} metadata does not match`)
  }

  if (
    session.amount_total === null ||
    purchase.amount_minor !== session.amount_total ||
    purchase.currency?.toLowerCase() !== session.currency?.toLowerCase()
  ) {
    throw new Error(`Checkout session ${session.id} amount does not match`)
  }

  // A late checkout event must not resurrect a purchase already refunded.
  if (purchase.status === 'refunded') return purchase.id

  const { error } = await db
    .from('purchases')
    .update({
      stripe_payment_intent_id: idOf(session.payment_intent),
      stripe_customer_id: idOf(session.customer),
      status: 'paid',
      paid_at:
        purchase.paid_at ?? new Date(stripeEventCreated * 1000).toISOString(),
      invoice_status:
        purchase.invoice_status === 'not_started'
          ? 'pending'
          : purchase.invoice_status,
    })
    .eq('id', purchase.id)

  if (error) throw error
  return purchase.id
}

/**
 * Take the entitlement back when the money goes back.
 *
 * Only on a *full* refund. A partial refund — a goodwill gesture, a price
 * adjustment — still leaves the album paid for, and revoking it would mean a
 * host who was given 2 000 Ft back loses a wedding album.
 */
async function recordRefund(
  db: AdminClient,
  charge: Stripe.Charge,
): Promise<string | null> {
  if (charge.amount_refunded < charge.amount) return null

  const paymentIntentId = idOf(charge.payment_intent)
  if (!paymentIntentId) return null

  const { data: purchase, error: readError } = await db
    .from('purchases')
    .select('id, invoice_status')
    .eq('stripe_payment_intent_id', paymentIntentId)
    .maybeSingle()
  if (readError) throw readError
  if (!purchase) {
    throw new Error(`Refunded payment ${paymentIntentId} has no purchase`)
  }

  const { error } = await db
    .from('purchases')
    .update({
      status: 'refunded',
      refunded_at: new Date().toISOString(),
      invoice_status:
        purchase.invoice_status === 'cancelled'
          ? 'cancelled'
          : 'cancellation_pending',
    })
    .eq('id', purchase.id)

  if (error) throw error
  return purchase.id
}
