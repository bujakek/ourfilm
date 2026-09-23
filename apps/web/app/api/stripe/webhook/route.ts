import { billingDetailsFromStripeSession } from '@/lib/billing-details'
import {
  DOMESTIC_BILLING_COUNTRY,
  parseBillingCountry,
} from '@/lib/billing-country'
import {
  cancelBillingoInvoice,
  ensureBillingoInvoice,
} from '@/lib/billingo/invoicing'
import { createAdminClient } from '@/lib/supabase/admin'
import { getStripe } from '@/lib/stripe/client'
import { stripeEnv } from '@/lib/stripe/env'
import type { Database } from '@/lib/supabase/database.types'
import type { Settlement } from '@/lib/settlement'
import { reportServerEvent, reportServerIssue } from '@/lib/telemetry-server'
import { NextResponse } from 'next/server'
import type Stripe from 'stripe'

// Never cached, never prerendered: this is a machine endpoint that mutates.
export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

type AdminClient = ReturnType<typeof createAdminClient>
type Purchase = Database['public']['Tables']['purchases']['Row']

/** PostgREST's code for a unique-constraint violation. */
const UNIQUE_VIOLATION = '23505'

/**
 * A settled payment whose event has since been deleted.
 *
 * Its own class so the report carries a name that says what happened. The
 * database's foreign-key refusal arrives as a plain object and used to be
 * reported as `UnknownError`.
 */
class OrphanedPaymentError extends Error {
  constructor(sessionId: string, eventId: string) {
    super(`Paid session ${sessionId} references deleted event ${eventId}`)
    this.name = 'OrphanedPaymentError'
  }
}

/**
 * A paid sale that no automatic path may invoice until a person has looked.
 *
 * Its own class so `server_error` names it; the reason travels in the ledger
 * row, never in the report, because nothing here may carry an address.
 */
class ReconciliationRequiredError extends Error {
  constructor(sessionId: string, reason: ReconciliationReason) {
    super(`Session ${sessionId} needs reconciliation: ${reason}`)
    this.name = 'ReconciliationRequiredError'
  }
}

type ReconciliationReason =
  | 'billing_country_mismatch'
  | 'unsupported_billing_country'
  | 'settlement_mismatch'
  | 'settlement_unverified'

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
    await reportServerIssue(claimError, {
      operation: 'stripe_webhook_claim',
      route: '/api/stripe/webhook',
      routeType: 'route',
      method: 'POST',
    })
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
    await reportServerIssue(e, {
      operation: 'stripe_webhook_handle',
      route: '/api/stripe/webhook',
      routeType: 'route',
      method: 'POST',
    })
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
 * Which arrangement Stripe itself says this Session was, when it says.
 *
 * `managed_payments` is on the Session object from the API version we pin,
 * but a webhook payload is rendered at the endpoint's version, and an older
 * one omits the field entirely. Absent is therefore "unknown", never "direct":
 * the one answer that can issue an invoice is not the one to guess.
 */
function stripeSettlement(session: Stripe.Checkout.Session): Settlement | null {
  if (!('managed_payments' in session)) return null
  return session.managed_payments?.enabled ? 'managed' : 'direct'
}

/** The country the buyer entered on Stripe's page. Only the country. */
function reportedCountry(session: Stripe.Checkout.Session): string | null {
  const country = session.customer_details?.address?.country
  return country && /^[A-Z]{2}$/i.test(country) ? country.toUpperCase() : null
}

/**
 * Whether this paid sale can be trusted to be what its ledger row says.
 *
 * Hosted Checkout cannot lock the billing country: the host confirms one on
 * our page, but Stripe's address form lets them enter another, and nothing
 * between that form and the charge lets us refuse it. So a crossing of the
 * HU / non-HU boundary is detected here, after the money moved, and parked
 * for a person — never refunded automatically, never re-routed, and never
 * invoiced as though it had not happened. The merchant of record of a
 * completed payment is what it was.
 */
function reconciliationReasonFor(
  purchase: Pick<Purchase, 'settlement' | 'selected_billing_country'>,
  session: Stripe.Checkout.Session,
): ReconciliationReason | null {
  const stripe = stripeSettlement(session)
  if (stripe && stripe !== purchase.settlement) return 'settlement_mismatch'

  const reported = reportedCountry(session)
  if (!reported) return null

  const reportedDomestic = reported === DOMESTIC_BILLING_COUNTRY
  // A direct sale is a Hungarian sale; Billingo cannot invoice anything else.
  if (purchase.settlement === 'direct' && !reportedDomestic) {
    return 'billing_country_mismatch'
  }
  const selected = purchase.selected_billing_country
  if (
    selected &&
    (selected === DOMESTIC_BILLING_COUNTRY) !== reportedDomestic
  ) {
    return 'billing_country_mismatch'
  }
  if (purchase.settlement === 'managed' && !parseBillingCountry(reported)) {
    return 'unsupported_billing_country'
  }
  return null
}

/**
 * Record a settled checkout, and with it the entitlement that lifts the cap.
 *
 * Two shapes, because there are two of them. A direct Hungarian sale always
 * has a ledger row already — the checkout action refuses to hand out a session
 * without one — so this updates it in place, which is also what lets a
 * purchase whose event was deleted still be settled and invoiced. A Managed
 * Payments sale keeps the old upsert: its pending row is best effort, so this
 * has to work whether or not it exists.
 */
async function recordPaidSession(
  db: AdminClient,
  session: Stripe.Checkout.Session,
) {
  // A completed session is not necessarily a paid one — a delayed payment
  // method completes checkout and settles later, and marking it paid now would
  // hand out an album for money that has not arrived.
  if (session.payment_status !== 'paid') return

  const { data: existing, error: readError } = await db
    .from('purchases')
    .select('*')
    .eq('stripe_checkout_session_id', session.id)
    .maybeSingle()
  if (readError) throw readError

  if (existing) {
    await settleRecordedPurchase(db, session, existing)
    return
  }

  // No ledger row. On the direct path that should be impossible, and it is
  // worth saying so rather than quietly inventing one: `purchases.id` is
  // already committed to as Billingo's idempotency key, and a row minted here
  // would carry a different one.
  if (session.metadata?.settlement === 'direct') {
    throw new Error(
      `Direct session ${session.id} settled with no pending purchase`,
    )
  }

  const identity = await sessionIdentity(db, session)
  if (identity.kind === 'no_event_id') return

  // Real money for an album that no longer exists, and no row to attach it to.
  // A silent 2xx would leave a payment with no ledger entry, so this stays a
  // 500: Stripe keeps retrying and every attempt is reported by name until
  // somebody refunds it or reconciles it from the Dashboard.
  if (identity.kind === 'event_deleted') {
    throw new OrphanedPaymentError(session.id, identity.eventId)
  }

  // No ledger row, so no settlement recorded at checkout. What it was is
  // taken from Stripe and our own metadata, and only when they agree; a
  // Session carrying neither — the earliest checkouts — is recorded as
  // `managed`, which can never be invoiced, and flagged so the ledger does not
  // pretend to know. Never `direct` by default.
  const metadataSettlement =
    session.metadata?.settlement === 'managed' ? 'managed' : null
  const fromStripe = stripeSettlement(session)
  // Only a Stripe answer of `managed`, or our own `managed` metadata that
  // Stripe does not contradict, is a classification.
  const legacyReason: ReconciliationReason | null =
    fromStripe === 'direct'
      ? metadataSettlement
        ? 'settlement_mismatch'
        : 'settlement_unverified'
      : fromStripe === 'managed' || metadataSettlement
        ? null
        : 'settlement_unverified'
  const selected = parseBillingCountry(session.metadata?.billing_country)
  const reason =
    legacyReason ??
    reconciliationReasonFor(
      { settlement: 'managed', selected_billing_country: selected },
      session,
    )
  const now = new Date().toISOString()

  const { error } = await db.from('purchases').upsert(
    {
      event_id: identity.eventId,
      owner_id: identity.ownerId,
      stripe_checkout_session_id: session.id,
      stripe_payment_intent_id: idOf(session.payment_intent),
      stripe_customer_id: idOf(session.customer),
      amount_minor: session.amount_total,
      currency: session.currency,
      settlement: 'managed',
      selected_billing_country: selected,
      reported_billing_country: reportedCountry(session),
      reconciliation_reason: reason,
      reconciliation_flagged_at: reason ? now : null,
      status: 'paid',
      paid_at: now,
      failed_at: null,
      expired_at: null,
    },
    { onConflict: 'stripe_checkout_session_id' },
  )

  if (error) throw error

  if (reason) {
    await reportServerIssue(
      new ReconciliationRequiredError(session.id, reason),
      {
        operation: 'checkout_reconciliation',
        eventId: identity.eventId,
      },
    )
  }

  // After the write, never before: this event means the album is unlocked, and
  // reporting it from ahead of the upsert would claim a sale the ledger does
  // not have. Stripe's own identifiers stay out of it — `event_id` is what
  // joins this to `checkout_started` and to everything the host does next.
  await reportServerEvent('checkout_settled', {
    event_id: identity.eventId,
    status: 'paid',
    amount_minor: session.amount_total,
    currency: session.currency,
    event_deleted: false,
  })
}

/**
 * Settle a purchase that already has its ledger row, and invoice it if it is
 * ours to invoice.
 *
 * `event_id` and `owner_id` are deliberately never written here. Both are
 * `on delete set null`, so a host who deleted the album between paying and
 * this arriving has a row with nulls in them — and rewriting the ids would
 * fail the foreign key against a row that no longer exists, turning a
 * recoverable accounting record into three days of Stripe retries.
 */
async function settleRecordedPurchase(
  db: AdminClient,
  session: Stripe.Checkout.Session,
  purchase: Purchase,
) {
  // A late `completed` must not resurrect a purchase that has been refunded.
  if (purchase.status === 'refunded') return

  // The settlement recorded when the Session was created, never re-derived
  // from the event's language, the host's profile or anything else that can
  // change after the sale. Stripe's own record is compared with it below.
  const direct = purchase.settlement === 'direct'
  const paidAt = purchase.paid_at ?? new Date().toISOString()
  const reported = reportedCountry(session)
  const reconciliation =
    (purchase.reconciliation_reason as ReconciliationReason | null) ??
    reconciliationReasonFor(purchase, session)

  // Stripe is the authority on what was charged, and the ledger's amount was
  // written by the host's own client at checkout — so the session's number
  // wins and is what reaches the invoice. A disagreement is still worth
  // reporting: nothing ordinary produces one.
  if (
    session.amount_total !== null &&
    (purchase.amount_minor !== session.amount_total ||
      purchase.currency?.toLowerCase() !== session.currency?.toLowerCase())
  ) {
    await reportServerIssue(
      new Error(`Session ${session.id} amount differs from the ledger row`),
      { operation: 'checkout_amount_mismatch', eventId: purchase.event_id },
    )
  }

  // A flagged sale gets no invoice snapshot and no place in the queue: the
  // snapshot is what an invoice is issued from, and this one is in doubt.
  const invoiceable = direct && !reconciliation
  const billing = invoiceable ? billingDetailsFromStripeSession(session) : null

  // The only thing that can stop a Hungarian invoice: without a lawful name
  // and Hungarian address there is no document to issue. Not a payment
  // failure — the money moved and the album is unlocked either way — so it
  // parks the row in the retry queue with a reason, where the absence of a
  // matching `invoice_issued` is the alert.
  //
  // Accepted terms are deliberately *not* a gate. `consent_collection` makes
  // them required, so a payment without them is an anomaly worth recording —
  // but the invoice is owed under Hungarian law regardless, and withholding
  // it over a missing checkbox would turn a data oddity into a legal one.
  const invoiceBlocker =
    invoiceable && billing?.success === false
      ? `Session ${session.id} has invalid billing details: ${billing.error}`
      : null

  const snapshot = invoiceable && billing?.success ? billing.data : null

  const { error } = await db
    .from('purchases')
    .update({
      stripe_payment_intent_id: idOf(session.payment_intent),
      stripe_customer_id: idOf(session.customer),
      amount_minor: session.amount_total ?? purchase.amount_minor,
      currency: session.currency ?? purchase.currency,
      status: 'paid',
      paid_at: paidAt,
      failed_at: null,
      expired_at: null,
      reported_billing_country: reported,
      ...(reconciliation
        ? {
            reconciliation_reason: reconciliation,
            reconciliation_flagged_at:
              purchase.reconciliation_flagged_at ?? new Date().toISOString(),
          }
        : {}),
      ...(snapshot
        ? {
            billing_type: snapshot.type,
            billing_name: snapshot.name,
            billing_email: snapshot.email,
            billing_country_code: snapshot.countryCode,
            billing_post_code: snapshot.postCode,
            billing_city: snapshot.city,
            billing_address: snapshot.address,
            billing_tax_number: snapshot.taxNumber,
          }
        : {}),
      ...(direct
        ? {
            // Recorded as the Session reported it rather than compared against
            // the current constant: this is an audit trail, and gating on it
            // would refuse every in-flight session the moment the terms are
            // updated.
            terms_version: session.metadata?.legal_version ?? null,
            terms_accepted_at:
              purchase.terms_accepted_at ??
              session.metadata?.terms_accepted_at ??
              paidAt,
            // Read from the metadata rather than from `session.consent`,
            // because the acceptance happens on our own page: the checkout
            // action refuses to run without it, and the same wording carries
            // the early-performance request — one tick, one moment.
            early_performance_consent_at:
              session.metadata?.early_performance_requested === 'true'
                ? (purchase.early_performance_consent_at ??
                  session.metadata?.terms_accepted_at ??
                  paidAt)
                : purchase.early_performance_consent_at,
            invoice_status: reconciliation
              ? purchase.invoice_status
              : invoiceBlocker
                ? 'failed'
                : purchase.invoice_status === 'not_started'
                  ? 'pending'
                  : purchase.invoice_status,
            ...(invoiceBlocker
              ? {
                  invoice_last_error: invoiceBlocker,
                  invoice_next_attempt_at: new Date().toISOString(),
                }
              : {}),
          }
        : {}),
    })
    .eq('id', purchase.id)

  if (error) throw error

  await reportServerEvent('checkout_settled', {
    event_id: purchase.event_id,
    status: 'paid',
    amount_minor: session.amount_total,
    currency: session.currency,
    // The album was deleted between paying and Stripe reporting it. The money
    // and the obligation to invoice it both survive that.
    event_deleted: purchase.event_id === null,
  })

  if (reconciliation) {
    await reportServerIssue(
      new ReconciliationRequiredError(session.id, reconciliation),
      { operation: 'checkout_reconciliation', eventId: purchase.event_id },
    )
    return
  }

  if (!direct || invoiceBlocker) return

  // Never allowed to fail the webhook. The payment is recorded; an invoice
  // that could not be issued is the sweep's problem, and 500ing here would
  // leave `processed_at` null and re-run the payment handler for three days
  // over a Billingo outage.
  await ensureBillingoInvoice(db, purchase.id, 'webhook')
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
  const terminalAt = new Date().toISOString()

  // The ledger row usually exists, and since it now outlives the event it can
  // be updated even for a deleted album. Updating in place also keeps
  // `purchases.id` — the value already promised to Billingo as an idempotency
  // key — rather than replacing it.
  const { data: existing, error: readError } = await db
    .from('purchases')
    .select('id, event_id')
    .eq('stripe_checkout_session_id', session.id)
    .maybeSingle()
  if (readError) throw readError

  if (existing) {
    const { error } = await db
      .from('purchases')
      .update({
        stripe_payment_intent_id: idOf(session.payment_intent),
        stripe_customer_id: idOf(session.customer),
        status,
        failed_at: status === 'failed' ? terminalAt : null,
        expired_at: status === 'expired' ? terminalAt : null,
      })
      .eq('id', existing.id)
      // A session that failed or expired must never overwrite a paid or
      // refunded row. Stripe can deliver `expired` after a late `completed`.
      .eq('status', 'pending')

    if (error) throw error

    await reportServerEvent('checkout_settled', {
      event_id: existing.event_id,
      status,
      amount_minor: session.amount_total,
      currency: session.currency,
      event_deleted: existing.event_id === null,
    })
    return
  }

  const identity = await sessionIdentity(db, session)
  if (identity.kind === 'no_event_id') return

  // No row and no event: there is nothing to keep and nothing to attach it to.
  // No money moved, so the upsert would only fail on the foreign key, and a
  // 500 here has Stripe retrying for three days something no retry can fix.
  if (identity.kind === 'event_deleted') {
    console.warn(
      `Checkout session ${session.id} ${status} for deleted event ${identity.eventId}`,
    )
    await reportServerEvent('checkout_settled', {
      event_id: identity.eventId,
      status,
      amount_minor: session.amount_total,
      currency: session.currency,
      event_deleted: true,
    })
    return
  }

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

  await reportServerEvent('checkout_settled', {
    event_id: identity.eventId,
    status,
    amount_minor: session.amount_total,
    currency: session.currency,
    event_deleted: false,
  })
}

type SessionIdentity =
  | { kind: 'ok'; eventId: string; ownerId: string }
  | { kind: 'no_event_id' }
  | { kind: 'event_deleted'; eventId: string }

/**
 * Resolve the application identifiers shared by every Session handler.
 *
 * Only reached when no ledger row exists for the session — every handler
 * prefers the row, which since the invoicing migration outlives both the event
 * and the account. Here the event row is still read rather than trusting the
 * metadata: `purchases.event_id` and `owner_id` are foreign keys, and an
 * *insert* naming a deleted event can never succeed however the delete
 * behaves. Trusting the metadata alone is how an expired session was retried
 * for a day with only `UnknownError` to show for it. Each handler decides what
 * a missing event means for its own outcome.
 */
async function sessionIdentity(
  db: AdminClient,
  session: Stripe.Checkout.Session,
): Promise<SessionIdentity> {
  const eventId = session.metadata?.event_id ?? session.client_reference_id
  if (!eventId) {
    // Nothing to attach the event to. Retrying the identical payload cannot add
    // metadata, so retain the Stripe event in the audit table and reconcile it
    // from the Dashboard rather than asking Stripe to retry for three days.
    console.error(`Checkout session ${session.id} carried no event_id`)
    return { kind: 'no_event_id' }
  }

  const { data: event, error } = await db
    .from('events')
    .select('owner_id')
    .eq('id', eventId)
    .maybeSingle()

  // A failed read is transient and worth a retry; a missing row is not.
  if (error) throw error
  if (!event) return { kind: 'event_deleted', eventId }

  return { kind: 'ok', eventId, ownerId: event.owner_id }
}

/**
 * Take the entitlement back when the money goes back.
 *
 * Only on a *full* refund. A partial refund — a goodwill gesture, a price
 * adjustment — still leaves the album paid for, and revoking it would mean a
 * host who was given 2 000 Ft back loses a wedding album.
 *
 * A direct sale also has an issued Hungarian invoice behind it, and an issued
 * invoice is never deleted: it is cancelled with a storno document, which is
 * what `cancelBillingoInvoice` goes and creates.
 */
async function recordRefund(db: AdminClient, charge: Stripe.Charge) {
  if (charge.amount_refunded < charge.amount) return

  const paymentIntentId = idOf(charge.payment_intent)
  if (!paymentIntentId) return

  const { data: matched, error: readError } = await db
    .from('purchases')
    .select('id, event_id, settlement, invoice_status')
    .eq('stripe_payment_intent_id', paymentIntentId)
  if (readError) throw readError

  // No match is an ordinary outcome for a charge this product never sold.
  if (!matched || matched.length === 0) return

  const refundedAt = new Date().toISOString()

  for (const row of matched) {
    // A direct sale with a document behind it joins the cancellation queue.
    // One that never got as far as an invoice is simply done — there is
    // nothing to storno, and `claim_purchase_invoice` only claims paid rows,
    // so the refund takes it out of the issuing queue in the same move.
    const nextInvoiceStatus =
      row.settlement !== 'direct'
        ? row.invoice_status
        : row.invoice_status === 'cancelled' ||
            row.invoice_status === 'not_started'
          ? row.invoice_status
          : 'cancellation_pending'

    const { error } = await db
      .from('purchases')
      .update({
        status: 'refunded',
        refunded_at: refundedAt,
        invoice_status: nextInvoiceStatus,
        ...(nextInvoiceStatus === 'cancellation_pending'
          ? { invoice_next_attempt_at: refundedAt, invoicing_started_at: null }
          : {}),
      })
      .eq('id', row.id)

    if (error) throw error

    // A refund is a revoked entitlement, so it is worth one report per album
    // it took back.
    await reportServerEvent('checkout_settled', {
      event_id: row.event_id,
      status: 'refunded',
      amount_minor: charge.amount_refunded,
      currency: charge.currency,
      event_deleted: row.event_id === null,
    })

    if (nextInvoiceStatus === 'cancellation_pending') {
      // Never throws, for the same reason the issuing call does not.
      await cancelBillingoInvoice(db, row.id, 'webhook')
    }
  }
}
