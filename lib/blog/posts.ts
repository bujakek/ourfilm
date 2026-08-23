import 'server-only'

import {
  knownLocales,
  type Locale,
  localePath,
  locales,
  isLocale,
} from '@/lib/i18n'
import matter from 'gray-matter'
import { readdirSync, readFileSync } from 'node:fs'
import path from 'node:path'
import { cache } from 'react'

import { parseFrontmatter } from './frontmatter'
import type { BlogPost, PostRef, Translations } from './types'

/**
 * The article index, derived from the filesystem.
 *
 * This replaces a hand-maintained registry that had to be edited in lockstep
 * with each MDX file — the failure mode being an article that existed on disk
 * and nowhere in the UI. Adding `content/blog/hu/foo.mdx` and rebuilding is now
 * the whole of publishing: route, index entry, sitemap URL and RSS item all
 * follow from the file.
 *
 * Frontmatter is read here with `gray-matter` rather than imported out of the
 * MDX module, because `@types/mdx` does not type named exports — importing a
 * `meta` back out of a post means fighting the type system for every field.
 * The same `---` block feeds the rendered page, so there is still exactly one
 * source of truth per article.
 *
 * `cache()` makes this once-per-request: a single page render asks for the
 * post, its translations and its related articles, and `generateMetadata` asks
 * again, which would otherwise be four passes over the directory.
 */

const CONTENT_ROOT = path.join(process.cwd(), 'content', 'blog')

/** Every article on disk, including disabled locales and drafts.
 *
 *  Disabled locales are read on purpose: an `en` article can then sit in the
 *  repo fully written and *validated* while `locales` is still `['hu']`, so
 *  switching English on is a one-line change rather than a debugging session. */
const loadAll = cache((): BlogPost[] => {
  const posts: BlogPost[] = []

  for (const locale of knownLocales) {
    const dir = path.join(CONTENT_ROOT, locale)

    let files: string[]
    try {
      files = readdirSync(dir).filter((file) => file.endsWith('.mdx'))
    } catch {
      // A locale with no directory yet is not an error — `en` before the first
      // translation is written is exactly this case.
      continue
    }

    for (const file of files) {
      const filePath = path.join(dir, file)
      const { data } = matter(readFileSync(filePath, 'utf8'))
      const frontmatter = parseFrontmatter(data, filePath)

      // The filename is the URL. A mismatch means the article is reachable at
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
            `but the file sits in content/blog/${locale}/.`,
        )
      }

      posts.push({
        ...frontmatter,
        filePath,
        // Only served locales get a real href; a disabled locale has no URL.
        href: isLocale(locale)
          ? localePath(locale, `/blog/${frontmatter.slug}`)
          : `/${locale}/blog/${frontmatter.slug}`,
      })
    }
  }

  assertNoCollisions(posts)
  assertRelatedResolve(posts)

  return posts
})

function assertNoCollisions(posts: BlogPost[]) {
  const bySlug = new Set<string>()
  const byId = new Set<string>()

  for (const post of posts) {
    const slugKey = `${post.locale}/${post.slug}`
    if (bySlug.has(slugKey)) {
      throw new Error(`Two articles claim ${slugKey} — see ${post.filePath}`)
    }
    bySlug.add(slugKey)

    // One article per id per language. Two files sharing an id in the same
    // locale would make `getPostById` return whichever was read first.
    const idKey = `${post.locale}#${post.id}`
    if (byId.has(idKey)) {
      throw new Error(
        `Two ${post.locale} articles share id "${post.id}" — see ${post.filePath}`,
      )
    }
    byId.add(idKey)
  }
}

/** `related` names ids, and an id that resolves to nothing renders nothing —
 *  silently, which is how a renamed article quietly empties every "read next"
 *  block that pointed at it. */
function assertRelatedResolve(posts: BlogPost[]) {
  for (const post of posts) {
    for (const id of post.related ?? []) {
      const exists = posts.some(
        (other) => other.id === id && other.locale === post.locale,
      )
      if (!exists) {
        throw new Error(
          `${post.filePath} lists related id "${id}", which has no ${post.locale} article.`,
        )
      }
    }
  }
}

/**
 * Drafts are visible while writing and invisible once built.
 *
 * `next dev` shows them so a post can be reviewed at its real URL before it is
 * published; a production build drops them from the index, the sitemap, RSS,
 * related lists and `generateStaticParams`, so the URL 404s rather than
 * quietly serving an unfinished article to a crawler.
 */
function isVisible(post: BlogPost): boolean {
  if (!post.draft) return true
  return process.env.NODE_ENV !== 'production'
}

/** Newest first. ISO dates compare correctly as strings, which is the reason
 *  the frontmatter insists on `YYYY-MM-DD` — `new Date()` on a loose value is
 *  where locale-dependent parsing bugs come from. */
function byNewest(a: BlogPost, b: BlogPost): number {
  return b.publishedAt.localeCompare(a.publishedAt)
}

/** Every visible article in every **enabled** locale. */
export function getAllPosts(): BlogPost[] {
  return loadAll()
    .filter((post) => isLocale(post.locale) && isVisible(post))
    .sort(byNewest)
}

/** One locale's articles, newest first. */
export function getPosts(locale: Locale): BlogPost[] {
  return getAllPosts().filter((post) => post.locale === locale)
}

export function getPost(locale: Locale, slug: string): BlogPost | undefined {
  return getPosts(locale).find((post) => post.slug === slug)
}

export function getPostById(locale: Locale, id: string): BlogPost | undefined {
  return getPosts(locale).find((post) => post.id === id)
}

/**
 * Which languages an article exists in, and where each one lives.
 *
 * Only enabled locales appear, so every entry is a URL that resolves — this
 * feeds `hreflang`, and pointing hreflang at a 404 is worse than omitting it.
 */
export function getTranslations(id: string): Translations {
  const translations: Translations = {}

  for (const locale of locales) {
    const post = getPostById(locale, id)
    if (post) {
      translations[locale] = {
        locale,
        slug: post.slug,
        href: post.href,
      } satisfies PostRef
    }
  }

  return translations
}

/** The articles a post points at, in its own language, in the order it lists
 *  them. Falls back to the newest other articles when it lists none. */
export function getRelatedPosts(post: BlogPost, limit = 2): BlogPost[] {
  if (!isLocale(post.locale)) return []

  const listed = (post.related ?? [])
    .map((id) => getPostById(post.locale as Locale, id))
    .filter((related): related is BlogPost => Boolean(related))

  if (listed.length > 0) return listed.slice(0, limit)

  return getPosts(post.locale as Locale)
    .filter((other) => other.id !== post.id)
    .slice(0, limit)
}
