import { getPosts, getTranslations } from '@/lib/blog/posts'
import { type Locale, localePath, locales } from '@/lib/i18n'
import { OCCASIONS_ARE_DRAFT, occasions } from '@/lib/occasions'
import { hasCompleteLegalConfig } from '@/lib/legal/config'
import { INDEXABLE_LEGAL_ROUTES, LEGAL_PATHS } from '@/lib/legal/routes'
import { canonicalUrl, languageAlternates } from '@/lib/seo'
import type { MetadataRoute } from 'next'

/**
 * Only pages we actually want indexed, in every enabled locale.
 *
 * Event routes must never appear here. A sitemap is a public, machine-readable
 * list of every URL worth visiting — publishing album addresses in one would
 * hand away the only thing keeping them private, and would undo the random
 * slug suffix entirely. Nothing under /e/ or /host ever belongs here.
 *
 * The draft marketing pages are excluded for a different reason: /arak,
 * /rolunk, /kapcsolat, /adatvedelem and /aszf all still carry
 * `robots.index: false`, and listing a noindex URL in a sitemap sends crawlers
 * two contradictory instructions. Add each one here in the same change that
 * removes its noindex and its DraftNotice.
 *
 * The occasion routes need no such bookkeeping: they come and go with
 * `OCCASIONS_ARE_DRAFT`, which is the same flag their pages read. Articles
 * need none either — they are read from `content/blog/`, so publishing a post
 * adds its URL here and removing the file takes it away again.
 */
export default function sitemap(): MetadataRoute.Sitemap {
  return locales.flatMap(localeEntries)
}

function localeEntries(locale: Locale): MetadataRoute.Sitemap {
  const home: MetadataRoute.Sitemap = [
    {
      url: canonicalUrl(localePath(locale, '/')),
      changeFrequency: 'monthly',
      priority: 1,
    },
  ]

  const occasionPages: MetadataRoute.Sitemap = OCCASIONS_ARE_DRAFT
    ? []
    : [
        {
          url: canonicalUrl(localePath(locale, '/alkalmak')),
          changeFrequency: 'monthly',
          priority: 0.8,
        },
        ...occasions.map((occasion) => ({
          url: canonicalUrl(localePath(locale, `/alkalmak/${occasion.slug}`)),
          changeFrequency: 'monthly' as const,
          priority: 0.7,
        })),
      ]

  // The five legal documents, and only once they carry real identifiers.
  // Listing a noindex URL sends crawlers two contradictory instructions, and
  // `hasCompleteLegalConfig()` is the same predicate their `robots` metadata
  // reads — so the two cannot drift.
  //
  // The two form routes are never here: they stay noindex regardless, being
  // transactional rather than informational.
  const legal: MetadataRoute.Sitemap = hasCompleteLegalConfig()
    ? INDEXABLE_LEGAL_ROUTES.map((route) => ({
        url: canonicalUrl(localePath(locale, LEGAL_PATHS[route])),
        changeFrequency: 'yearly' as const,
        priority: 0.3,
      }))
    : []

  const posts = getPosts(locale)

  const blog: MetadataRoute.Sitemap =
    posts.length === 0
      ? []
      : [
          {
            url: canonicalUrl(localePath(locale, '/blog')),
            // The index changes whenever the newest article does.
            lastModified: lastModifiedOf(posts[0]),
            changeFrequency: 'weekly',
            priority: 0.8,
          },
          ...posts.map((post) => {
            const alternates = languageAlternates(getTranslations(post.id))
            return {
              url: canonicalUrl(post.href),
              lastModified: lastModifiedOf(post),
              changeFrequency: 'yearly' as const,
              priority: 0.7,
              // `languageAlternates` returns nothing until an article
              // genuinely exists in two languages, so this is empty today and
              // fills in by itself when a translation lands.
              ...(Object.keys(alternates).length > 0
                ? { alternates: { languages: alternates } }
                : {}),
            }
          }),
        ]

  return [...home, ...occasionPages, ...legal, ...blog]
}

/** Frontmatter dates are calendar days; pin to UTC so the sitemap does not
 *  claim a different day than the article does. */
function lastModifiedOf(post: { publishedAt: string; updatedAt?: string }) {
  return new Date(`${post.updatedAt ?? post.publishedAt}T00:00:00Z`)
}
