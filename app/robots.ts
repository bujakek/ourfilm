import { SITE_URL } from '@/lib/site'
import type { MetadataRoute } from 'next'

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: '*',
      allow: '/',
      // Only the admin area is disallowed. Event routes are deliberately NOT
      // listed here even though they are private, which looks backwards until
      // you consider the failure mode: a disallowed URL is never fetched, so a
      // crawler never sees its `noindex` — and a leaked link can still surface
      // as a bare URL in results with no way to remove it. Allowing the crawl
      // means the noindex on /e/ routes is actually read and honoured, so a
      // leak self-corrects. Privacy comes from the unguessable slug, not from
      // asking crawlers politely.
      disallow: '/host',
    },
    sitemap: `${SITE_URL}/sitemap.xml`,
  }
}
