import { getDocs } from '@/lib/content/docs'
import {
  isLocale,
  type Locale,
  localePath,
  locales,
  localeTag,
} from '@/lib/i18n'
import { canonicalUrl } from '@/lib/seo'

/**
 * The feed, generated from the same content layer as the index.
 *
 * Same source, so it cannot drift: an article that is published is in the
 * feed, and a draft is in neither. Locale-filtered — a Hungarian subscriber
 * has no use for English posts arriving in the same feed.
 *
 * Blog only. The landing pages, alternatives and comparisons are commercial
 * pages that get revised rather than published, and pushing a rewritten
 * pricing comparison into a subscriber's reader as "new" is not what they
 * subscribed to.
 *
 * No request is read, so this prerenders to a static file at build time
 * alongside the pages.
 */

export function generateStaticParams() {
  return locales.map((locale) => ({ locale }))
}

export const dynamicParams = false

const CHANNEL: Record<Locale, { title: string; description: string }> = {
  en: {
    title: 'OurFilm blog',
    description:
      'Practical guides to collecting and sharing wedding guest photos.',
  },
  hu: {
    title: 'OurFilm blog',
    description:
      'Gyakorlati tippek eseményekhez: QR-kód elhelyezés, fotóminőség, és hogyan gyűjts össze minden képet egy helyre.',
  },
}

/** XML has five reserved characters and no tolerance for any of them. Titles
 *  and descriptions are author-written, so they go through this rather than
 *  being trusted to contain no ampersands. */
function escapeXml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;')
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ locale: string }> },
) {
  const { locale } = await params
  if (!isLocale(locale)) {
    return new Response('Not found', { status: 404 })
  }

  const posts = getDocs(locale, ['blog'])
  const channel = CHANNEL[locale]
  const feedUrl = canonicalUrl(`${localePath(locale, '/blog')}/rss.xml`)

  const items = posts
    .map((post) => {
      const url = canonicalUrl(post.href)
      return `    <item>
      <title>${escapeXml(post.title)}</title>
      <link>${url}</link>
      <guid isPermaLink="true">${url}</guid>
      <description>${escapeXml(post.description)}</description>
      <pubDate>${new Date(`${post.publishedAt}T00:00:00Z`).toUTCString()}</pubDate>
    </item>`
    })
    .join('\n')

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">
  <channel>
    <title>${escapeXml(channel.title)}</title>
    <link>${canonicalUrl(localePath(locale, '/blog'))}</link>
    <description>${escapeXml(channel.description)}</description>
    <language>${localeTag[locale]}</language>
    <atom:link href="${feedUrl}" rel="self" type="application/rss+xml" />
${items}
  </channel>
</rss>
`

  return new Response(xml, {
    headers: { 'Content-Type': 'application/xml; charset=utf-8' },
  })
}
