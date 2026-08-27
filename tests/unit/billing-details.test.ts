import { describe, expect, it } from 'vitest'

import { parseBillingDetails } from '@/lib/billing-details'

function form(overrides: Record<string, string> = {}) {
  const values = {
    billing_type: 'individual',
    billing_name: 'Teszt Elek',
    billing_email: 'teszt@example.com',
    billing_post_code: '1111',
    billing_city: 'Budapest',
    billing_address: 'Példa utca 12.',
    ...overrides,
  }
  const data = new FormData()
  for (const [key, value] of Object.entries(values)) data.set(key, value)
  return data
}

describe('billing details', () => {
  it('parses a Hungarian individual invoice address', () => {
    expect(parseBillingDetails(form())).toEqual({
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

  it('requires a full domestic tax number for company invoices', () => {
    const result = parseBillingDetails(
      form({ billing_type: 'company', billing_tax_number: 'HU12345678' }),
    )

    expect(result.success).toBe(false)
    if (!result.success) expect(result.error).toContain('12345678-1-42')
  })

  it('accepts a company with a full Hungarian tax number', () => {
    const result = parseBillingDetails(
      form({
        billing_type: 'company',
        billing_name: 'Példa Kft.',
        billing_tax_number: '12345678-1-42',
      }),
    )

    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.taxNumber).toBe('12345678-1-42')
      expect(result.data.type).toBe('company')
    }
  })
})
