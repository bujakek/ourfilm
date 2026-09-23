import { marketingCopy } from '@/lib/marketing-copy'
import { occasionCopy, occasions } from '@/lib/occasions'
import { locales, localePath, localeTag } from '@/lib/i18n'
import { EVENT_PRICE_AMOUNTS, EVENT_PRICE_CURRENCIES } from '@/lib/pricing'
import {
  canonicalUrl,
  eventProductJsonLd,
  faqJsonLd,
  faqPairs,
  organizationJsonLd,
  webSiteJsonLd,
} from '@/lib/seo'
import { CONTACT_EMAIL, INSTAGRAM_URL, SITE_URL, TIKTOK_URL } from '@/lib/site'
import { describe, expect, it } from 'vitest'

/**
 * Structured data for the pages that are written by hand rather than read out
 * of `content/`.
 *
 * `content-seo.test.ts` covers the content pack. These are the pages that had
 * none at all: every article on the site described itself to a crawler while
 * the homepage and the pricing page — the two that actually have to rank —
 * described nothing.
 */
describe('the organization node', () => {
  const org = organizationJsonLd()

  it('gives itself the id every other node references', () => {
    expect(org['@id']).toBe(`${SITE_URL}/#organization`)
    expect(org['@type']).toBe('Organization')
  })

  it('names the profiles that tie the brand to accounts a crawler can see', () => {
    expect(org.sameAs).toContain(INSTAGRAM_URL)
    expect(org.sameAs).toContain(TIKTOK_URL)
    expect(org.email).toBe(CONTACT_EMAIL)
  })

  it('claims no rating and no review', () => {
    // The homepage renders testimonials that are not verified named reviews.
    // Marking them up as if they were is the fastest route to a manual action,
    // which is the same rule `contentJsonLd` already keeps.
    const json = JSON.stringify(org)
    expect(json).not.toContain('aggregateRating')
    expect(json).not.toContain('"review"')
  })

  it('points logo at nothing rather than at a photograph', () => {
    // There is no logo asset yet, and `og-cover.jpg` is a wedding picture.
    // Emitting it as `logo` would put the wrong image in a knowledge panel.
    expect(org).not.toHaveProperty('logo')
  })
})

describe('the website node', () => {
  it('declares the language of the homepage it sits on', () => {
    for (const locale of locales) {
      const site = webSiteJsonLd(locale)
      expect(site.inLanguage, locale).toBe(localeTag[locale])
      expect(site.url, locale).toBe(canonicalUrl(localePath(locale, '/')))
    }
  })

  it('credits the one shared organization', () => {
    for (const locale of locales) {
      expect(webSiteJsonLd(locale).publisher['@id']).toBe(
        organizationJsonLd()['@id'],
      )
    }
  })

  it('promises no search endpoint', () => {
    // There is no site search. A declared `SearchAction` that 404s is a promise
    // to a crawler we cannot keep.
    for (const locale of locales) {
      expect(JSON.stringify(webSiteJsonLd(locale))).not.toContain(
        'potentialAction',
      )
    }
  })
})

describe('the marketing FAQ schema', () => {
  it('describes every question the homepage asks in the open', () => {
    for (const locale of locales) {
      const items = marketingCopy[locale].faq.items
      const faq = faqJsonLd(faqPairs(items))

      expect(faq, locale).not.toBeNull()
      expect(faq?.mainEntity).toHaveLength(items.length)

      for (const [question, answer] of items) {
        const entry = faq?.mainEntity.find((node) => node.name === question)
        expect(entry, `${locale}: ${question}`).toBeDefined()
        expect(entry?.acceptedAnswer.text).toBe(answer)
      }
    }
  })

  it('describes every question an occasion page asks', () => {
    for (const locale of locales) {
      for (const occasion of occasions) {
        const copy = occasionCopy(locale, occasion)
        const faq = faqJsonLd(faqPairs(copy.faq))
        expect(faq?.mainEntity, `${locale}/${occasion.id}`).toHaveLength(
          copy.faq.length,
        )
      }
    }
  })

  it('drops a row that is not a question and an answer', () => {
    // Rather than letting `undefined` reach `acceptedAnswer`, which would be a
    // question the schema promises and the page never answers.
    expect(faqPairs([['only a question']])).toEqual([])
    expect(faqPairs([[]])).toEqual([])
    expect(faqJsonLd(faqPairs([]))).toBeNull()
  })
})

describe('the pricing offer', () => {
  it('quotes the locale’s own amount and currency', () => {
    for (const locale of locales) {
      const product = eventProductJsonLd({
        locale,
        name: 'OurFilm',
        description: 'One event.',
      })

      expect(product.offers.price, locale).toBe(EVENT_PRICE_AMOUNTS[locale])
      expect(product.offers.priceCurrency, locale).toBe(
        EVENT_PRICE_CURRENCIES[locale],
      )
    }
  })

  it('points at the pricing page in the reader’s own language', () => {
    // `localePath` aliases `/arak` to `/pricing` for English. An `Offer` whose
    // url is the other language's page is an offer on a page that canonicalises
    // elsewhere.
    expect(
      eventProductJsonLd({ locale: 'en', name: 'x', description: 'y' }).url,
    ).toBe(canonicalUrl('/en/pricing'))
    expect(
      eventProductJsonLd({ locale: 'hu', name: 'x', description: 'y' }).url,
    ).toBe(canonicalUrl('/hu/arak'))
  })

  it('sells as the one shared organization', () => {
    const product = eventProductJsonLd({
      locale: 'hu',
      name: 'x',
      description: 'y',
    })
    expect(product.offers.seller['@id']).toBe(organizationJsonLd()['@id'])
  })

  it('states no tax boolean and no expiry', () => {
    // The Hungarian sale is alanyi adómentes: there is no VAT inside the figure
    // and none to add to it, so both values of `valueAddedTaxIncluded` mislead.
    // `priceValidUntil` would make the offer go stale on a date nobody watches.
    for (const locale of locales) {
      const json = JSON.stringify(
        eventProductJsonLd({ locale, name: 'x', description: 'y' }),
      )
      expect(json, locale).not.toContain('valueAddedTaxIncluded')
      expect(json, locale).not.toContain('priceValidUntil')
      expect(json, locale).not.toContain('aggregateRating')
    }
  })
})
