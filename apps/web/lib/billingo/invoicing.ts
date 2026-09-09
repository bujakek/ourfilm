import 'server-only'

import type { BillingDetails } from '@/lib/billing-details'
import { HUF_MINOR_PER_FORINT } from '@/lib/billing'
import type { Database } from '@/lib/supabase/database.types'
import { reportServerEvent, reportServerIssue } from '@/lib/telemetry-server'
import type { SupabaseClient } from '@supabase/supabase-js'

import {
  BillingoError,
  cancelDocument,
  createInvoice,
  createPartner,
  getDocumentByVendorId,
  sendDocument,
  setInvoicePayment,
} from './client'

type AdminClient = SupabaseClient<Database>
type Purchase = Database['public']['Tables']['purchases']['Row']

/** Who is asking: the Stripe webhook's first try, or pg_cron coming back. */
export type InvoiceSource = 'webhook' | 'sweep'

export type InvoiceOutcome = 'issued' | 'skipped' | 'failed'
export type CancellationOutcome = 'cancelled' | 'skipped' | 'failed'

const BUDAPEST_TIME_ZONE = 'Europe/Budapest'

/** Four attempts of backoff, then an hour between tries, indefinitely. */
const MAX_BACKOFF_MINUTES = 60

/**
 * The Hungarian calendar day for an instant.
 *
 * Vercel runs UTC, so formatting `paid_at` there puts a payment made at
 * 00:30 Budapest time on the previous day's invoice — a fulfilment date that
 * disagrees with the payment it documents.
 */
export function hungarianDate(value: string | Date): string {
  const parts = new Intl.DateTimeFormat('en', {
    timeZone: BUDAPEST_TIME_ZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(typeof value === 'string' ? new Date(value) : value)

  const read = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((part) => part.type === type)?.value

  return `${read('year')}-${read('month')}-${read('day')}`
}

function billingDetails(purchase: Purchase): BillingDetails {
  const required = [
    purchase.billing_type,
    purchase.billing_name,
    purchase.billing_email,
    purchase.billing_country_code,
    purchase.billing_post_code,
    purchase.billing_city,
    purchase.billing_address,
  ]

  if (required.some((value) => !value)) {
    throw new Error(`Purchase ${purchase.id} has incomplete billing details`)
  }

  if (
    purchase.billing_type !== 'individual' &&
    purchase.billing_type !== 'company'
  ) {
    throw new Error(`Purchase ${purchase.id} has an invalid billing type`)
  }

  if (purchase.billing_country_code !== 'HU') {
    throw new Error(`Purchase ${purchase.id} is not a Hungarian sale`)
  }

  if (purchase.billing_type === 'company' && !purchase.billing_tax_number) {
    throw new Error(`Purchase ${purchase.id} has no company tax number`)
  }

  return {
    type: purchase.billing_type,
    name: purchase.billing_name!,
    email: purchase.billing_email!,
    countryCode: 'HU',
    postCode: purchase.billing_post_code!,
    city: purchase.billing_city!,
    address: purchase.billing_address!,
    taxNumber:
      purchase.billing_type === 'company' ? purchase.billing_tax_number : null,
  }
}

/**
 * The invoiceable amount, in forints.
 *
 * A Managed Payments purchase is refused here rather than allowed to fail on
 * its currency: it is not a broken Hungarian sale, it is a sale whose document
 * Link issues. Confusing the two is how a USD purchase ends up in the retry
 * queue for ever.
 */
function grossForints(purchase: Purchase): number {
  if (purchase.settlement !== 'direct') {
    throw new Error(`Purchase ${purchase.id} is not settled directly`)
  }

  if (
    purchase.currency?.toLowerCase() !== 'huf' ||
    purchase.amount_minor === null ||
    purchase.amount_minor <= 0 ||
    purchase.amount_minor % HUF_MINOR_PER_FORINT !== 0
  ) {
    throw new Error(`Purchase ${purchase.id} has an invalid HUF amount`)
  }

  return purchase.amount_minor / HUF_MINOR_PER_FORINT
}

function retryAt(attempts: number): string {
  const minutes = Math.min(2 ** Math.max(attempts - 1, 0), MAX_BACKOFF_MINUTES)
  return new Date(Date.now() + minutes * 60_000).toISOString()
}

/** A bounded, non-identifying label for PostHog. Never Billingo's own text. */
function errorLabel(error: unknown): string {
  if (error instanceof BillingoError) {
    return `BillingoError:${error.status ?? 'network'}`
  }
  return error instanceof Error ? error.name : 'UnknownError'
}

/**
 * Ensures exactly one Billingo invoice exists for a paid Hungarian purchase.
 *
 * Two layers of idempotency, because one is not enough. The database claim
 * serialises concurrent callers — a webhook retry racing the sweep. Billingo's
 * vendor-id lookup closes the harder gap: Billingo may have created the
 * document even when our request timed out before its response reached Vercel,
 * and an issued Hungarian invoice cannot be withdrawn, only cancelled with a
 * second document.
 *
 * It never throws. A Billingo outage is not a reason to fail the Stripe
 * webhook — the payment is recorded either way, and rethrowing would leave
 * `processed_at` null and have Stripe re-run the *payment* handler for three
 * days over an invoicing problem. The sweep owns the retry.
 */
export async function ensureBillingoInvoice(
  db: AdminClient,
  purchaseId: string,
  source: InvoiceSource,
): Promise<InvoiceOutcome> {
  let claimed = false

  try {
    const { data, error } = await db.rpc('claim_purchase_invoice', {
      p_purchase_id: purchaseId,
    })
    if (error) throw error
    claimed = data === true
  } catch (error) {
    await reportServerIssue(error, { operation: 'invoice_claim' })
    return 'failed'
  }

  // Somebody else holds the lease, or there is nothing to do. Either way this
  // caller is finished; it is not a failure and must not be reported as one.
  if (!claimed) return 'skipped'

  let documentId: number | null = null
  let eventId: string | null = null
  let attempts = 0

  try {
    const { data: purchase, error } = await db
      .from('purchases')
      .select('*')
      .eq('id', purchaseId)
      .single()
    if (error) throw error

    eventId = purchase.event_id
    attempts = purchase.invoice_attempts

    const details = billingDetails(purchase)
    const grossHuf = grossForints(purchase)
    const paidAt = purchase.paid_at
    if (!paidAt) throw new Error(`Purchase ${purchase.id} has no paid_at`)
    const paymentDate = hungarianDate(paidAt)

    documentId = purchase.billingo_document_id

    // A previous attempt may have created the document and lost the answer.
    if (!documentId) {
      const existing = await getDocumentByVendorId(purchase.id)
      if (existing) {
        documentId = existing.id
        const { error: saveError } = await db
          .from('purchases')
          .update({
            billingo_document_id: existing.id,
            billingo_invoice_number: existing.invoice_number,
            invoice_issued_at:
              purchase.invoice_issued_at ?? new Date().toISOString(),
          })
          .eq('id', purchase.id)
        if (saveError) throw saveError
      }
    }

    let partnerId = purchase.billingo_partner_id
    if (!documentId && !partnerId) {
      partnerId = await createPartner(details)
      const { error: saveError } = await db
        .from('purchases')
        .update({ billingo_partner_id: partnerId })
        .eq('id', purchase.id)
      if (saveError) throw saveError
    }

    if (!documentId) {
      const document = await createInvoice({
        vendorId: purchase.id,
        partnerId: partnerId!,
        fulfillmentDate: paymentDate,
        grossHuf,
        orderNumber: purchase.id,
      })
      documentId = document.id

      const { error: saveError } = await db
        .from('purchases')
        .update({
          billingo_document_id: document.id,
          billingo_invoice_number: document.invoice_number,
          invoice_issued_at: new Date().toISOString(),
        })
        .eq('id', purchase.id)
      if (saveError) throw saveError
    }

    await setInvoicePayment({
      documentId,
      date: paymentDate,
      grossHuf,
      stripePaymentIntentId: purchase.stripe_payment_intent_id,
    })
    await sendDocument(documentId, details.email)

    const { error: finishError } = await db
      .from('purchases')
      .update({
        invoice_status: 'issued',
        invoice_last_error: null,
        invoice_next_attempt_at: null,
        invoice_sent_at: new Date().toISOString(),
      })
      .eq('id', purchase.id)
      .eq('status', 'paid')
      .eq('invoice_status', 'processing')
    if (finishError) throw finishError

    await reportServerEvent('invoice_issued', {
      event_id: eventId,
      attempts,
      source,
    })
    return 'issued'
  } catch (error) {
    const { data: current } = await db
      .from('purchases')
      .select('invoice_attempts, billingo_document_id')
      .eq('id', purchaseId)
      .maybeSingle()

    const billingoError = error instanceof BillingoError ? error : null
    // Told apart because they need different answers: a blocked subscription
    // is somebody buying more documents, a send failure means the invoice
    // exists and only the email is missing, and a plain failure means no
    // document was issued at all.
    const status = billingoError?.subscriptionBlocked
      ? 'blocked'
      : (documentId ?? current?.billingo_document_id)
        ? 'send_failed'
        : 'failed'
    const attemptCount = current?.invoice_attempts ?? attempts ?? 1

    await db
      .from('purchases')
      .update({
        invoice_status: status,
        invoice_last_error: String(error).slice(0, 4_000),
        invoice_next_attempt_at: retryAt(attemptCount),
      })
      .eq('id', purchaseId)
      .eq('status', 'paid')
      .eq('invoice_status', 'processing')

    await reportServerIssue(error, {
      operation: 'billingo_invoice',
      eventId,
    })
    await reportServerEvent('invoice_failed', {
      event_id: eventId,
      attempts: attemptCount,
      source,
      status,
      error: errorLabel(error),
    })
    return 'failed'
  }
}

/**
 * Creates and emails the Billingo storno document after a full refund.
 *
 * Also never throws, for the same reason. Unlike issuing, there is no
 * vendor-id probe to recover from a lost answer — Billingo will issue a second
 * storno for the same invoice — so the claim's lease is doing real work here.
 */
export async function cancelBillingoInvoice(
  db: AdminClient,
  purchaseId: string,
  source: InvoiceSource,
): Promise<CancellationOutcome> {
  let claimed = false

  try {
    const { data, error } = await db.rpc(
      'claim_purchase_invoice_cancellation',
      { p_purchase_id: purchaseId },
    )
    if (error) throw error
    claimed = data === true
  } catch (error) {
    await reportServerIssue(error, { operation: 'invoice_cancel_claim' })
    return 'failed'
  }

  if (!claimed) return 'skipped'

  let eventId: string | null = null

  try {
    const { data: purchase, error } = await db
      .from('purchases')
      .select('*')
      .eq('id', purchaseId)
      .single()
    if (error) throw error

    eventId = purchase.event_id
    let documentId = purchase.billingo_document_id

    if (!documentId) {
      const existing = await getDocumentByVendorId(purchase.id)
      if (existing) {
        documentId = existing.id
        const { error: saveError } = await db
          .from('purchases')
          .update({
            billingo_document_id: existing.id,
            billingo_invoice_number: existing.invoice_number,
            invoice_issued_at:
              purchase.invoice_issued_at ?? new Date().toISOString(),
          })
          .eq('id', purchase.id)
        if (saveError) throw saveError
      }
    }

    // Refunded before an invoice was ever issued. Nothing to cancel, and
    // nothing further to issue either — `claim_purchase_invoice` only claims
    // paid rows, so the refund has already taken this out of that queue.
    if (!documentId) {
      const { error: finishError } = await db
        .from('purchases')
        .update({
          invoice_status: 'cancelled',
          invoice_cancelled_at: new Date().toISOString(),
          invoice_last_error: null,
          invoice_next_attempt_at: null,
        })
        .eq('id', purchase.id)
      if (finishError) throw finishError

      await reportServerEvent('invoice_cancelled', {
        event_id: eventId,
        source,
      })
      return 'cancelled'
    }

    const details = billingDetails(purchase)
    const cancellation = await cancelDocument(documentId)
    await sendDocument(cancellation.id, details.email)

    const { error: saveError } = await db
      .from('purchases')
      .update({
        invoice_status: 'cancelled',
        billingo_cancellation_document_id: cancellation.id,
        invoice_cancelled_at: new Date().toISOString(),
        invoice_last_error: null,
        invoice_next_attempt_at: null,
      })
      .eq('id', purchase.id)
    if (saveError) throw saveError

    await reportServerEvent('invoice_cancelled', { event_id: eventId, source })
    return 'cancelled'
  } catch (error) {
    const { data: current } = await db
      .from('purchases')
      .select('invoice_attempts')
      .eq('id', purchaseId)
      .maybeSingle()
    const attemptCount = current?.invoice_attempts ?? 1

    await db
      .from('purchases')
      .update({
        invoice_last_error: String(error).slice(0, 4_000),
        invoice_next_attempt_at: retryAt(attemptCount),
        // Released rather than advanced: the lease is what the next attempt
        // waits on, and the row must stay in the cancellation queue.
        invoicing_started_at: null,
      })
      .eq('id', purchaseId)
      .eq('invoice_status', 'cancellation_pending')

    await reportServerIssue(error, {
      operation: 'billingo_cancel_invoice',
      eventId,
    })
    await reportServerEvent('invoice_failed', {
      event_id: eventId,
      attempts: attemptCount,
      source,
      status: 'send_failed',
      error: errorLabel(error),
    })
    return 'failed'
  }
}
