'use client'

import { useEffect } from 'react'

import { completeMagicLink } from './actions'

let started = false

/**
 * Kicks off the session exchange once the signing-in UI is on screen.
 *
 * The module-level guard is load-bearing: React Strict Mode remounts in
 * development, and a magic-link `code` is single-use. A second call would
 * burn the code the first one is still redeeming.
 */
export function CallbackExchange() {
  useEffect(() => {
    if (started) return
    started = true

    const params = new URLSearchParams(window.location.search)
    void completeMagicLink({
      code: params.get('code'),
      tokenHash: params.get('token_hash'),
      type: params.get('type'),
      next: params.get('next'),
    }).catch((error) => {
      // `redirect()` reports itself by throwing, and a Server Action re-throws
      // that on the client — so the success path arrives here too. Treating it
      // as a failure sent every sign-in to `/host/login?error=link`, which the
      // proxy then bounced to `/host` because the session was by then real.
      // That looked correct for years of ordinary logins, because `/host` is
      // where they were going anyway; it only became visible when a link
      // carried a `next` and the destination was silently discarded.
      if (isRedirect(error)) return

      // A genuine transport failure never reaches the action's own error
      // redirect. Release the Strict Mode guard before leaving so a failed
      // navigation cannot strand a remount on the spinner with retries
      // permanently disabled.
      started = false
      window.location.replace('/host/login?error=link')
    })
  }, [])

  return null
}

/** Next signals a redirect by throwing an error carrying a `NEXT_REDIRECT`
 *  digest. There is no public helper for recognising one from a client
 *  component, so this checks the two fields it actually sets. */
function isRedirect(error: unknown): boolean {
  if (typeof error !== 'object' || error === null) return false
  const digest = (error as { digest?: unknown }).digest
  const message = (error as { message?: unknown }).message
  return (
    (typeof digest === 'string' && digest.startsWith('NEXT_REDIRECT')) ||
    message === 'NEXT_REDIRECT'
  )
}
