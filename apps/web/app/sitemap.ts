import { getDocs, getTranslations } from '@/lib/content/docs'
import { hubKinds, hubs } from '@/lib/content/kinds'
import { hasRealCompanyDetails } from '@/lib/company'
import {
  defaultLocale,
  type Locale,
  localePath,
  locales,
  localeTag,
} from '@/lib/i18n'
import { OCCASIONS_ARE_DRAFT, occasionPath, occasions } from '@/lib/occasions'
import {
  canonicalUrl,
  languageAlternates,
  localizedPageLanguages,
} from '@/lib/seo'
import type { MetadataRoute } from 'next'

/**
 * Only pages we actually want indexed, in every enabled locale.
 *
 * Event routes must never appear here. A sitemap is a public, machine-readable
 * list of every URL worth visiting — publishing album addresses in one would
 * hand away the only thing keeping them private, and would undo the random
 * slug suffix entirely. Nothing under /e/ or /host ever belongs here.
 *
 * Legal and pricing pages enter only once the real company details are set,
 * which is the same condition their metadata uses for indexing. About and
 * contact remain deliberately noindex and therefore stay out of this list.
 *
 * The occasion routes need no such bookkeeping: they come and go with
 * `OCCASIONS_ARE_DRAFT`, which is the same flag their pages read. Content
 * pages need none either — they are read from `content/`, so publishing one
 * adds its URL here and removing the file takes it away again. Every one of
 * them is `index, follow`, which is what makes listing them all correct: this
 * function has no way to emit a URL that a page then tells crawlers to ignore.
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
      alternates: { languages: localizedPageLanguages('/') },
    },
  ]

  const marketingPages: MetadataRoute.Sitemap = hasRealCompanyDetails
    ? [
        { path: '/arak', priority: 0.9 },
        { path: '/aszf', priority: 0.3 },
        { path: '/adatvedelem', priority: 0.3 },
        { path: '/impresszum', priority: 0.3 },
      ].map(({ path, priority }) => ({
        url: canonicalUrl(localePath(locale, path)),
        changeFrequency: 'monthly' as const,
        priority,
        alternates: { languages: localizedPageLanguages(path) },
      }))
    : []

  const occasionPages: MetadataRoute.Sitemap = OCCASIONS_ARE_DRAFT
    ? []
    : [
        {
          url: canonicalUrl(localePath(locale, '/alkalmak')),
          changeFrequency: 'monthly',
          priority: 0.8,
          alternates: { languages: localizedPageLanguages('/alkalmak') },
        },
        ...occasions.map((occasion) => {
          const languages = Object.fromEntries([
            ...locales.map((item) => [
              localeTag[item],
              canonicalUrl(occasionPath(item, occasion)),
            ]),
            ['x-default', canonicalUrl(occasionPath(defaultLocale, occasion))],
          ])
          return {
            url: canonicalUrl(occasionPath(locale, occasion)),
            changeFrequency: 'monthly' as const,
            priority: 0.7,
            alternates: { languages },
          }
        }),
      ]

  // Every content page, whatever kind — one loop, so a new kind cannot be
  // served and quietly left out of the sitemap.
  const content: MetadataRoute.Sitemap = getDocs(locale).map((doc) => {
    const alternates = languageAlternates(getTranslations(doc.id))
    return {
      url: canonicalUrl(doc.href),
      lastModified: lastModifiedOf(doc),
      changeFrequency: 'yearly' as const,
      // Landing pages first: they are the ones a commercial query should
      // reach, and everything else exists to feed them.
      priority: doc.kind === 'pages' ? 0.9 : 0.7,
      // `languageAlternates` returns nothing until a page genuinely exists in
      // two languages, then fills in by itself when a translation lands.
      ...(Object.keys(alternates).length > 0
        ? { alternates: { languages: alternates } }
        : {}),
    }
  })

  // A hub is listed only while it has something on it — an empty listing page
  // is a URL worth crawling exactly once and never worth ranking.
  const hubPages: MetadataRoute.Sitemap = hubs.flatMap((hub) => {
    const listed = getDocs(locale, hubKinds[hub])
    if (listed.length === 0) return []

    return [
      {
        url: canonicalUrl(localePath(locale, `/${hub}`)),
        // A hub changes whenever its newest page does.
        lastModified: lastModifiedOf(listed[0]),
        changeFrequency: 'weekly' as const,
        priority: 0.8,
        ...(locales.every((item) => getDocs(item, hubKinds[hub]).length > 0)
          ? {
              alternates: {
                languages: localizedPageLanguages(`/${hub}`),
              },
            }
          : {}),
      },
    ]
  })

  return [...home, ...marketingPages, ...occasionPages, ...hubPages, ...content]
}

/** Frontmatter dates are calendar days; pin to UTC so the sitemap does not
 *  claim a different day than the page does. */
function lastModifiedOf(doc: { publishedAt: string; updatedAt?: string }) {
  return new Date(`${doc.updatedAt ?? doc.publishedAt}T00:00:00Z`)
}
