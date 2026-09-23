import { isLocale, type Locale } from '@/lib/i18n'

/**
 * Which language the bare domain opens in, and nothing else.
 *
 * `/` is the only URL that has to guess. `/hu` and `/en` say what they are,
 * and the product half (`/host`, `/e/`, `/auth`) carries `?lang` on every link
 * that leads there, so neither ever consults this. In order:
 *
 *   1. a preference the visitor made by pressing the language switcher,
 *   2. the browser's `Accept-Language`, by its own priorities,
 *   3. English, as the international fallback.
 *
 * The guest page (`/e/<slug>`) uses the same two signals first, through
 * `guestLocale`, because the couple's language is not necessarily the
 * guest's.
 *
 * The language chosen here is an interface language and never a commercial
 * fact. Payment routing reads the billing country the host confirms at
 * checkout (`lib/billing-country.ts`); nothing in that path reads this cookie.
 *
 * Client-safe: the switcher writes the cookie from the browser, and
 * `proxy.ts` reads it on the server.
 */

/** Set only by an explicit click on a language switcher. */
export const LOCALE_PREFERENCE_COOKIE = 'ourfilm_locale'

/** A year: a language preference is not something a visitor re-states. */
export const LOCALE_PREFERENCE_MAX_AGE = 60 * 60 * 24 * 365

/** What `/` falls back to when neither signal names a language we serve. */
export const ROOT_FALLBACK_LOCALE: Locale = 'en'

/** A saved preference, if it names a locale we serve. Anything else is noise. */
export function savedLocalePreference(
  value: string | undefined | null,
): Locale | null {
  return value && isLocale(value) ? value : null
}

/**
 * The first supported language in an `Accept-Language` header, by priority.
 *
 * Regional variants match their base language (`hu-HU` → `hu`, `en-GB` →
 * `en`). Entries with `q=0` are refusals and are skipped, `*` is not a
 * preference for any particular language, and ties keep the header's order —
 * which is what RFC 9110 leaves to the server and what browsers intend.
 */
export function negotiateLocale(
  header: string | null | undefined,
): Locale | null {
  if (!header) return null

  const ranked = header
    .split(',')
    .map((part, index) => {
      const [rawTag, ...params] = part.trim().split(';')
      const tag = rawTag.trim().toLowerCase()
      let q = 1
      for (const param of params) {
        const [key, value] = param.trim().split('=')
        if (key?.trim().toLowerCase() === 'q') {
          const parsed = Number(value)
          q = Number.isFinite(parsed) ? Math.min(Math.max(parsed, 0), 1) : 0
        }
      }
      return { tag, q, index }
    })
    .filter((entry) => entry.tag && entry.tag !== '*' && entry.q > 0)
    .sort((a, b) => b.q - a.q || a.index - b.index)

  for (const { tag } of ranked) {
    const base = tag.split('-')[0]
    if (isLocale(base)) return base
  }
  return null
}

/** The whole decision for `/`. */
export function rootLocale({
  cookie,
  acceptLanguage,
}: {
  cookie: string | undefined | null
  acceptLanguage: string | undefined | null
}): Locale {
  return (
    savedLocalePreference(cookie) ??
    negotiateLocale(acceptLanguage) ??
    ROOT_FALLBACK_LOCALE
  )
}

/**
 * The language of the guest page.
 *
 * The guest's own signals first — a saved switcher choice, then their
 * browser — and only then the host's: the `?lang` on the QR code or the
 * shared invitation, which is the event's language rather than anything the
 * guest picked, and finally the event's stored locale.
 */
export function guestLocale({
  cookie,
  acceptLanguage,
  lang,
  eventLocale,
}: {
  cookie: string | undefined | null
  acceptLanguage: string | undefined | null
  lang: unknown
  eventLocale: Locale
}): Locale {
  return (
    savedLocalePreference(cookie) ??
    negotiateLocale(acceptLanguage) ??
    (typeof lang === 'string' ? savedLocalePreference(lang) : null) ??
    eventLocale
  )
}

/**
 * Remember a switcher click, from the browser.
 *
 * Not httpOnly on purpose — the switcher is a plain link, and writing the
 * cookie here keeps the click a single navigation. It gates nothing: at worst
 * a forged value opens `/` in the other language.
 */
export function rememberLocalePreference(locale: Locale): void {
  if (typeof document === 'undefined') return
  const secure = window.location.protocol === 'https:' ? '; Secure' : ''
  document.cookie =
    `${LOCALE_PREFERENCE_COOKIE}=${locale}; Path=/; ` +
    `Max-Age=${LOCALE_PREFERENCE_MAX_AGE}; SameSite=Lax${secure}`
}
