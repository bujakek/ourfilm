import { COMPANY, hasRealCompanyDetails } from '@/lib/company'
import { kindDefinitions } from '@/lib/content/kinds'
import type { FaqEntry } from '@/lib/content/faq'
import type { ContentDoc, Translations } from '@/lib/content/types'
import {
  defaultLocale,
  type Locale,
  localePath,
  locales,
  localeTag,
} from '@/lib/i18n'
import { EVENT_PRICE_AMOUNTS, EVENT_PRICE_CURRENCIES } from '@/lib/pricing'
import { CONTACT_EMAIL, INSTAGRAM_URL, SITE_URL, TIKTOK_URL } from '@/lib/site'

/**
 * Absolute URLs and the tags that depend on them.
 *
 * Everything here builds on `SITE_URL` from `lib/site.ts` — the same constant
 * the printed QR codes use. A second base-URL constant is how a canonical tag
 * ends up pointing at a preview deployment.
 */

/** `/hu/blog/foo` → `https://ourfilm.app/hu/blog/foo` */
export function canonicalUrl(path: string): string {
  return `${SITE_URL}${path}`
}

/** Reciprocal hreflang URLs for a route that exists in every live locale. */
export function localizedPageLanguages(path: string) {
  return Object.fromEntries([
    ...locales.map((locale) => [
      localeTag[locale],
      canonicalUrl(localePath(locale, path)),
    ]),
    ['x-default', canonicalUrl(localePath(defaultLocale, path))],
  ])
}

/** Self-canonical plus reciprocal hreflang for a translated static page. */
export function localizedPageAlternates(locale: Locale, path: string) {
  return {
    canonical: canonicalUrl(localePath(locale, path)),
    languages: localizedPageLanguages(path),
  }
}

/**
 * `alternates` for a page that exists in more than one language.
 *
 * Only locales with a real page are listed: an `hreflang` pointing at a URL
 * that 404s is worse than no `hreflang` at all — and with `locales = ['hu']`
 * there is nothing to relate, so the map comes back empty.
 *
 * Each language keeps its **own** canonical — the canonical is passed in by
 * the caller and is always the page's own URL. Canonicalising English to
 * Hungarian would tell Google the English page should not be indexed.
 */
export function languageAlternates(translations: Translations) {
  const refs = Object.values(translations)

  // hreflang describes a *relationship between* language versions. One
  // version has no relationship to describe, and emitting `hu-HU` plus an
  // `x-default` both pointing at the page you are already on is noise in every
  // article until English ships. The moment a translation exists, this fills
  // in on its own.
  if (refs.length < 2) return {}

  const languages: Record<string, string> = {}
  for (const ref of refs) {
    languages[localeTag[ref.locale]] = canonicalUrl(ref.href)
  }

  const fallback = translations[defaultLocale]
  if (fallback) {
    languages['x-default'] = canonicalUrl(fallback.href)
  }

  return languages
}

/**
 * JSON-LD for one content page.
 *
 * The `@type` comes from the kind, not from the caller: an OurFilm-versus
 * page argues for a product we sell, and typing it `BlogPosting` would dress a
 * landing page up as journalism. See `lib/content/kinds.ts`.
 *
 * Every value comes from the page's own frontmatter. `dateModified` falls back
 * to `datePublished` rather than to today: a build date would tell search
 * engines the page changes every deploy, which is both untrue and the kind of
 * signal that gets discounted. Nothing here emits a rating, a review or an
 * offer — we have none of the three, and inventing them is the fastest way to
 * a manual action.
 */
export function contentJsonLd(doc: ContentDoc) {
  const url = canonicalUrl(doc.href)
  const type = kindDefinitions[doc.kind].schemaType

  const common = {
    '@context': 'https://schema.org',
    '@type': type,
    name: doc.title,
    description: doc.description,
    inLanguage: localeTag[doc.locale],
    url,
    ...(doc.image ? { image: canonicalUrl(doc.image) } : {}),
    publisher: {
      '@type': 'Organization',
      name: 'OurFilm',
      url: SITE_URL,
    },
  }

  if (type === 'WebPage') {
    return {
      ...common,
      datePublished: doc.publishedAt,
      dateModified: doc.updatedAt ?? doc.publishedAt,
      isPartOf: { '@type': 'WebSite', name: 'OurFilm', url: SITE_URL },
    }
  }

  return {
    ...common,
    headline: doc.title,
    datePublished: doc.publishedAt,
    dateModified: doc.updatedAt ?? doc.publishedAt,
    author: {
      '@type': 'Organization',
      name: doc.author ?? 'OurFilm',
      url: SITE_URL,
    },
    mainEntityOfPage: { '@type': 'WebPage', '@id': url },
  }
}

/** One crumb: what it is called, and the locale-relative path it points at. */
export interface Crumb {
  name: string
  path: string
}

/**
 * `BreadcrumbList` for a trail that ends on the current page.
 *
 * The last crumb still carries its own `item`, which is what lets the page
 * self-identify in the trail rather than dangling.
 */
export function breadcrumbJsonLd(locale: Locale, crumbs: Crumb[]) {
  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: crumbs.map((crumb, index) => ({
      '@type': 'ListItem',
      position: index + 1,
      name: crumb.name,
      item: canonicalUrl(localePath(locale, crumb.path)),
    })),
  }
}

/**
 * `FAQPage` for questions that are visibly on the page.
 *
 * Fed only by `lib/content/faq.ts`, which parses the rendered body — so this
 * cannot describe a question the reader does not see. Returns `null` when
 * there is nothing to describe, and the caller renders no block at all.
 */
export function faqJsonLd(entries: FaqEntry[]) {
  if (entries.length === 0) return null

  return {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: entries.map((entry) => ({
      '@type': 'Question',
      name: entry.question,
      acceptedAnswer: { '@type': 'Answer', text: entry.answer },
    })),
  }
}

/**
 * The `@id` every other node points at.
 *
 * One publisher for the whole site rather than one per page: without a shared
 * `@id`, each page's nested `Organization` is a separate entity as far as a
 * crawler is concerned, and nothing accumulates.
 */
const ORGANIZATION_ID = `${SITE_URL}/#organization`

/**
 * OurFilm as an entity, emitted once from the homepage.
 *
 * This is the node that answers "who is OurFilm" rather than "what does this
 * page say" — the two social profiles are what let an answer engine tie the
 * name to accounts it can already see, and `taxID` plus `legalName` are what
 * distinguish this OurFilm from every other film-related name. Both are
 * already published on `/hu/impresszum` because an egyéni vállalkozó is
 * required to publish them, so nothing here is newly disclosed; they are
 * gated on `hasRealCompanyDetails` for the same reason the legal pages are.
 *
 * **No `logo`, deliberately.** Google reads it for the knowledge panel, and
 * `og-cover.jpg` is a photograph rather than a mark — pointing `logo` at it
 * would put a wedding picture where a brand asset belongs. Add a square PNG
 * under `public/` and this is one line.
 *
 * Nothing here emits `aggregateRating` or `review`, for the same reason
 * `contentJsonLd` does not: the testimonials on the homepage are not verified
 * named reviews, and marking them up as if they were is the fastest route to a
 * manual action.
 */
export function organizationJsonLd() {
  return {
    '@context': 'https://schema.org',
    '@type': 'Organization',
    '@id': ORGANIZATION_ID,
    name: 'OurFilm',
    url: SITE_URL,
    email: CONTACT_EMAIL,
    sameAs: [INSTAGRAM_URL, TIKTOK_URL],
    ...(hasRealCompanyDetails
      ? {
          legalName: COMPANY.name,
          taxID: COMPANY.taxNumber,
          // Country only. `COMPANY.seat` is one free-text line because that is
          // how the imprint prints it, and splitting it into a postal code, a
          // locality and a street here would be parsing prose to fill fields
          // nobody checks. The country is the one geo fact worth asserting.
          address: { '@type': 'PostalAddress', addressCountry: 'HU' },
        }
      : {}),
  }
}

/**
 * One language's homepage as a `WebSite`.
 *
 * `inLanguage` is the point: the two homepages are separate URLs carrying the
 * same brand, and this is what stops an English query resolving to the
 * Hungarian one. `publisher` is a bare `@id` reference to the Organization
 * node rendered beside it.
 *
 * **No `potentialAction`/`SearchAction`.** There is no site search to point
 * one at, and declaring a search endpoint that 404s is a promise to a crawler
 * we cannot keep.
 */
export function webSiteJsonLd(locale: Locale) {
  const url = canonicalUrl(localePath(locale, '/'))

  return {
    '@context': 'https://schema.org',
    '@type': 'WebSite',
    '@id': `${url}#website`,
    name: 'OurFilm',
    url,
    inLanguage: localeTag[locale],
    publisher: { '@id': ORGANIZATION_ID },
  }
}

/**
 * `FaqEntry[]` from the `[question, answer]` pairs the hand-built marketing
 * pages hold their questions in.
 *
 * `lib/content/faq.ts` parses MDX to guarantee the schema only describes
 * questions a reader can see. The marketing pages need no parser to get the
 * same guarantee: this maps the **same array the component renders**
 * (`marketingCopy[locale].faq.items`, `occasion.faq`), so a question can only
 * reach the schema by being on the page.
 */
export function faqPairs(items: readonly (readonly string[])[]): FaqEntry[] {
  // `readonly string[]`, not a tuple, because `marketingCopy` is a plain
  // object literal and its rows infer as `string[]`. A row that is not a
  // question and an answer is dropped rather than described: `undefined`
  // reaching `acceptedAnswer` would be a question the schema promises and the
  // page never answers.
  return items.flatMap(([question, answer]) =>
    question && answer ? [{ question, answer }] : [],
  )
}

/**
 * The purchase on the pricing page, as an `Offer`.
 *
 * The price was text on the page and nowhere a machine could read it, which is
 * the one question every answer engine gets asked about a paid product. The
 * amount and currency come from `lib/pricing.ts` keyed on the **event's
 * locale** — the same key that picks the Stripe Price — so a translated label
 * cannot quote the other currency.
 *
 * `Product`, not `SoftwareApplication`: nobody installs anything, and what is
 * sold is one event's full access rather than a licence. One `Offer`, not two
 * — adding a zero-priced one for the free tier would let a reader conclude the
 * product costs nothing, and the free tier is a cap on an event rather than a
 * second thing to buy. It stays in the prose and in the FAQ.
 *
 * **No `valueAddedTaxIncluded`.** The Hungarian sale is alanyi adómentes, so
 * there is no VAT inside the figure and none to add to it; `true` and `false`
 * are both misleading, and the page's own copy explains it in a sentence a
 * boolean cannot. No `priceValidUntil` either — the price has no expiry, and
 * inventing one makes an `Offer` go stale on a date nobody is watching.
 */
export function eventProductJsonLd({
  locale,
  name,
  description,
}: {
  locale: Locale
  name: string
  description: string
}) {
  const url = canonicalUrl(localePath(locale, '/arak'))

  return {
    '@context': 'https://schema.org',
    '@type': 'Product',
    name,
    description,
    url,
    brand: { '@type': 'Brand', name: 'OurFilm' },
    offers: {
      '@type': 'Offer',
      url,
      price: EVENT_PRICE_AMOUNTS[locale],
      priceCurrency: EVENT_PRICE_CURRENCIES[locale],
      availability: 'https://schema.org/InStock',
      seller: { '@id': ORGANIZATION_ID },
    },
  }
}
