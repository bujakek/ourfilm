/**
 * The locale list, and everything derived from it.
 *
 * **Adding English is this array plus one line in `lib/content/mdx.ts`.** Every
 * URL, every hreflang tag, every sitemap entry and every static param is
 * generated from `locales`, so nothing else enumerates languages by hand.
 * The one exception is `<html lang>` in `app/layout.tsx`, which is a single
 * root layout and therefore fixed at `hu` — see the checklist in CLAUDE.md.
 *
 * Not `server-only`: the navbar is a Client Component and builds its own hrefs.
 */

export const locales = ['en', 'hu'] as const

export type Locale = (typeof locales)[number]

/** Where `/` sends visitors, and what `x-default` points at.
 *
 *  Hungarian for now: the pilot is run in Hungary, the legal pages and the
 *  support address are Hungarian, and a bare `ourfilm.app` is overwhelmingly
 *  reached by people who were handed the domain here. English exists in full
 *  and is one edit away — this constant, and the `/` redirect in
 *  `next.config.mjs`, are the only two places that decide it. */
export const defaultLocale: Locale = 'hu'

/** Every locale the content model knows about, enabled or not.
 *
 *  Kept separate from `locales` so an `en` article can sit in the repo, fully
 *  written, without being served — moving it into production is then a change
 *  to `locales` alone rather than a content migration. */
export const knownLocales = ['hu', 'en'] as const

export type KnownLocale = (typeof knownLocales)[number]

export function isLocale(value: string): value is Locale {
  return (locales as readonly string[]).includes(value)
}

/**
 * The language of a surface that has no locale segment to read.
 *
 * `/host`, `/auth` and `/e/` sit outside the locale tree, so they carry the
 * language in `?lang` — and every link that leads there sets it. This is the
 * answer when nothing does: a bookmark, a hand-typed URL, an email client that
 * stripped the query. Each of these spots used to spell out its own
 * `=== 'hu' ? 'hu' : 'en'`, which is how the product half stayed English after
 * the public half stopped being.
 */
export function resolveLocale(value: unknown): Locale {
  return typeof value === 'string' && isLocale(value) ? value : defaultLocale
}

export function isKnownLocale(value: string): value is KnownLocale {
  return (knownLocales as readonly string[]).includes(value)
}

/** Prefixes an app-absolute path with the locale: `/arak` → `/hu/arak`.
 *
 *  Pass paths with a leading slash, or `'/'` for the locale home. Paths that
 *  are not locale-scoped — `/host`, `/e/…` — must not go through here. */
export function localePath(locale: Locale, path: string): string {
  if (path === '/') return `/${locale}`
  if (locale === 'en') {
    const aliases: Record<string, string> = {
      '/arak': '/pricing',
      '/alkalmak': '/occasions',
      '/rolunk': '/about',
      '/kapcsolat': '/contact',
      '/alternativak': '/alternatives',
      '/osszehasonlitas': '/comparisons',
      '/aszf': '/terms',
      '/adatvedelem': '/privacy',
      '/impresszum': '/legal',
    }
    for (const [source, destination] of Object.entries(aliases)) {
      if (path === source || path.startsWith(`${source}/`)) {
        return `/${locale}${destination}${path.slice(source.length)}`
      }
    }
  }
  return `/${locale}${path}`
}

/** BCP 47 tag for `Intl`, `<html lang>` and RSS `<language>`. */
export const localeTag: Record<KnownLocale, string> = {
  hu: 'hu-HU',
  en: 'en-GB',
}

/** Open Graph wants underscores, not hyphens. */
export const localeOgTag: Record<KnownLocale, string> = {
  hu: 'hu_HU',
  en: 'en_GB',
}

/** What a language switcher calls each locale, in that locale. */
export const localeLabel: Record<KnownLocale, string> = {
  hu: 'Magyar',
  en: 'English',
}
