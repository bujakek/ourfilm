import type { Metadata } from 'next'

import { getTranslations } from './docs'
import type { ContentDoc } from './types'
import { localeOgTag } from '@/lib/i18n'
import { canonicalUrl, languageAlternates } from '@/lib/seo'

/**
 * The `<head>` of a content page, built once for all four routes.
 *
 * `index, follow` is the default and is deliberately not overridden anywhere
 * here: every page in `content/` is meant to be found. The `noindex` that some
 * marketing routes still carry is set on those routes, one by one, so nothing
 * can suppress a content page by accident.
 *
 * `type: 'article'` for editorial, `'website'` for the commercial pages —
 * matching what `contentJsonLd` says about the same page, because Open Graph
 * and JSON-LD disagreeing about what a page is helps nobody.
 */
export function contentMetadata(doc: ContentDoc): Metadata {
  const url = canonicalUrl(doc.href)
  const isArticle = doc.kind === 'blog' || doc.kind === 'compare'

  return {
    title: `${doc.title} — OurFilm`,
    description: doc.description,
    alternates: {
      // Each language canonicalises to itself. Pointing one at the other is
      // how a translated page gets dropped from the index.
      canonical: url,
      languages: languageAlternates(getTranslations(doc.id)),
    },
    openGraph: {
      type: isArticle ? 'article' : 'website',
      url,
      title: doc.title,
      description: doc.description,
      siteName: 'OurFilm',
      locale: localeOgTag[doc.locale],
      ...(isArticle
        ? {
            publishedTime: doc.publishedAt,
            modifiedTime: doc.updatedAt ?? doc.publishedAt,
          }
        : {}),
      ...(doc.image ? { images: [{ url: doc.image }] } : {}),
    },
    twitter: {
      card: 'summary_large_image',
      title: doc.title,
      description: doc.description,
      ...(doc.image ? { images: [doc.image] } : {}),
    },
  }
}
