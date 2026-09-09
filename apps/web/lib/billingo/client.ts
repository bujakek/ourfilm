import 'server-only'

import type { BillingDetails } from '@/lib/billing-details'

import { billingoEnv } from './env'

/**
 * Long enough for Billingo to answer, short enough that a hung request does
 * not hold a Vercel function open behind a Stripe webhook that is itself on a
 * clock. A timeout is not a failure to issue — see `getDocumentByVendorId`.
 */
const REQUEST_TIMEOUT_MS = 7_000

export class BillingoError extends Error {
  constructor(
    readonly status: number | null,
    readonly detail: string,
    options?: ErrorOptions,
  ) {
    super(
      status === null
        ? `Billingo network error: ${detail}`
        : `Billingo ${status}: ${detail}`,
      options,
    )
    this.name = 'BillingoError'
  }

  /** Worth another attempt: the request never landed, or Billingo faltered. */
  get retryable() {
    return (
      this.status === null || this.status === 429 || (this.status ?? 0) >= 500
    )
  }

  /**
   * 402: the Billingo subscription cannot issue another document this month.
   * Distinct from a failure because no amount of retrying inside the hour
   * fixes it — somebody has to buy more documents. Cancellations consume the
   * quota too.
   */
  get subscriptionBlocked() {
    return this.status === 402
  }
}

export type BillingoDocument = {
  id: number
  invoice_number: string
}

async function request<T>(
  path: string,
  options: { method?: string; body?: unknown; allowNotFound?: boolean } = {},
): Promise<T | null> {
  const env = billingoEnv()
  let response: Response

  try {
    response = await fetch(`${env.baseUrl}${path}`, {
      method: options.method ?? 'GET',
      headers: {
        'X-API-KEY': env.apiKey,
        Accept: 'application/json',
        ...(options.body === undefined
          ? {}
          : { 'Content-Type': 'application/json' }),
      },
      body:
        options.body === undefined ? undefined : JSON.stringify(options.body),
      cache: 'no-store',
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    })
  } catch (error) {
    throw new BillingoError(
      null,
      error instanceof Error ? error.message : 'request failed',
      { cause: error },
    )
  }

  if (response.status === 404 && options.allowNotFound) return null

  if (!response.ok) {
    const detail = await response.text().catch(() => response.statusText)
    throw new BillingoError(response.status, detail || response.statusText)
  }

  if (response.status === 204) return null
  return (await response.json()) as T
}

/**
 * The idempotency probe, and the reason `vendor_id` carries `purchases.id`.
 *
 * A `POST /documents` that times out may still have created the document, and
 * a Hungarian invoice cannot be un-issued — only cancelled with a second
 * document. So every attempt asks Billingo whether it already did the thing
 * before doing it again.
 */
export async function getDocumentByVendorId(
  vendorId: string,
): Promise<BillingoDocument | null> {
  return request<BillingoDocument>(
    `/documents/vendor/${encodeURIComponent(vendorId)}`,
    { allowNotFound: true },
  )
}

export async function createPartner(details: BillingDetails): Promise<number> {
  const partner = await request<{ id: number }>('/partners', {
    method: 'POST',
    body: {
      name: details.name,
      address: {
        country_code: details.countryCode,
        post_code: details.postCode,
        city: details.city,
        address: details.address,
      },
      emails: [details.email],
      tax_type: details.type === 'company' ? 'HAS_TAX_NUMBER' : 'NO_TAX_NUMBER',
      ...(details.type === 'company' ? { taxcode: details.taxNumber } : {}),
    },
  })

  if (!partner) throw new BillingoError(null, 'partner response was empty')
  return partner.id
}

/**
 * Issues the invoice itself.
 *
 * `vat: 'AAM'` with the matching NAV entitlement code is alanyi adómentesség:
 * the price contains no VAT and none is reclaimable. It has to agree with the
 * ÁFA digit of the seller's own tax number and with what `/hu/aszf` and
 * `/hu/arak` tell the buyer. If the exemption threshold is ever crossed this
 * pair becomes `'27%'` and all three change together.
 *
 * `unit_price_type: 'gross'` because 12 900 Ft is the advertised price; the
 * price is the gross, and Billingo derives nothing else under AAM.
 */
export async function createInvoice(input: {
  vendorId: string
  partnerId: number
  fulfillmentDate: string
  grossHuf: number
  orderNumber: string
}): Promise<BillingoDocument> {
  const env = billingoEnv()
  const document = await request<BillingoDocument>('/documents', {
    method: 'POST',
    body: {
      vendor_id: input.vendorId,
      partner_id: input.partnerId,
      block_id: env.blockId,
      bank_account_id: env.bankAccountId,
      type: 'invoice',
      fulfillment_date: input.fulfillmentDate,
      due_date: input.fulfillmentDate,
      payment_method: 'online_bankcard',
      language: 'hu',
      currency: 'HUF',
      conversion_rate: 1,
      electronic: true,
      paid: false,
      items: [
        {
          name: 'OurFilm teljes eseménycsomag',
          unit_price: input.grossHuf,
          unit_price_type: 'gross',
          quantity: 1,
          unit: 'db',
          vat: 'AAM',
          entitlement: 'AAM',
        },
      ],
      comment: `OurFilm rendelés: ${input.orderNumber}`,
      settings: {
        mediated_service: false,
        without_financial_fulfillment: false,
        round: 'none',
        order_number: input.orderNumber,
      },
    },
  })

  if (!document) throw new BillingoError(null, 'document response was empty')
  return document
}

/**
 * Records the money against the document.
 *
 * The invoice is created unpaid and settled in a second call so the payment
 * carries its own date and the Stripe PaymentIntent as the voucher number —
 * which is what makes a Billingo document and a Stripe payment reconcilable
 * from either end.
 */
export async function setInvoicePayment(input: {
  documentId: number
  date: string
  grossHuf: number
  stripePaymentIntentId: string | null
}) {
  await request(`/documents/${input.documentId}/payments`, {
    method: 'PUT',
    body: [
      {
        date: input.date,
        price: input.grossHuf,
        payment_method: 'online_bankcard',
        ...(input.stripePaymentIntentId
          ? { voucher_number: input.stripePaymentIntentId }
          : {}),
      },
    ],
  })
}

export async function sendDocument(documentId: number, email: string) {
  await request(`/documents/${documentId}/send`, {
    method: 'POST',
    body: { emails: [email] },
  })
}

/** A storno document. An issued Hungarian invoice is never deleted. */
export async function cancelDocument(
  documentId: number,
): Promise<BillingoDocument> {
  const document = await request<BillingoDocument>(
    `/documents/${documentId}/cancel`,
    {
      method: 'POST',
      body: { comment: 'Teljes Stripe-visszatérítés' },
    },
  )

  if (!document) {
    throw new BillingoError(null, 'cancellation response was empty')
  }
  return document
}
