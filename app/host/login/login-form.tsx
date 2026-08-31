'use client'

import { createClient } from '@/lib/supabase/client'
import { Check, Loader2, Mail } from 'lucide-react'
import { useActionState, useRef } from 'react'
import type { Locale } from '@/lib/i18n'

type Result = { status: 'idle' | 'sent' | 'error'; message?: string }

const INITIAL: Result = { status: 'idle' }

export function LoginForm({
  linkError,
  locale,
}: {
  linkError: boolean
  locale: Locale
}) {
  const en = locale === 'en'
  // Not hand-rolled useState, and the difference is visible: `<form action>`
  // runs its function inside a transition, and a transition deliberately
  // suppresses intermediate renders — it holds the current UI rather than
  // flashing a loading state. A manual setState('sending') therefore never
  // reliably painted, so the spinner and the disabled styling did not appear.
  // `useActionState` exposes the pending flag React itself manages, which is
  // the one that renders. Same shape as the other admin forms.
  const [result, submit, pending] = useActionState(sendLink, INITIAL)

  // React queues concurrent dispatches rather than dropping them, so `pending`
  // alone still allows a fast double-tap to send twice. This flips
  // synchronously and is what actually closes that window — each new magic
  // link invalidates the previous one, so the second mail would kill the first.
  const sendingRef = useRef(false)

  async function sendLink(
    previous: Result,
    formData: FormData,
  ): Promise<Result> {
    const email = String(formData.get('email') ?? '').trim()
    if (!email) return INITIAL

    if (sendingRef.current) return previous
    sendingRef.current = true

    const supabase = createClient()
    const callbackUrl = new URL('/auth/callback', window.location.origin)
    callbackUrl.searchParams.set('next', `/host?lang=${locale}`)
    callbackUrl.searchParams.set('lang', locale)
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: {
        // Must also be listed under Redirect URLs in the Supabase dashboard,
        // or the link comes back rejected.
        emailRedirectTo: callbackUrl.toString(),
        // The same link signs in and signs up. Safe because owner_id scoping
        // is enforced in the database, not the UI: a brand-new account sees an
        // empty admin, never anyone else's events. Verified with a second real
        // account.
        shouldCreateUser: true,
        // Used as a fallback by the Send Email Hook for legacy callers whose
        // redirect URL does not carry a locale.
        data: { locale },
      },
    })

    if (error) {
      // Released only on failure. On success the form unmounts for the
      // confirmation card, so there is nothing left to submit twice.
      sendingRef.current = false
      return {
        status: 'error',
        message: en
          ? 'We could not send the link. Please try again in a moment.'
          : 'Nem sikerült elküldeni. Próbáld újra egy kicsit később.',
      }
    }

    return { status: 'sent' }
  }

  if (result.status === 'sent') {
    return (
      <div className="glass-strong flex flex-col items-center gap-3 rounded-3xl px-6 py-8 text-center">
        <span className="flex size-14 items-center justify-center rounded-full bg-accent/20">
          <Check className="size-7 text-accent" strokeWidth={2.2} />
        </span>
        <p className="text-lg font-semibold">
          {en ? 'Check your inbox' : 'Elküldtük a belépési linket'}
        </p>
        <p className="max-w-xs text-sm leading-relaxed text-pretty text-muted-foreground">
          {en
            ? 'Open the link on this device to finish signing in.'
            : 'Nézd meg a postaládádat, és koppints a linkre. Ugyanezen az eszközön nyisd meg, ahol most vagy.'}
        </p>
      </div>
    )
  }

  return (
    <form action={submit} className="flex flex-col gap-4">
      <div>
        <label
          htmlFor="email"
          className="mb-2 block text-sm text-muted-foreground"
        >
          {en ? 'Email address' : 'E-mail-cím'}
        </label>
        <input
          id="email"
          name="email"
          type="email"
          required
          autoComplete="email"
          autoFocus
          disabled={pending}
          placeholder={en ? 'you@example.com' : 'te@pelda.hu'}
          className="glass min-h-14 w-full rounded-2xl px-5 text-base text-foreground outline-none placeholder:text-muted-foreground/60 focus:border-accent disabled:opacity-60"
        />
      </div>

      {linkError || result.status === 'error' ? (
        <p className="text-sm text-destructive">
          {result.status === 'error'
            ? result.message
            : en
              ? 'This link has expired or has already been used. Request a new one.'
              : 'Ez a link lejárt vagy már felhasználtad. Kérj egy újat.'}
        </p>
      ) : null}

      <button
        type="submit"
        disabled={pending}
        aria-busy={pending}
        className="btn-shine inline-flex min-h-14 items-center justify-center gap-2 rounded-full bg-primary px-7 text-base font-semibold text-primary-foreground disabled:opacity-60"
      >
        {pending ? (
          <Loader2 className="size-5 animate-spin" aria-hidden="true" />
        ) : (
          <Mail className="size-5" strokeWidth={1.8} aria-hidden="true" />
        )}
        {pending
          ? en
            ? 'Sending…'
            : 'Küldés…'
          : en
            ? 'Send sign-in link'
            : 'Kérem a belépési linket'}
      </button>
    </form>
  )
}
