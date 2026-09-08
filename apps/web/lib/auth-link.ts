import type { Locale } from '@/lib/i18n'
import { createClient } from '@/lib/supabase/client'

export type SendLinkResult =
  { status: 'sent' } | { status: 'error'; message: string }

/**
 * Sends the magic link, from the browser, for both places that ask for an
 * account: `/host/login` and the create flow's auth sheet.
 *
 * One function because the two callers must not drift: the callback URL is
 * what carries the locale into the Send Email Hook (`lang`), and
 * `shouldCreateUser` is what makes a single link both sign up and sign in.
 */
export async function sendSignInLink({
  email,
  next,
  locale,
}: {
  email: string
  /** Path the link comes back to, passed through `safeNext` on arrival. */
  next: string
  locale: Locale
}): Promise<SendLinkResult> {
  const supabase = createClient()
  const callbackUrl = new URL('/auth/callback', window.location.origin)
  callbackUrl.searchParams.set('next', next)
  callbackUrl.searchParams.set('lang', locale)

  const { error } = await supabase.auth.signInWithOtp({
    email,
    options: {
      // Must also be listed under Redirect URLs in the Supabase dashboard,
      // or the link comes back rejected.
      emailRedirectTo: callbackUrl.toString(),
      // The same link signs in and signs up. Safe because owner_id scoping is
      // enforced in the database, not the UI: a brand-new account sees an
      // empty host area, never anyone else's events.
      shouldCreateUser: true,
      // Used as a fallback by the Send Email Hook for legacy callers whose
      // redirect URL does not carry a locale.
      data: { locale },
    },
  })

  if (!error) return { status: 'sent' }
  return { status: 'error', message: failureMessage(error, locale) }
}

/**
 * A 429 here is not a transport failure, and saying "try again in a moment"
 * to someone who is being throttled is both wrong and an invitation to keep
 * tapping. Supabase answers with `over_email_send_rate_limit` for two
 * different limits and only the message tells them apart: the 60-second gap
 * between links to the same address names its seconds, the project-wide
 * hourly email cap does not.
 */
function failureMessage(
  error: { status?: number; code?: string; message: string },
  locale: Locale,
) {
  const en = locale === 'en'
  const limited =
    error.status === 429 || error.code === 'over_email_send_rate_limit'

  if (limited) {
    const seconds = Number(/after (\d+) seconds?/.exec(error.message)?.[1])
    if (Number.isFinite(seconds) && seconds > 0) {
      return en
        ? `You just asked for a link. You can request another one in ${seconds} seconds.`
        : `Az imént kértél linket. ${seconds} másodperc múlva kérhetsz újat.`
    }
    return en
      ? 'Too many sign-in links have been requested recently. Please try again in a few minutes.'
      : 'Túl sok belépési linket kértek az utóbbi időben. Próbáld újra pár perc múlva.'
  }

  return en
    ? 'We could not send the link. Please try again in a moment.'
    : 'Nem sikerült elküldeni. Próbáld újra egy kicsit később.'
}
