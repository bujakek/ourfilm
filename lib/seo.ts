import type { BlogPost, Translations } from '@/lib/blog/types'
import { defaultLocale, localeTag } from '@/lib/i18n'
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
 * Only locales with a real article are listed: an `hreflang` pointing at a URL
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
 * `BlogPosting` JSON-LD for one article.
 *
 * Every value comes from the article's own frontmatter. `dateModified` falls
 * back to `datePublished` rather than to today: a build date would tell search
 * engines the article changes every deploy, which is both untrue and the kind
 * of signal that gets discounted.
 */
export function blogPostingJsonLd(post: BlogPost) {
  return {
    '@context': 'https://schema.org',
    '@type': 'BlogPosting',
    headline: post.title,
    description: post.description,
    datePublished: post.publishedAt,
    dateModified: post.updatedAt ?? post.publishedAt,
    inLanguage: localeTag[post.locale],
    author: {
      '@type': 'Organization',
      name: post.author ?? 'OurFilm',
      url: SITE_URL,
    },
    publisher: {
      '@type': 'Organization',
      name: 'OurFilm',
      url: SITE_URL,
    },
    ...(post.image ? { image: canonicalUrl(post.image) } : {}),
    mainEntityOfPage: {
      '@type': 'WebPage',
      '@id': canonicalUrl(post.href),
    },
  }
}
