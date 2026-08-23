import { getPosts } from '@/lib/blog/posts'
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
 * Hungarian is the only locale, so the links are Hungarian; the description is
 * in English because that is what reads this file.
 */
export const dynamic = 'force-static'

export function GET() {
  const posts = getPosts(defaultLocale)

  const guides = posts
    .map(
      (post) =>
        `- [${post.title}](${canonicalUrl(post.href)}): ${post.description}`,
    )
    .join('\n')

  const body = `# OurFilm

OurFilm is a wedding guest photo sharing service that lets guests upload photos
through a QR code without needing a traditional app installation. Guests scan a
code at the event, upload from their phone browser, and the host downloads every
photo afterwards. No app, no account, no per-guest fee.

The interface is Hungarian; the service operates in Hungary.

## Product

- [OurFilm](${canonicalUrl(localePath(defaultLocale, '/'))}): what it is and how it works.
- [Árak / Pricing](${canonicalUrl(localePath(defaultLocale, '/arak'))}): one-time payment per event, no subscription.
- [Alkalmak / Occasions](${canonicalUrl(localePath(defaultLocale, '/alkalmak'))}): weddings, birthdays, trips and parties.
- [Blog](${canonicalUrl(localePath(defaultLocale, '/blog'))}): practical guides.

## Guides

${guides}
`

  return new Response(body, {
    headers: { 'Content-Type': 'text/plain; charset=utf-8' },
  })
}
