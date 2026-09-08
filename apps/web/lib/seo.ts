import { kindDefinitions } from '@/lib/content/kinds'
import type { FaqEntry } from '@/lib/content/faq'
import type { ContentDoc, Translations } from '@/lib/content/types'
import { defaultLocale, type Locale, localePath, localeTag } from '@/lib/i18n'
import { SITE_URL } from '@/lib/site'

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
