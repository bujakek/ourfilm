'use client'

import { Suspense, use } from 'react'

import { createClient } from '@/lib/supabase/client'
import type { Locale } from '@/lib/i18n'

/**
 * "Az esemény mentéséhez ingyenes fiók szükséges." — for signed-out visitors
 * only.
 *
 * The whole point of the flow is that nobody is asked to sign up before they
 * have seen what they are signing up for. The cost of that is a surprise at the
 * end, and this line is what stops it being one. A host who is already signed
 * in has nothing to be warned about, so they see nothing.
 *
 * Whether there is a session is a client-only, asynchronous fact, which is
 * exactly what `use()` inside a `Suspense` is for — an effect plus `setState`
 * would be the same answer one render later and a lint rule against it. The
 * server snapshot renders nothing, which is also the fallback, so hydration
 * sees the same empty output either way.
 */
let cached: Promise<boolean> | null = null

function signedIn(): Promise<boolean> {
  // On the server there is no browser client and nothing to render — resolving
  // to "signed in" is the same output as the Suspense fallback.
  if (typeof window === 'undefined') return Promise.resolve(true)
  cached ??= createClient()
    .auth.getUser()
    .then(({ data }) => Boolean(data.user))
    // A failed session read must not put a warning in front of someone who does
    // not need it. The create attempt is what actually decides.
    .catch(() => true)
  return cached
}

function Notice({ locale }: { locale: Locale }) {
  if (use(signedIn())) return null
  return (
    <p className="mt-3 text-center text-xs text-muted-foreground">
      {locale === 'en'
        ? 'A free account is required to save your event.'
        : 'Az esemény mentéséhez ingyenes fiók szükséges.'}
    </p>
  )
}

export function AccountNotice({ locale = 'hu' }: { locale?: Locale }) {
  return (
    <Suspense fallback={null}>
      <Notice locale={locale} />
    </Suspense>
  )
}
