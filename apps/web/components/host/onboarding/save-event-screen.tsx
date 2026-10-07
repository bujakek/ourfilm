'use client'

import { ArrowLeft, Check, Loader2, Mail } from 'lucide-react'
import { useActionState, useEffect, useId, useRef, useState } from 'react'

import { AuthLegalNotice } from '@/components/host/auth-legal-notice'
import { AuthDivider, GoogleSignIn } from '@/components/host/google-sign-in'
import { Button } from '@/components/ui/button'
import { inputClassName } from '@/components/ui/input'
import { sendSignInLink } from '@/lib/auth-link'
import { localeTag, type Locale } from '@/lib/i18n'
import { track } from '@/lib/telemetry'

type Result = { status: 'idle' | 'sent' | 'error'; message?: string }
const INITIAL: Result = { status: 'idle' }

/** The parent keeps the draft alive while this screen replaces the questions. */
export function SaveEventScreen({
  onBack,
  returnTo,
  creationKey,
  locale,
}: {
  onBack: () => void
  returnTo: string
  creationKey: string
  locale: Locale
}) {
  const en = locale === 'en'
  const [result, submit, pending] = useActionState(sendLink, INITIAL)
  const [googlePending, setGooglePending] = useState(false)
  const sendingRef = useRef(false)
  const headingRef = useRef<HTMLHeadingElement>(null)
  const emailId = useId()
  const sent = result.status === 'sent'

  useEffect(() => {
    headingRef.current?.focus()
  }, [sent])

  async function sendLink(
    previous: Result,
    formData: FormData,
  ): Promise<Result> {
    const email = String(formData.get('email') ?? '').trim()
    if (!email) return INITIAL
    // A second email invalidates the first link. Guard queued submissions too.
    if (sendingRef.current || googlePending) return previous
    sendingRef.current = true
    const context = {
      method: 'email' as const,
      surface: 'onboarding' as const,
      creation_key: creationKey,
    }
    track('sign_in_started', context)
    try {
      const outcome = await sendSignInLink({ email, next: returnTo, locale })
      if (outcome.status === 'sent') return outcome
      sendingRef.current = false
      track('sign_in_blocked', context)
      return outcome
    } catch {
      sendingRef.current = false
      track('sign_in_blocked', context)
      return {
        status: 'error',
        message: en
          ? 'Could not send the link. Please try again.'
          : 'Nem sikerült elküldeni a linket. Próbáld újra.',
      }
    }
  }

  return (
    <main
      lang={localeTag[locale]}
      className="min-h-[100dvh] px-6 pt-[calc(1.375rem+env(safe-area-inset-top))] pb-[calc(1.5rem+env(safe-area-inset-bottom))]"
    >
      <div className="mx-auto w-full max-w-md">
        <header className="flex items-center justify-between gap-4">
          <button
            type="button"
            onClick={onBack}
            disabled={pending || googlePending}
            aria-label={en ? 'Back to settings' : 'Vissza a beállításokhoz'}
            className="flex size-11 shrink-0 items-center justify-center rounded-lg border border-white/15 text-foreground transition-colors hover:border-white/30 disabled:opacity-50"
          >
            <ArrowLeft className="size-[19px]" aria-hidden="true" />
          </button>
          <p className="flex items-center gap-2 font-mono text-[10px] font-medium tracking-[0.08em] text-accent">
            <Check className="size-4" aria-hidden="true" />
            {en ? 'Settings complete' : 'Beállítások kész'}
          </p>
        </header>
        <h1
          ref={headingRef}
          tabIndex={-1}
          className="mt-10 font-display text-[40px] leading-[1.06] tracking-[-0.01em] text-balance"
        >
          {sent
            ? en
              ? 'Check your inbox'
              : 'Elküldtük a linket'
            : en
              ? 'Save your event'
              : 'Mentsd el az eseményed'}
        </h1>
        <p className="mt-4 text-[14.5px] leading-[1.6] text-pretty text-muted-foreground">
          {sent
            ? en
              ? 'Open the email link in this browser to finish saving your event.'
              : 'Az esemény mentéséhez ugyanebben a böngészőben nyisd meg az e-mailben kapott linket.'
            : en
              ? 'Sign in to access your QR code and gallery later.'
              : 'Lépj be, hogy később is elérd a QR-kódot és a galériát.'}
        </p>
        {sent ? (
          <Mail
            className="mt-8 size-10 text-accent"
            strokeWidth={1.6}
            aria-hidden="true"
          />
        ) : (
          <form action={submit} className="mt-8 flex flex-col gap-3">
            <GoogleSignIn
              locale={locale}
              surface="onboarding"
              next={returnTo}
              creationKey={creationKey}
              disabled={pending}
              onPendingChange={setGooglePending}
            />
            <AuthDivider locale={locale} />
            <div>
              <label
                htmlFor={emailId}
                className="mb-2 block text-sm font-medium"
              >
                {en ? 'Email address' : 'E-mail-cím'}
              </label>
              <input
                id={emailId}
                name="email"
                type="email"
                required
                autoComplete="email"
                disabled={pending || googlePending}
                placeholder={en ? 'you@example.com' : 'te@pelda.hu'}
                className={inputClassName}
              />
            </div>
            {result.status === 'error' ? (
              <p role="alert" className="text-sm text-destructive">
                {result.message}
              </p>
            ) : null}
            <Button
              type="submit"
              disabled={pending || googlePending}
              aria-busy={pending}
              size="lg"
              className="w-full"
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
                  ? 'Send a sign-in link'
                  : 'Küldj belépési linket'}
            </Button>
          </form>
        )}
        <AuthLegalNotice locale={locale} />
      </div>
    </main>
  )
}
