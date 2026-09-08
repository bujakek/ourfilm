import 'server-only'

import {
  isLocale,
  knownLocales,
  type Locale,
  localePath,
  locales,
} from '@/lib/i18n'
import matter from 'gray-matter'
import { readdirSync, readFileSync } from 'node:fs'
import path from 'node:path'
import { cache } from 'react'

import { parseFrontmatter } from './frontmatter'
import { type ContentKind, contentKinds, kindDefinitions } from './kinds'
import { FALLBACK_TOPIC, type TopicKey } from './topics'
import type { ContentDoc, DocRef, Translations } from './types'

/**
 * The content index, derived from the filesystem.
 *
 * This replaces a hand-maintained registry that had to be edited in lockstep
 * with each MDX file — the failure mode being a page that existed on disk and
 * nowhere in the UI. Adding `content/blog/hu/foo.mdx` and rebuilding is now the
 * whole of publishing: route, hub entry, sitemap URL and RSS item all follow
 * from the file.
 *
 * One index across all five kinds, not one per kind, and that is load-bearing
 * rather than tidy: `related` names ids that routinely cross kinds (a guide
 * points at a landing page, a comparison points at an alternative), and two
 * documents may not share a URL even when they come from different
 * directories — `vs` and `compare` both live under `/osszehasonlitas`. Neither
 * check is possible from inside one kind.
 *
 * Frontmatter is read here with `gray-matter` rather than imported out of the
 * MDX module, because `@types/mdx` does not type named exports — importing a
 * `meta` back out of a page means fighting the type system for every field.
 * The same `---` block feeds the rendered page, so there is still exactly one
 * source of truth per document.
 *
 * `cache()` makes this once-per-request: a single page render asks for the
 * document, its translations and its related pages, and `generateMetadata`
 * asks again, which would otherwise be four passes over the directory tree.
 */

const CONTENT_ROOT = path.join(process.cwd(), 'content')

/** Every document on disk, including disabled locales and drafts.
 *
 *  Disabled locales are read on purpose: an `en` page can then sit in the repo
 *  fully written and *validated* while `locales` is still `['hu']`, so
 *  switching English on is a one-line change rather than a debugging session. */
const loadAll = cache((): ContentDoc[] => {
  const docs: ContentDoc[] = []

  for (const kind of contentKinds) {
    for (const locale of knownLocales) {
      const dir = path.join(CONTENT_ROOT, kind, locale)

      let files: string[]
      try {
        files = readdirSync(dir).filter((file) => file.endsWith('.mdx'))
      } catch {
        // A kind with no directory for a locale yet is not an error — `en`
        // before the first translation is written is exactly this case.
        continue
      }

      for (const file of files) {
        const filePath = path.join(dir, file)
        const { data } = matter(readFileSync(filePath, 'utf8'))
        const frontmatter = parseFrontmatter(data, filePath)

        // The filename is the URL. A mismatch means the page is reachable at
        // an address its own frontmatter disagrees with, which then disagrees
        // with the canonical tag and the sitemap.
        const expected = file.replace(/\.mdx$/, '')
        if (frontmatter.slug !== expected) {
          throw new Error(
            `Slug mismatch in ${filePath}: frontmatter says "${frontmatter.slug}", ` +
              `filename says "${expected}". Rename one to match the other.`,
          )
        }

        if (frontmatter.locale !== locale) {
          throw new Error(
            `Locale mismatch in ${filePath}: frontmatter says "${frontmatter.locale}", ` +
              `but the file sits in content/${kind}/${locale}/.`,
          )
        }

        if (frontmatter.topic && kind !== 'blog') {
          throw new Error(
            `${filePath} declares a topic, but topics only shelve blog articles.`,
          )
        }

        const rel = docPath(kind, frontmatter.slug)

        docs.push({
          ...frontmatter,
          kind,
          filePath,
          // Only served locales get a real href; a disabled locale has no URL.
          href: isLocale(locale) ? localePath(locale, rel) : `/${locale}${rel}`,
        })
      }
    }
  }

  assertNoCollisions(docs)
  assertRelatedResolve(docs)

  return docs
})

/** The locale-relative path a document of this kind and slug is served at. */
export function docPath(kind: ContentKind, slug: string): string {
  return `${kindDefinitions[kind].prefix}/${slug}`
}

function assertNoCollisions(docs: ContentDoc[]) {
  const byHref = new Map<string, string>()
  const byId = new Map<string, string>()

  for (const doc of docs) {
    // Keyed on the final URL, not on kind + slug: `vs` and `compare` share
    // `/osszehasonlitas`, so two files in different directories can still
    // collide, and whichever was read first would win silently.
    if (byHref.has(doc.href)) {
      throw new Error(
        `Two pages claim ${doc.href} — ${doc.filePath} and ${byHref.get(doc.href)}`,
      )
    }
    byHref.set(doc.href, doc.filePath)

    // One document per id per language, across every kind. `related` and
    // `getTranslations` both resolve by id alone, so a duplicate would make
    // them return whichever file was read first.
    const idKey = `${doc.locale}#${doc.id}`
    if (byId.has(idKey)) {
      throw new Error(
        `Two ${doc.locale} pages share id "${doc.id}" — ${doc.filePath} and ${byId.get(idKey)}`,
      )
    }
    byId.set(idKey, doc.filePath)
  }
}

/** `related` names ids, and an id that resolves to nothing renders nothing —
 *  silently, which is how a renamed page quietly empties every "read next"
 *  block that pointed at it. */
function assertRelatedResolve(docs: ContentDoc[]) {
  for (const doc of docs) {
    for (const id of doc.related ?? []) {
      const exists = docs.some(
        (other) => other.id === id && other.locale === doc.locale,
      )
      if (!exists) {
        throw new Error(
          `${doc.filePath} lists related id "${id}", which has no ${doc.locale} page.`,
        )
      }
    }
  }
}

/**
 * Drafts are visible while writing and invisible once built.
 *
 * `next dev` shows them so a page can be reviewed at its real URL before it is
 * published; a production build drops them from every hub, the sitemap, RSS,
 * related lists and `generateStaticParams`, so the URL 404s rather than
 * quietly serving an unfinished page to a crawler.
 */
function isVisible(doc: ContentDoc): boolean {
  if (!doc.draft) return true
  return process.env.NODE_ENV !== 'production'
}

/** Newest first. ISO dates compare correctly as strings, which is the reason
 *  the frontmatter insists on `YYYY-MM-DD` — `new Date()` on a loose value is
 *  where locale-dependent parsing bugs come from. */
function byNewest(a: ContentDoc, b: ContentDoc): number {
  return b.publishedAt.localeCompare(a.publishedAt)
}

/** Every visible document in every **enabled** locale, of every kind. */
export function getAllDocs(): ContentDoc[] {
  return loadAll()
    .filter((doc) => isLocale(doc.locale) && isVisible(doc))
    .sort(byNewest)
}

/** One locale's documents, optionally narrowed to some kinds. Newest first. */
export function getDocs(
  locale: Locale,
  kinds?: readonly ContentKind[],
): ContentDoc[] {
  return getAllDocs().filter(
    (doc) => doc.locale === locale && (!kinds || kinds.includes(doc.kind)),
  )
}

/**
 * One document by the address it is served at.
 *
 * Keyed on the locale-relative path rather than on kind + slug, because the
 * route handler for `/hu/osszehasonlitas/[slug]` does not know — and should
 * not have to guess — whether a slug is a `vs` or a `compare` file.
 */
export function getDocByPath(
  locale: Locale,
  rel: string,
): ContentDoc | undefined {
  const href = localePath(locale, rel)
  return getDocs(locale).find((doc) => doc.href === href)
}

export function getDocById(locale: Locale, id: string): ContentDoc | undefined {
  return getDocs(locale).find((doc) => doc.id === id)
}

/**
 * Which languages a document exists in, and where each one lives.
 *
 * Only enabled locales appear, so every entry is a URL that resolves — this
 * feeds `hreflang`, and pointing hreflang at a 404 is worse than omitting it.
 */
export function getTranslations(id: string): Translations {
  const translations: Translations = {}

  for (const locale of locales) {
    const doc = getDocById(locale, id)
    if (doc) {
      translations[locale] = {
        locale,
        slug: doc.slug,
        href: doc.href,
      } satisfies DocRef
    }
  }

  return translations
}

/** The documents a page points at, in its own language, in the order it lists
 *  them. Falls back to the newest others of the same kind when it lists none. */
export function getRelatedDocs(doc: ContentDoc, limit = 3): ContentDoc[] {
  if (!isLocale(doc.locale)) return []
  const locale = doc.locale as Locale

  const listed = (doc.related ?? [])
    .map((id) => getDocById(locale, id))
    .filter((related): related is ContentDoc => Boolean(related))

  if (listed.length > 0) return listed.slice(0, limit)

  return getDocs(locale, [doc.kind])
    .filter((other) => other.id !== doc.id)
    .slice(0, limit)
}

/** Blog articles bucketed onto their shelves, newest first inside each. */
export function getDocsByTopic(locale: Locale): Map<TopicKey, ContentDoc[]> {
  const shelves = new Map<TopicKey, ContentDoc[]>()

  for (const doc of getDocs(locale, ['blog'])) {
    const key: TopicKey = doc.topic ?? FALLBACK_TOPIC
    const shelf = shelves.get(key)
    if (shelf) shelf.push(doc)
    else shelves.set(key, [doc])
  }

  return shelves
}
