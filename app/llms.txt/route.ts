import { getDocs } from '@/lib/content/docs'
import { defaultLocale, localePath } from '@/lib/i18n'
import { canonicalUrl } from '@/lib/seo'

/**
 * A plain-text summary of the site for AI systems that look for one.
 *
 * Generated from the same content layer as everything else, so the Guides
 * section cannot list an article that no longer exists. This is a convenience
 * for answer engines, **not** a replacement for the sitemap, structured data
 * or crawlable HTML — all of which do the actual work.
 *
 * The links are the default locale's — Hungarian, see `defaultLocale` — so
 * flipping the site default moves this file with it. The description is in
 * English because that is what reads it.
 */
export const dynamic = 'force-static'

const link = (doc: { title: string; href: string; description: string }) =>
  `- [${doc.title}](${canonicalUrl(doc.href)}): ${doc.description}`

export function GET() {
  const solutions = getDocs(defaultLocale, ['pages']).map(link).join('\n')
  const guides = getDocs(defaultLocale, ['blog']).map(link).join('\n')
  const comparisons = getDocs(defaultLocale, ['alternatives', 'vs', 'compare'])
    .map(link)
    .join('\n')

  const body = `# OurFilm

OurFilm is a shared digital disposable camera for events. The host creates one
camera per event; guests scan a QR code or open a link, give a name, and get a
fixed roll of shots — no app to install and no account to create. The host picks
5, 10, 16, 24 or 36 shots per guest, and decides when the photos are developed:
instantly, at the end of the event, or at a chosen later moment. There is no
preview and no retake. The number of guests is not capped, the film stays
private, and the finished album downloads as one archive.

It is not a camera-roll upload album: guests shoot into the shared camera at the
event rather than uploading afterwards.

The interface is available in Hungarian and English; the service operates in
Hungary.

## Product

- [OurFilm](${canonicalUrl(localePath(defaultLocale, '/'))}): what it is and how it works.
- [Árak / Pricing](${canonicalUrl(localePath(defaultLocale, '/arak'))}): one-time payment per event, no subscription.
- [Blog](${canonicalUrl(localePath(defaultLocale, '/blog'))}): practical guides.

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
