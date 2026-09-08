import { getAllDocs, getDocs, getRelatedDocs } from '@/lib/content/docs'
import { getFaq } from '@/lib/content/faq'
import { hubKinds, hubs, kindDefinitions } from '@/lib/content/kinds'
import type { ContentDoc } from '@/lib/content/types'
import { localePath, locales } from '@/lib/i18n'
import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

/**
 * What the content library must be true of, checked at `pnpm verify` time.
 *
 * Sixty-nine hand-written pages is past the point where a person can hold the
 * invariants in their head — a duplicate description, a `related` id that lost
 * its page, a link to a route that was renamed. Every one of those fails
 * silently in production and is invisible in review, which is exactly the kind
 * of thing a test is for. The loader itself already throws on collisions and
 * unresolved ids; this covers what the loader has no opinion about.
 */

const docs = getAllDocs()

/** Every path this site actually serves under a locale, content included.
 *  Anything an MDX body links to must be in here or it is a 404 waiting. */
const servedPaths = new Set<string>([
  ...locales.flatMap((locale) => [
    localePath(locale, '/'),
    ...['/arak', '/alkalmak', '/rolunk', '/kapcsolat'].map((path) =>
      localePath(locale, path),
    ),
    ...hubs.map((hub) => localePath(locale, `/${hub}`)),
  ]),
  localePath('hu', '/aszf'),
  localePath('hu', '/adatvedelem'),
  ...docs.map((doc) => doc.href),
])

/** The body of a document, without its frontmatter block. */
function body(doc: ContentDoc): string {
  const source = readFileSync(doc.filePath, 'utf8')
  const end = source.indexOf('\n---', 3)
  return end === -1 ? source : source.slice(end + 4)
}

/** Every site-absolute link in a body, with any `#fragment` stripped. */
function internalLinks(doc: ContentDoc): string[] {
  return [...body(doc).matchAll(/\]\((\/[^)\s]*)\)/g)].map((match) =>
    match[1].split('#')[0].replace(/\/$/, ''),
  )
}

describe('the content pack', () => {
  it('serves every published page in both content packs', () => {
    expect(getDocs('hu')).toHaveLength(69)
    expect(getDocs('en')).toHaveLength(7)
    expect(docs.filter((doc) => doc.draft)).toHaveLength(0)
  })

  it('puts each kind where the kind map says', () => {
    const counts = {
      pages: 11,
      blog: 42,
      alternatives: 11,
      vs: 7,
      compare: 5,
    } as const

    for (const [kind, expected] of Object.entries(counts)) {
      const of = docs.filter((doc) => doc.kind === kind)
      expect(of, kind).toHaveLength(expected)
      for (const doc of of) {
        expect(doc.href, doc.filePath).toBe(
          localePath(
            doc.locale,
            `${kindDefinitions[doc.kind].prefix}/${doc.slug}`,
          ),
        )
      }
    }
  })

  it('gives every page its own URL, id, title and description', () => {
    for (const field of ['href', 'id', 'title', 'description'] as const) {
      const seen = new Map<string, string>()
      for (const doc of docs) {
        const value =
          field === 'href' ? doc[field] : `${doc.locale}:${doc[field]}`
        expect(
          seen.get(value),
          `${field} "${value}" is shared by ${doc.filePath} and ${seen.get(value)}`,
        ).toBeUndefined()
        seen.set(value, doc.filePath)
      }
    }
  })

  it('keeps every description inside the length a result snippet shows', () => {
    for (const doc of docs) {
      expect(doc.description.length, doc.filePath).toBeGreaterThanOrEqual(110)
      expect(doc.description.length, doc.filePath).toBeLessThanOrEqual(170)
    }
  })

  it('publishes nothing dated in the future', () => {
    // ISO dates compare correctly as strings, which is why the frontmatter
    // insists on the format. A page dated tomorrow renders today and tells a
    // crawler it has not happened yet.
    const today = new Date().toISOString().slice(0, 10)
    for (const doc of docs) {
      expect(
        doc.publishedAt <= today,
        `${doc.filePath}: ${doc.publishedAt}`,
      ).toBe(true)
      if (doc.updatedAt) {
        expect(doc.updatedAt <= today, doc.filePath).toBe(true)
        expect(doc.updatedAt >= doc.publishedAt, doc.filePath).toBe(true)
      }
    }
  })

  it('leaves the h1 to the template', () => {
    // The page renders `title` as the only `<h1>`. A second one in the body is
    // an SEO defect that nothing else would catch.
    for (const doc of docs) {
      expect(body(doc), doc.filePath).not.toMatch(/^# /m)
    }
  })

  it('ships no placeholders', () => {
    for (const doc of docs) {
      expect(body(doc), doc.filePath).not.toMatch(
        /\b(TODO|TBD|FIXME|lorem ipsum|PLACEHOLDER|XXX)\b/i,
      )
    }
  })
})

describe('internal linking', () => {
  it('points every link at a page that exists', () => {
    for (const doc of docs) {
      for (const href of internalLinks(doc)) {
        expect(
          servedPaths.has(href || localePath(doc.locale, '/')),
          `${doc.filePath} links to ${href}, which nothing serves`,
        ).toBe(true)
      }
    }
  })

  it('resolves every related id to a real page', () => {
    for (const doc of docs) {
      const related = getRelatedDocs(doc, 99)
      expect(related.length, doc.filePath).toBeGreaterThan(0)
      expect(
        related.map((item) => item.id),
        doc.filePath,
      ).not.toContain(doc.id)
    }
  })

  it('leaves no page orphaned', () => {
    // Inbound from a body link, from someone's `related`, or from the hub that
    // lists it. The money pages have no hub, which is why `HubLinks` puts all
    // eight on every hub — take that away and this test is what notices.
    const inbound = new Map<string, number>(docs.map((doc) => [doc.href, 0]))
    const bump = (href: string) => {
      if (inbound.has(href)) inbound.set(href, inbound.get(href)! + 1)
    }

    for (const doc of docs) {
      for (const href of internalLinks(doc)) if (href !== doc.href) bump(href)
      for (const related of getRelatedDocs(doc, 99)) bump(related.href)
    }
    // What the three hub pages render.
    for (const locale of locales) {
      for (const hub of hubs) {
        for (const doc of getDocs(locale, hubKinds[hub])) bump(doc.href)
        for (const doc of getDocs(locale, ['pages'])) bump(doc.href)
      }
    }

    const orphans = [...inbound].filter(([, count]) => count === 0)
    expect(orphans.map(([href]) => href)).toEqual([])
  })

  it('sends the money pages onward, and the competitor pages back', () => {
    for (const doc of docs) {
      const isMoney = (href: string) =>
        getDocs(doc.locale, ['pages']).some(
          (candidate) => candidate.href === href,
        )
      const outbound = new Set([
        ...internalLinks(doc),
        ...getRelatedDocs(doc, 99).map((item) => item.href),
      ])

      if (doc.kind === 'pages') {
        // A landing page that links nowhere is a dead end for a reader who
        // wanted to read more before deciding.
        const onward = [...outbound].filter(
          (href) => href !== doc.href && !isMoney(href),
        )
        expect(
          onward.length,
          `${doc.filePath} links to no guide`,
        ).toBeGreaterThan(0)
      }

      if (doc.kind === 'alternatives' || doc.kind === 'vs') {
        expect(
          [...outbound].some(isMoney),
          `${doc.filePath} links to no OurFilm landing page`,
        ).toBe(true)
      }
    }
  })
})

describe('structured data', () => {
  it('describes FAQ questions the reader can actually see', () => {
    for (const doc of docs) {
      const faq = getFaq(doc)
      expect(faq.length, doc.filePath).toBeGreaterThan(0)

      const text = body(doc)
      for (const entry of faq) {
        expect(text, doc.filePath).toContain(entry.question)
      }
    }
  })
})
