import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  getDocumentByVendorId: vi.fn(),
  createPartner: vi.fn(),
  createInvoice: vi.fn(),
  setInvoicePayment: vi.fn(),
  sendDocument: vi.fn(),
  cancelDocument: vi.fn(),
  reportServerEvent:
    vi.fn<(event: string, properties: unknown) => Promise<void>>(),
  reportServerIssue:
    vi.fn<(error: unknown, context: unknown) => Promise<void>>(),
}))

vi.mock('@/lib/billingo/client', async () => {
  const actual = await vi.importActual<typeof import('@/lib/billingo/client')>(
    '@/lib/billingo/client',
  )
  return { ...actual, ...mocks }
})

vi.mock('@/lib/telemetry-server', () => ({
  reportServerEvent: mocks.reportServerEvent,
  reportServerIssue: mocks.reportServerIssue,
}))

import { BillingoError } from '@/lib/billingo/client'
import {
  cancelBillingoInvoice,
  ensureBillingoInvoice,
} from '@/lib/billingo/invoicing'

const PURCHASE_ID = '52f89c12-f4a7-463b-98d7-7fe57450a89c'

function purchaseRow(overrides: Record<string, unknown> = {}) {
  return {
    id: PURCHASE_ID,
    event_id: '113020ae-2ad3-4296-977e-42f173b662a3',
    settlement: 'direct',
    status: 'paid',
    invoice_status: 'processing',
    invoice_attempts: 1,
    amount_minor: 1_290_000,
    currency: 'huf',
    paid_at: '2026-09-01T12:05:00.000Z',
    stripe_payment_intent_id: 'pi_test',
    billingo_partner_id: null,
    billingo_document_id: null,
    invoice_issued_at: null,
    billing_type: 'individual',
    billing_name: 'Kovács Anna',
    billing_email: 'host@example.com',
    billing_country_code: 'HU',
    billing_post_code: '1039',
    billing_city: 'Budapest',
    billing_address: 'Juhász Gyula utca 2.',
    billing_tax_number: null,
    ...overrides,
  }
}

function database({
  claimed = true,
  purchase = purchaseRow(),
}: { claimed?: boolean; purchase?: Record<string, unknown> } = {}) {
  const updates: Record<string, unknown>[] = []

  function query(values: Record<string, unknown> | null) {
    const builder = {
      eq: () => builder,
      maybeSingle: async () => {
        if (values) updates.push(values)
        return { data: purchase, error: null }
      },
      single: async () => {
        if (values) updates.push(values)
        return { data: purchase, error: null }
      },
      then: (resolve: (result: { error: null }) => unknown) => {
        if (values) updates.push(values)
        return resolve({ error: null })
      },
    }
    return builder
  }

  const db = {
    rpc: vi.fn(async () => ({ data: claimed, error: null })),
    from: () => ({
      select: () => query(null),
      update: (values: Record<string, unknown>) => query(values),
    }),
  }

  return { db: db as never, updates, rpc: db.rpc }
}

describe('ensureBillingoInvoice', () => {
  beforeEach(() => {
    for (const mock of Object.values(mocks)) mock.mockReset()
    mocks.reportServerEvent.mockResolvedValue(undefined)
    mocks.reportServerIssue.mockResolvedValue(undefined)
    mocks.getDocumentByVendorId.mockResolvedValue(null)
    mocks.createPartner.mockResolvedValue(9)
    mocks.createInvoice.mockResolvedValue({
      id: 55,
      invoice_number: 'OF-2026-1',
    })
    mocks.setInvoicePayment.mockResolvedValue(undefined)
    mocks.sendDocument.mockResolvedValue(undefined)
  })

  it('issues, settles and emails one invoice', async () => {
    const { db, updates } = database()

    expect(await ensureBillingoInvoice(db, PURCHASE_ID, 'webhook')).toBe(
      'issued',
    )

    expect(mocks.createInvoice).toHaveBeenCalledWith(
      expect.objectContaining({
        vendorId: PURCHASE_ID,
        partnerId: 9,
        grossHuf: 12_900,
        // The Hungarian calendar day of the payment, not the UTC one Vercel
        // would otherwise report.
        fulfillmentDate: '2026-09-01',
      }),
    )
    expect(mocks.sendDocument).toHaveBeenCalledWith(55, 'host@example.com')
    expect(updates).toContainEqual(
      expect.objectContaining({ invoice_status: 'issued' }),
    )
  })

  it('does nothing when another caller holds the lease', async () => {
    const { db } = database({ claimed: false })

    // The webhook and the sweep race constantly. Losing that race is not a
    // failure and must not be reported as one.
    expect(await ensureBillingoInvoice(db, PURCHASE_ID, 'sweep')).toBe(
      'skipped',
    )
    expect(mocks.createInvoice).not.toHaveBeenCalled()
    expect(mocks.reportServerEvent).not.toHaveBeenCalled()
  })

  it('adopts a document a timed-out attempt already created', async () => {
    mocks.getDocumentByVendorId.mockResolvedValue({
      id: 71,
      invoice_number: 'OF-2026-9',
    })
    const { db } = database()

    expect(await ensureBillingoInvoice(db, PURCHASE_ID, 'sweep')).toBe('issued')

    // The whole reason `vendor_id` carries the purchase id: an issued
    // Hungarian invoice cannot be withdrawn, so a second one is not a
    // retryable mistake.
    expect(mocks.createInvoice).not.toHaveBeenCalled()
    expect(mocks.createPartner).not.toHaveBeenCalled()
    expect(mocks.sendDocument).toHaveBeenCalledWith(71, 'host@example.com')
  })

  it('never throws, and leaves the row retryable', async () => {
    mocks.createInvoice.mockRejectedValue(new BillingoError(503, 'down'))
    const { db, updates } = database()

    // Throwing here would 500 the Stripe webhook over a Billingo outage,
    // leaving `processed_at` null and re-running the payment handler.
    expect(await ensureBillingoInvoice(db, PURCHASE_ID, 'webhook')).toBe(
      'failed',
    )
    expect(updates).toContainEqual(
      expect.objectContaining({
        invoice_status: 'failed',
        invoice_next_attempt_at: expect.any(String),
      }),
    )
  })

  it('tells a blocked subscription from an ordinary failure', async () => {
    mocks.createInvoice.mockRejectedValue(new BillingoError(402, 'no quota'))
    const { db, updates } = database()

    await ensureBillingoInvoice(db, PURCHASE_ID, 'sweep')

    expect(updates).toContainEqual(
      expect.objectContaining({ invoice_status: 'blocked' }),
    )
    expect(mocks.reportServerEvent).toHaveBeenCalledWith(
      'invoice_failed',
      expect.objectContaining({
        status: 'blocked',
        error: 'BillingoError:402',
      }),
    )
  })

  it('records a failed email as send_failed, not as no invoice', async () => {
    mocks.sendDocument.mockRejectedValue(new BillingoError(500, 'mail down'))
    const { db, updates } = database()

    await ensureBillingoInvoice(db, PURCHASE_ID, 'webhook')

    // The document exists and is reported to NAV. Only the email is missing,
    // and the retry must not try to issue a second invoice.
    expect(updates).toContainEqual(
      expect.objectContaining({ invoice_status: 'send_failed' }),
    )
  })

  it('refuses a Managed Payments purchase instead of failing on its currency', async () => {
    const { db } = database({
      purchase: purchaseRow({ settlement: 'managed', currency: 'usd' }),
    })

    expect(await ensureBillingoInvoice(db, PURCHASE_ID, 'sweep')).toBe('failed')
    // Link issues that document. Raising one here would put a second in front
    // of a customer who already has one.
    expect(mocks.createInvoice).not.toHaveBeenCalled()
  })

  it('reports no invoice number or email to PostHog', async () => {
    const { db } = database()

    await ensureBillingoInvoice(db, PURCHASE_ID, 'webhook')

    const call = mocks.reportServerEvent.mock.calls[0]
    expect(call?.[0]).toBe('invoice_issued')
    expect(call?.[1]).toEqual({
      event_id: purchaseRow().event_id,
      attempts: 1,
      source: 'webhook',
    })
  })
})

describe('cancelBillingoInvoice', () => {
  beforeEach(() => {
    for (const mock of Object.values(mocks)) mock.mockReset()
    mocks.reportServerEvent.mockResolvedValue(undefined)
    mocks.reportServerIssue.mockResolvedValue(undefined)
    mocks.getDocumentByVendorId.mockResolvedValue(null)
    mocks.cancelDocument.mockResolvedValue({
      id: 56,
      invoice_number: 'OF-2026-1-S',
    })
    mocks.sendDocument.mockResolvedValue(undefined)
  })

  it('storns the invoice and emails the cancellation', async () => {
    const { db, updates } = database({
      purchase: purchaseRow({
        status: 'refunded',
        invoice_status: 'cancellation_pending',
        billingo_document_id: 55,
      }),
    })

    expect(await cancelBillingoInvoice(db, PURCHASE_ID, 'webhook')).toBe(
      'cancelled',
    )
    expect(mocks.cancelDocument).toHaveBeenCalledWith(55)
    expect(updates).toContainEqual(
      expect.objectContaining({
        invoice_status: 'cancelled',
        billingo_cancellation_document_id: 56,
      }),
    )
  })

  it('closes out a refund that never had an invoice', async () => {
    const { db, updates } = database({
      purchase: purchaseRow({
        status: 'refunded',
        invoice_status: 'cancellation_pending',
      }),
    })

    expect(await cancelBillingoInvoice(db, PURCHASE_ID, 'sweep')).toBe(
      'cancelled',
    )
    expect(mocks.cancelDocument).not.toHaveBeenCalled()
    expect(updates).toContainEqual(
      expect.objectContaining({ invoice_status: 'cancelled' }),
    )
  })

  it('releases the lease when the storno fails', async () => {
    mocks.cancelDocument.mockRejectedValue(new BillingoError(500, 'down'))
    const { db, updates } = database({
      purchase: purchaseRow({
        status: 'refunded',
        invoice_status: 'cancellation_pending',
        billingo_document_id: 55,
      }),
    })

    expect(await cancelBillingoInvoice(db, PURCHASE_ID, 'sweep')).toBe('failed')
    // The row has to stay in the cancellation queue, and the next attempt
    // waits on the lease rather than on the status.
    expect(updates).toContainEqual(
      expect.objectContaining({
        invoicing_started_at: null,
        invoice_next_attempt_at: expect.any(String),
      }),
    )
  })

  it('does not storn twice when another caller holds the lease', async () => {
    const { db } = database({ claimed: false })

    expect(await cancelBillingoInvoice(db, PURCHASE_ID, 'webhook')).toBe(
      'skipped',
    )
    // There is no vendor-id probe for a cancellation, so the lease is the only
    // thing standing between two refund deliveries and two storno documents.
    expect(mocks.cancelDocument).not.toHaveBeenCalled()
  })
})
