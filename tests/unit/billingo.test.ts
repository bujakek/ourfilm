import { afterEach, describe, expect, it, vi } from 'vitest'

import { createInvoice, createPartner } from '@/lib/billingo/client'
import { hungarianDate } from '@/lib/billingo/invoicing'

afterEach(() => {
  vi.restoreAllMocks()
  vi.unstubAllEnvs()
})

function configureBillingo() {
  vi.stubEnv('BILLINGO_API_KEY', 'test-key')
  vi.stubEnv('BILLINGO_BLOCK_ID', '12')
  vi.stubEnv('BILLINGO_BANK_ACCOUNT_ID', '34')
}

describe('Billingo invoicing', () => {
  it('uses the Hungarian calendar date around UTC midnight', () => {
    expect(hungarianDate('2026-08-27T22:30:00.000Z')).toBe('2026-08-28')
  })

  it('creates an AAM invoice with a recoverable vendor id', async () => {
    configureBillingo()
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({ id: 55, invoice_number: 'OF-2026-1' }), {
        status: 201,
        headers: { 'Content-Type': 'application/json' },
      }),
    )

    await createInvoice({
      vendorId: 'purchase-id',
      partnerId: 9,
      fulfillmentDate: '2026-08-27',
      grossHuf: 12_900,
      orderNumber: 'purchase-id',
    })

    const init = fetchMock.mock.calls[0]?.[1]
    const body = JSON.parse(String(init?.body))
    expect(body).toMatchObject({
      vendor_id: 'purchase-id',
      partner_id: 9,
      block_id: 12,
      bank_account_id: 34,
      type: 'invoice',
      payment_method: 'online_bankcard',
      paid: false,
      items: [
        {
          unit_price: 12_900,
          unit_price_type: 'gross',
          vat: 'AAM',
          entitlement: 'AAM',
        },
      ],
      settings: { round: 'none', order_number: 'purchase-id' },
    })
    expect(body.settings).not.toHaveProperty('online_payment')
  })

  it('sends the domestic tax type and number for a company', async () => {
    configureBillingo()
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({ id: 77 }), {
        status: 201,
        headers: { 'Content-Type': 'application/json' },
      }),
    )

    await createPartner({
      type: 'company',
      name: 'Példa Kft.',
      email: 'szamla@example.com',
      countryCode: 'HU',
      postCode: '1111',
      city: 'Budapest',
      address: 'Példa utca 12.',
      taxNumber: '12345678-1-42',
    })

    const body = JSON.parse(String(fetchMock.mock.calls[0]?.[1]?.body))
    expect(body).toMatchObject({
      name: 'Példa Kft.',
      tax_type: 'HAS_TAX_NUMBER',
      taxcode: '12345678-1-42',
    })
  })
})
