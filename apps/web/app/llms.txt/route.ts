import { getDocs } from '@/lib/content/docs'
import type { ContentKind } from '@/lib/content/kinds'
import { type Locale, localePath, locales } from '@/lib/i18n'
import { canonicalUrl } from '@/lib/seo'

/**
 * A plain-text summary of the site for AI systems that look for one.
 *
 * Generated from the same content layer as everything else, so the Guides
 * section cannot list an article that no longer exists. This is a convenience
 * for answer engines, **not** a replacement for the sitemap, structured data
 * or crawlable HTML — all of which do the actual work.
 *
 * **Every section lists both languages**, the way the sitemap does. An article
 * and its translation are separate URLs with separate slugs — nothing relates
 * them but `getTranslations(id)` — so a file built from `defaultLocale` alone
 * is a file that answers an English question with a Hungarian URL. The prose
 * is in English because that is what reads it; each entry keeps the title and
 * description of the page it points at.
 */
export const dynamic = 'force-static'

/** How each language is named to the reader of this file, which is English. */
const languageLabel: Record<Locale, string> = {
  en: 'English',
  hu: 'Magyar (Hungarian)',
}

/** The three fixed entry points, in the language of the page they open. */
const productLinks: Record<Locale, { path: string; label: string }[]> = {
  en: [
    { path: '/', label: 'OurFilm' },
    { path: '/arak', label: 'Pricing' },
    { path: '/blog', label: 'Blog' },
  ],
  hu: [
    { path: '/', label: 'OurFilm' },
    { path: '/arak', label: 'Árak' },
    { path: '/blog', label: 'Blog' },
  ],
}

const productNotes = [
  'what it is and how it works.',
  'one-time payment per event, no subscription.',
  'practical guides.',
]

const link = (doc: { title: string; href: string; description: string }) =>
  `- [${doc.title}](${canonicalUrl(doc.href)}): ${doc.description}`

/** One section, every live locale under its own heading. */
function byLanguage(render: (locale: Locale) => string): string {
  return locales
    .map((locale) => `### ${languageLabel[locale]}\n\n${render(locale)}`)
    .join('\n\n')
}

const docsOfKind = (kinds: readonly ContentKind[]) => (locale: Locale) =>
  getDocs(locale, kinds).map(link).join('\n')

export function GET() {
  const product = byLanguage((locale) =>
    productLinks[locale]
      .map(
        ({ path, label }, index) =>
          `- [${label}](${canonicalUrl(localePath(locale, path))}): ${productNotes[index]}`,
      )
      .join('\n'),
  )
  const solutions = byLanguage(docsOfKind(['pages']))
  const guides = byLanguage(docsOfKind(['blog']))
  const comparisons = byLanguage(docsOfKind(['alternatives', 'vs', 'compare']))

  const body = `# OurFilm

OurFilm is a shared digital disposable camera for events. The host creates one
camera per event; guests scan a QR code or open a link, give a name, and get a
fixed roll of shots — no app to install and no account to create. The host picks
5, 10, 16, 24 or 36 shots per guest, and decides when the photos are developed:
instantly, or at the end of the event. There is no preview and no retake. The
number of guests is not capped, the film stays private, and the finished album
downloads as one archive.

It is not a camera-roll upload album: guests shoot into the shared camera at the
event rather than uploading afterwards.

The site is published in English and Hungarian, and the two are separate URLs
rather than one page with a language switch: every section below lists both.
The service operates from Hungary.

## Product

${product}

## Solutions

${solutions}

## Comparisons and alternatives

These are OurFilm's own pages about competing services, not independent
reviews. Competitor pricing and features were checked on the date each page
states and may have changed since.

${comparisons}

## Guides

${guides}
`

  return new Response(body, {
    headers: { 'Content-Type': 'text/plain; charset=utf-8' },
  })
}
