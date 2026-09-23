import {
  EVENT_PRICE_AMOUNTS,
  EVENT_PRICE_CURRENCIES,
  EVENT_PRICE_LABELS,
  eventPriceLabel,
} from '@/lib/pricing'
import { locales } from '@/lib/i18n'
import { describe, expect, it } from 'vitest'

/**
 * The price is now stated twice — once as the line a host reads and once as the
 * number an answer engine quotes out of the `Offer` on `/arak`. Two renderings
 * of one fact drift silently, and the half that drifts is always the one nobody
 * looks at, so the agreement is pinned here rather than trusted.
 */
describe('the event price', () => {
  it('spells the same amount in the label and in the structured data', () => {
    for (const locale of locales) {
      const digits = EVENT_PRICE_LABELS[locale].replace(/[^\d]/g, '')
      expect(digits, locale).toBe(String(EVENT_PRICE_AMOUNTS[locale]))
    }
  })

  it('quotes a different currency per locale', () => {
    // The whole reason both maps are keyed on the locale: a Hungarian page
    // quoting dollars, or an English one quoting forints, is the failure this
    // product can make while every string on the screen looks correct.
    expect(EVENT_PRICE_CURRENCIES.hu).toBe('HUF')
    expect(EVENT_PRICE_CURRENCIES.en).toBe('USD')
    expect(new Set(Object.values(EVENT_PRICE_CURRENCIES)).size).toBe(
      locales.length,
    )
  })

  it('names an ISO 4217 code, not a symbol', () => {
    for (const locale of locales) {
      expect(EVENT_PRICE_CURRENCIES[locale], locale).toMatch(/^[A-Z]{3}$/)
    }
  })

  it('charges a positive amount everywhere', () => {
    for (const locale of locales) {
      expect(EVENT_PRICE_AMOUNTS[locale], locale).toBeGreaterThan(0)
      expect(eventPriceLabel(locale), locale).not.toBe('')
    }
  })
})
