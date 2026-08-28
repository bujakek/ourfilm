import { describe, expect, it } from 'vitest'
import type Stripe from 'stripe'

import { billingDetailsFromStripeSession } from '@/lib/billing-details'

function session(
  customerOverrides: Partial<Stripe.Checkout.Session.CustomerDetails> = {},
): Stripe.Checkout.Session {
  return {
    customer_email: 'teszt@example.com',
    customer_details: {
      address: {
        city: 'Budapest',
        country: 'HU',
        line1: 'Példa utca 12.',
        line2: null,
        postal_code: '1111',
        state: null,
      },
      business_name: null,
      email: 'teszt@example.com',
      individual_name: null,
      name: 'Teszt Elek',
      phone: null,
      tax_exempt: 'none',
      tax_ids: [],
      ...customerOverrides,
    },
  } as Stripe.Checkout.Session
}

describe('billing details', () => {
  it('parses a Hungarian individual invoice address from Stripe', () => {
    expect(billingDetailsFromStripeSession(session())).toEqual({
      success: true,
      data: {
        type: 'individual',
        name: 'Teszt Elek',
        email: 'teszt@example.com',
        countryCode: 'HU',
        postCode: '1111',
        city: 'Budapest',
        address: 'Példa utca 12.',
        taxNumber: null,
      },
    })
  })

  it("normalizes Stripe's Hungarian company tax ID", () => {
    const result = billingDetailsFromStripeSession(
      session({
        business_name: 'Példa Kft.',
        tax_ids: [{ type: 'hu_tin', value: '12345678142' }],
      }),
    )

    expect(result).toEqual({
      success: true,
      data: {
        type: 'company',
        name: 'Példa Kft.',
        email: 'teszt@example.com',
        countryCode: 'HU',
        postCode: '1111',
        city: 'Budapest',
        address: 'Példa utca 12.',
        taxNumber: '12345678-1-42',
      },
    })
  })

  it('joins the two Stripe address lines', () => {
    const result = billingDetailsFromStripeSession(
      session({
        address: {
          city: 'Budapest',
          country: 'HU',
          line1: 'Példa utca 12.',
          line2: '2. emelet',
          postal_code: '1111',
          state: null,
        },
      }),
    )

    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.address).toBe('Példa utca 12., 2. emelet')
    }
  })

  it('rejects a non-Hungarian invoice address for the pilot', () => {
    const result = billingDetailsFromStripeSession(
      session({
        address: {
          city: 'Wien',
          country: 'AT',
          line1: 'Beispielgasse 1',
          line2: null,
          postal_code: '1010',
          state: null,
        },
      }),
    )

    expect(result.success).toBe(false)
    if (!result.success) expect(result.error).toContain('nem magyar')
  })
})
