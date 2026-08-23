import type { KnownLocale, Locale } from '@/lib/i18n'

/**
 * What the YAML block at the top of an article declares.
 *
 * `id` is the article as a concept; `slug` is its address in one language.
 * They are separate because a Hungarian URL should read like Hungarian —
 * `/hu/blog/eskuvoi-foto-megosztas` and `/en/blog/wedding-photo-sharing` are
 * the same article, and nothing in this codebase may assume a translation can
 * be found by swapping the locale segment in a URL.
 */
export interface BlogFrontmatter {
  /** Stable across languages. The join key for translations and `related`. */
  id: string
  locale: KnownLocale
  /** Must equal the filename. Enforced at load, not trusted. */
  slug: string
  title: string
  description: string
  /** `YYYY-MM-DD`. Sorted and displayed; never parsed loosely. */
  publishedAt: string
  updatedAt?: string
  author?: string
  /** Site-absolute path, e.g. `/blog/wedding-photo-sharing.jpg`. */
  image?: string
  /** Article **ids**, not slugs — so a link survives translation. */
  related?: string[]
  draft?: boolean
}

/** A parsed article, plus what the app needs to link to it. */
export interface BlogPost extends BlogFrontmatter {
  /** `/hu/blog/eskuvoi-foto-megosztas` */
  href: string
  /** Absolute path on disk. Only for error messages. */
  filePath: string
}

/** One language's address for an article. */
export interface PostRef {
  locale: Locale
  slug: string
  href: string
}

/** Which languages an article exists in, keyed by locale. Only ever contains
 *  locales that are actually served — an entry here is a link that resolves. */
export type Translations = Partial<Record<Locale, PostRef>>
