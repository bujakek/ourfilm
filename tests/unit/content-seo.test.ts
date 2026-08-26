import sitemap from '@/app/sitemap'
import { hubCopy } from '@/lib/content/copy'
import { getAllDocs, getDocs } from '@/lib/content/docs'
import { hubs } from '@/lib/content/kinds'
import { contentMetadata } from '@/lib/content/metadata'
import { defaultLocale, localePath } from '@/lib/i18n'
import { breadcrumbJsonLd, canonicalUrl, contentJsonLd } from '@/lib/seo'
import { SITE_URL } from '@/lib/site'
import { readdirSync } from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'

const docs = getAllDocs()

describe('the sitemap', () => {
  const entries = sitemap()
  const urls = entries.map((entry) => entry.url)

  it('lists every content page at its own canonical URL', () => {
    for (const doc of docs) {
      expect(urls, doc.filePath).toContain(canonicalUrl(doc.href))
    }
  })

  it('lists every hub that has something on it', () => {
    for (const hub of hubs) {
      expect(urls).toContain(canonicalUrl(localePath(defaultLocale, `/${hub}`)))
    }
  })

  it('repeats no URL', () => {
    expect(urls).toHaveLength(new Set(urls).size)
  })

  it('lists nothing this site does not serve under the enabled locale', () => {
    for (const url of urls) {
      expect(url.startsWith(`${SITE_URL}/${defaultLocale}`), url).toBe(true)
      // An `en` URL in the sitemap while `locales` is `['hu']` is a 404
      // advertised to every crawler.
      expect(url, url).not.toMatch(/\/en(\/|$)/)
    }
  })

  it('never claims a page was modified in the future', () => {
    const now = Date.now()
    for (const entry of entries) {
      if (!entry.lastModified) continue
      expect(
        new Date(entry.lastModified).getTime(),
        entry.url,
      ).toBeLessThanOrEqual(now)
    }
  })

  it('takes its dates from frontmatter, not from the build', () => {
    for (const doc of docs) {
      const entry = entries.find(
        (candidate) => candidate.url === canonicalUrl(doc.href),
      )
      expect(entry?.lastModified).toEqual(
        new Date(`${doc.updatedAt ?? doc.publishedAt}T00:00:00Z`),
      )
    }
  })
})

describe('page metadata', () => {
  it('canonicalises every page to itself and leaves it indexable', () => {
    for (const doc of docs) {
      const meta = contentMetadata(doc)
      expect(meta.alternates?.canonical, doc.filePath).toBe(
        canonicalUrl(doc.href),
      )
      // Nothing in the content layer sets `robots`, so every page inherits
      // `index, follow`. An explicit key here would be the bug.
      expect(meta.robots, doc.filePath).toBeUndefined()
      expect(meta.title, doc.filePath).toContain(doc.title)
      // The brand belongs in a title once. Eight alternative pages are titled
      // "… : OurFilm" already, and the suffix used to double it.
      expect(
        String(meta.title).match(/OurFilm/gi)?.length ?? 0,
        doc.filePath,
      ).toBe(1)
      expect(meta.openGraph?.description, doc.filePath).toBe(doc.description)
    }
  })

  it('invents no hreflang while Hungarian is the only locale', () => {
    for (const doc of docs) {
      expect(
        contentMetadata(doc).alternates?.languages ?? {},
        doc.filePath,
      ).toEqual({})
    }
  })
})

describe('structured data', () => {
  it('types a landing page as a WebPage and an article as a BlogPosting', () => {
    const byKind = (kind: string) => docs.find((doc) => doc.kind === kind)!

    expect(contentJsonLd(byKind('pages'))['@type']).toBe('WebPage')
    expect(contentJsonLd(byKind('alternatives'))['@type']).toBe('WebPage')
    expect(contentJsonLd(byKind('vs'))['@type']).toBe('WebPage')
    expect(contentJsonLd(byKind('blog'))['@type']).toBe('BlogPosting')
    expect(contentJsonLd(byKind('compare'))['@type']).toBe('BlogPosting')
  })

  it('promises no rating, review or offer', () => {
    // We have none of the three. Emitting one is how a site earns a manual
    // action for structured-data spam.
    for (const doc of docs) {
      const json = JSON.stringify(contentJsonLd(doc))
      expect(json, doc.filePath).not.toMatch(
        /aggregateRating|reviewRating|"Review"|"Offer"|priceCurrency/,
      )
    }
  })

  it('builds a breadcrumb trail that ends on the page itself', () => {
    const doc = docs.find((candidate) => candidate.kind === 'blog')!
    const trail = breadcrumbJsonLd(defaultLocale, [
      { name: 'Főoldal', path: '/' },
      { name: hubCopy[defaultLocale].blog.label, path: '/blog' },
      { name: doc.title, path: `/blog/${doc.slug}` },
    ])

    expect(trail.itemListElement.map((item) => item.position)).toEqual([
      1, 2, 3,
    ])
    expect(trail.itemListElement.at(-1)?.item).toBe(canonicalUrl(doc.href))
  })
})

describe('routing', () => {
  it('lets no landing page shadow a marketing route', () => {
    // `/hu/<slug>` sits beside `arak`, `blog`, `rolunk` and the rest. Next
    // resolves the static segment first, so a collision is not a crash — it is
    // a landing page that silently never renders.
    const staticSegments = readdirSync(
      path.join(process.cwd(), 'app', '[locale]'),
      { withFileTypes: true },
    )
      .filter((entry) => entry.isDirectory() && !entry.name.startsWith('['))
      .map((entry) => entry.name)

    for (const doc of getDocs(defaultLocale, ['pages'])) {
      expect(staticSegments, doc.filePath).not.toContain(doc.slug)
    }
  })

  it('gives the two comparison kinds one URL space without a collision', () => {
    const comparisons = getDocs(defaultLocale, ['vs', 'compare'])
    const slugs = comparisons.map((doc) => doc.slug)
    expect(slugs).toHaveLength(new Set(slugs).size)
    expect(comparisons).toHaveLength(12)
  })
})
