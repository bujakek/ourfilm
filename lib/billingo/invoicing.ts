import 'server-only'

import type { BillingDetails } from '@/lib/billing-details'
import { HUF_MINOR_PER_FORINT } from '@/lib/billing'
import type { Database } from '@/lib/supabase/database.types'
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

const BUDAPEST_TIME_ZONE = 'Europe/Budapest'

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
    throw new Error(`Purchase ${purchase.id} is outside the Hungarian pilot`)
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

function grossForints(purchase: Purchase): number {
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
  const minutes = Math.min(2 ** Math.max(attempts - 1, 0), 60)
  return new Date(Date.now() + minutes * 60_000).toISOString()
}

/**
 * Ensures exactly one Billingo invoice exists for a paid purchase.
 *
 * The database claim serialises concurrent webhook deliveries. Billingo's
 * vendor-id lookup closes the harder gap: Billingo may have created a document
 * even when our HTTP request timed out before its response reached Vercel.
 */
export async function ensureBillingoInvoice(
  db: AdminClient,
  purchaseId: string,
): Promise<void> {
  const { data: claimed, error: claimError } = await db.rpc(
    'claim_purchase_invoice',
    { p_purchase_id: purchaseId },
  )
  if (claimError) throw claimError
  if (!claimed) return

  let documentId: number | null = null

  try {
    const { data: purchase, error } = await db
      .from('purchases')
      .select('*')
      .eq('id', purchaseId)
      .single()
    if (error) throw error

    const details = billingDetails(purchase)
    const grossHuf = grossForints(purchase)
    const paidAt = purchase.paid_at
    if (!paidAt) throw new Error(`Purchase ${purchase.id} has no paid_at`)
    const paymentDate = hungarianDate(paidAt)

    documentId = purchase.billingo_document_id

    if (!documentId) {
      const existing = await getDocumentByVendorId(purchase.id)
      if (existing) {
        documentId = existing.id
        const { error: saveError } = await db
          .from('purchases')
          .update({
            billingo_document_id: existing.id,
            billingo_invoice_number: existing.invoice_number,
            invoice_issued_at: new Date().toISOString(),
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

    const now = new Date().toISOString()
    const { error: finishError } = await db
      .from('purchases')
      .update({
        invoice_status: 'issued',
        invoice_last_error: null,
        invoice_next_attempt_at: null,
        invoice_sent_at: now,
      })
      .eq('id', purchase.id)
      .eq('status', 'paid')
      .eq('invoice_status', 'processing')
    if (finishError) throw finishError
  } catch (error) {
    const { data: current } = await db
      .from('purchases')
      .select('invoice_attempts, billingo_document_id')
      .eq('id', purchaseId)
      .maybeSingle()

    const billingoError = error instanceof BillingoError ? error : null
    const status = billingoError?.subscriptionBlocked
      ? 'blocked'
      : documentId || current?.billingo_document_id
        ? 'send_failed'
        : 'failed'

    await db
      .from('purchases')
      .update({
        invoice_status: status,
        invoice_last_error: String(error).slice(0, 4_000),
        invoice_next_attempt_at: retryAt(current?.invoice_attempts ?? 1),
      })
      .eq('id', purchaseId)
      .eq('status', 'paid')
      .eq('invoice_status', 'processing')

    throw error
  }
}

/** Creates and emails the Billingo cancellation document after a full refund. */
export async function cancelBillingoInvoice(
  db: AdminClient,
  purchaseId: string,
): Promise<void> {
  const { data: purchase, error } = await db
    .from('purchases')
    .select('*')
    .eq('id', purchaseId)
    .single()
  if (error) throw error
  if (purchase.invoice_status === 'cancelled') return
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

  if (!documentId) {
    const invoicingStillRunning =
      purchase.invoice_status === 'processing' &&
      purchase.invoicing_started_at !== null &&
      Date.now() - new Date(purchase.invoicing_started_at).getTime() <
        10 * 60_000

    // Do not race a worker between its vendor-id lookup and document creation.
    // Stripe will retry the refund after that worker has saved the document id.
    if (invoicingStillRunning) {
      throw new Error(`Purchase ${purchase.id} is still creating its invoice`)
    }

    const { error: finishError } = await db
      .from('purchases')
      .update({
        invoice_status: 'cancelled',
        invoice_cancelled_at: new Date().toISOString(),
        invoice_last_error: null,
      })
      .eq('id', purchase.id)
    if (finishError) throw finishError
    return
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
    })
    .eq('id', purchase.id)
  if (saveError) throw saveError
}
