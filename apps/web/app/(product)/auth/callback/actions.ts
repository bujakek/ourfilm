'use server'

import { isLocale } from '@/lib/i18n'
import { authFailureUrl } from '@/lib/auth-redirect'
import { requestOrigin } from '@/lib/request-origin'
import { safeNext } from '@/lib/safe-next'
import { createClient } from '@/lib/supabase/server'
import { reportServerEvent } from '@/lib/telemetry-server'
import { type EmailOtpType } from '@supabase/supabase-js'
import { redirect, RedirectType } from 'next/navigation'

/**
 * Finish an email or Google sign-in.
 *
 * Lives in a Server Action so cookies can actually be written — a Server
 * Component cannot set them — while the page itself paints "Belépés…" without
 * waiting on Supabase. The Route Handler this replaced returned a redirect
 * with no body, so the tab stayed blank through the whole exchange.
 */
export async function completeSignIn({
  code,
  tokenHash,
  type,
  next,
  lang,
  provider,
}: {
  code: string | null
  tokenHash: string | null
  type: string | null
  next: string | null
  lang: string | null
  provider: string | null
}) {
  const supabase = await createClient()

  const { error } = code
    ? await supabase.auth.exchangeCodeForSession(code)
    : tokenHash && type
      ? await supabase.auth.verifyOtp({
          type: type as EmailOtpType,
          token_hash: tokenHash,
        })
      : { error: new Error('Missing sign-in code') }

  // Awaited before either redirect, because `redirect()` reports itself by
  // throwing and would take an unflushed report with it.
  await reportServerEvent('sign_in_settled', {
    method: provider === 'google' ? 'google' : 'email',
    outcome: error ? 'failed' : 'signed_in',
  })

  if (error) {
    redirect(
      authFailureUrl({ origin: await requestOrigin(), next, lang, provider }),
      RedirectType.replace,
    )
  }

  // Record the language this host arrived in, unless they already have one.
  // Email sign-ups carry it in user metadata; Google carries none of ours,
  // so this is where a Google account gets its first. Best effort: a missing
  // language falls back to `?lang`, and must never cost a sign-in.
  if (lang && isLocale(lang)) {
    await supabase
      .rpc('set_host_locale', { p_locale: lang, p_only_if_unset: true })
      .then(({ error: localeError }) => {
        if (localeError)
          console.error('Could not record host locale', localeError)
      })
  }

  redirect(safeNext(next, await requestOrigin()), RedirectType.replace)
}
