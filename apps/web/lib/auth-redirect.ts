import { resolveLocale, type Locale } from '@/lib/i18n'
import { safeNext } from '@/lib/safe-next'

export function authCallbackUrl({
  origin,
  next,
  locale,
  provider,
}: {
  origin: string
  next: string
  locale: Locale
  provider?: 'google'
}) {
  const url = new URL('/auth/callback', origin)
  url.searchParams.set('next', safeNext(next, origin))
  url.searchParams.set('lang', locale)
  if (provider) url.searchParams.set('provider', provider)
  return url.toString()
}

/** Retain the draft destination on cancellation, without trusting OAuth errors
 * or allowing a supplied `next` to redirect outside this site. */
export function authFailureUrl({
  origin,
  next,
  lang,
  provider,
}: {
  origin: string
  next: string | null
  lang: string | null
  provider: string | null
}) {
  const locale = resolveLocale(lang)
  const params = new URLSearchParams({
    error: provider === 'google' ? 'oauth' : 'link',
    lang: locale,
    next: safeNext(next ?? `/host?lang=${locale}`, origin),
  })
  return `/host/login?${params}`
}
