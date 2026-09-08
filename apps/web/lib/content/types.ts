import type { KnownLocale, Locale } from '@/lib/i18n'

import type { ContentKind } from './kinds'
import type { Topic } from './topics'

/**
 * What the YAML block at the top of a content file declares.
 *
 * `id` is the document as a concept; `slug` is its address in one language.
 * They are separate because a Hungarian URL should read like Hungarian —
 * `/hu/blog/eskuvoi-foto-megosztas` and `/en/blog/wedding-photo-sharing` are
 * the same article, and nothing in this codebase may assume a translation can
 * be found by swapping the locale segment in a URL.
 *
 * The same block serves all five kinds. A money landing page and a guide want
 * exactly the same fields, and one schema is what lets `related` point across
 * kinds — which most of them do.
 */
export interface ContentFrontmatter {
  /** Stable across languages **and kinds**. The join key for `related`. */
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
  /** Document **ids**, not slugs — so a link survives translation. */
  related?: string[]
  /** Which shelf the blog index files this under. Blog only; optional. */
  topic?: Topic
  draft?: boolean
}

/** A parsed document, plus what the app needs to link to it. */
export interface ContentDoc extends ContentFrontmatter {
  kind: ContentKind
  /** `/hu/blog/eskuvoi-foto-megosztas` */
  href: string
  /** Absolute path on disk. Only for error messages. */
  filePath: string
}

/** One language's address for a document. */
export interface DocRef {
  locale: Locale
  slug: string
  href: string
}

/** Which languages a document exists in, keyed by locale. Only ever contains
 *  locales that are actually served — an entry here is a link that resolves. */
export type Translations = Partial<Record<Locale, DocRef>>
