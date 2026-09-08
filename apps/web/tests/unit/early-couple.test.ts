import { describe, expect, it } from 'vitest'

import sitemap from '@/app/sitemap'
import { parseEarlyCoupleApplication } from '@/lib/early-couple'
import { canonicalUrl } from '@/lib/seo'

const now = new Date('2026-08-31T12:00:00Z')

function validForm() {
  const form = new FormData()
  form.set('name', '  Anna  ')
  form.set('partnerName', '  Bence  ')
  form.set('email', ' ANNA@EXAMPLE.COM ')
  form.set('weddingDate', '2026-10-10')
  form.set('weddingLocation', ' Budapest, Hungary ')
  form.set('guestCountRange', '101-150')
  form.set(
    'whyInterested',
    'We love the idea of giving every guest a small roll.',
  )
  form.set('locale', 'en')
  form.set('agreementAccepted', 'accepted')
  form.set('website', '')
  form.set('utmSource', 'instagram')
  form.set('utmMedium', '')
  form.set('utmCampaign', '')
  form.set('utmContent', '')
  form.set('utmTerm', '')
  return form
}

describe('Early Couple applications', () => {
  it('keeps the direct-outreach page out of the sitemap', () => {
    const urls = sitemap().map((entry) => entry.url)
    expect(urls).not.toContain(canonicalUrl('/en/early-couple-program'))
    expect(urls).not.toContain(canonicalUrl('/hu/early-couple-program'))
  })

  it('normalises the fields the database relies on', () => {
    const parsed = parseEarlyCoupleApplication(validForm(), now)

    expect(parsed).toEqual({
      ok: true,
      application: {
        name: 'Anna',
        partnerName: 'Bence',
        email: 'anna@example.com',
        weddingDate: '2026-10-10',
        weddingLocation: 'Budapest, Hungary',
        guestCountRange: '101-150',
        whyInterested: 'We love the idea of giving every guest a small roll.',
        locale: 'en',
        utmSource: 'instagram',
        utmMedium: '',
        utmCampaign: '',
        utmContent: '',
        utmTerm: '',
      },
    })
  })

  it('stores no placeholder when the partner name is omitted', () => {
    const form = validForm()
    form.set('partnerName', ' ')

    const parsed = parseEarlyCoupleApplication(form, now)
    expect(parsed.ok && parsed.application.partnerName).toBeNull()
  })

  it('refuses a wedding date that already passed', () => {
    const form = validForm()
    form.set('weddingDate', '2026-08-30')

    expect(parseEarlyCoupleApplication(form, now)).toEqual({
      ok: false,
      reason: 'past_date',
    })
  })

  it('refuses a calendar date that does not exist', () => {
    const form = validForm()
    form.set('weddingDate', '2027-02-30')

    expect(parseEarlyCoupleApplication(form, now)).toEqual({
      ok: false,
      reason: 'invalid',
    })
  })

  it('requires the two-call agreement', () => {
    const form = validForm()
    form.delete('agreementAccepted')

    expect(parseEarlyCoupleApplication(form, now)).toEqual({
      ok: false,
      reason: 'invalid',
    })
  })

  it('quietly identifies a filled honeypot', () => {
    const form = new FormData()
    form.set('website', 'https://spam.example')

    expect(parseEarlyCoupleApplication(form, now)).toEqual({
      ok: false,
      reason: 'bot',
    })
  })
})
