'use client'

import { ArrowLeft, ArrowRight, Check, Loader2, Mail } from 'lucide-react'
import { useActionState, useEffect, useId, useRef, useState } from 'react'

import { AuthLegalNotice } from '@/components/host/auth-legal-notice'
import { GoogleSignIn } from '@/components/host/google-sign-in'
import {
  HOST_FIELD,
  HOST_ICON_BUTTON,
  HOST_KICKER,
  HOST_KICKER_BASE,
  HOST_PRIMARY,
  HOST_QUESTION,
  HOST_SECONDARY,
} from '@/components/host/ui/classes'
import { sendSignInLink } from '@/lib/auth-link'
import { localeTag, type Locale } from '@/lib/i18n'
import { track } from '@/lib/telemetry'

type Result = { status: 'idle' | 'sent' | 'error'; message?: string }
const INITIAL: Result = { status: 'idle' }

/**
 * The account, asked for at the end (6e). The parent keeps the draft alive
 * while this screen replaces the questions.
 */
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
      className="min-h-[100dvh] px-5 pt-[calc(1.25rem+env(safe-area-inset-top))] pb-[calc(1.5rem+env(safe-area-inset-bottom))]"
    >
      <div className="mx-auto w-full max-w-md">
        <header className="flex items-center justify-between gap-4">
          <button
            type="button"
            onClick={onBack}
            disabled={pending || googlePending}
            aria-label={en ? 'Back to settings' : 'Vissza a beállításokhoz'}
            className={HOST_ICON_BUTTON}
          >
            <ArrowLeft className="size-[19px]" aria-hidden="true" />
          </button>
          <p className={`${HOST_KICKER} flex items-center gap-2`}>
            <Check className="size-4" aria-hidden="true" />
            {en ? 'Settings ready' : 'Beállítások kész'}
          </p>
        </header>
        <h1
          ref={headingRef}
          tabIndex={-1}
          className={`mt-10 outline-none ${HOST_QUESTION}`}
        >
          {sent
            ? en
              ? 'Check your inbox'
              : 'Nézd meg a postaládád'
            : en
              ? 'Save your event'
              : 'Mentsd el az eseményed'}
        </h1>
        <p className="mt-3 text-[15px] leading-[1.6] text-pretty text-white/65">
          {sent
            ? en
              ? 'Open the email link in this browser to finish saving your event.'
              : 'Az esemény mentéséhez ugyanebben a böngészőben nyisd meg az e-mailben kapott linket.'
            : en
              ? 'Create a free account so you can reach and manage the event later. Your answers are kept in this browser.'
              : 'Hozz létre egy ingyenes fiókot, hogy később is elérd és kezeld az eseményt. A válaszaidat ez a böngésző őrzi.'}
        </p>
        {sent ? (
          <Mail
            className="mt-8 size-10 text-white/65"
            strokeWidth={1.6}
            aria-hidden="true"
          />
        ) : (
          <form action={submit} className="mt-6 flex flex-col">
            <GoogleSignIn
              locale={locale}
              surface="onboarding"
              next={returnTo}
              creationKey={creationKey}
              disabled={pending}
              onPendingChange={setGooglePending}
              className={`${HOST_SECONDARY} w-full gap-2.5`}
            />
            <p
              aria-hidden="true"
              className={`${HOST_KICKER_BASE} my-3.5 text-center text-white/65`}
            >
              {en ? 'or' : 'vagy'}
            </p>
            <label htmlFor={emailId} className="sr-only">
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
              className={HOST_FIELD}
            />
            {result.status === 'error' ? (
              <p
                role="alert"
                className="mt-2.5 text-[14px] leading-[1.5] text-pretty text-host-danger"
              >
                {result.message}
              </p>
            ) : null}
            <button
              type="submit"
              disabled={pending || googlePending}
              aria-busy={pending}
              className={`${HOST_PRIMARY} mt-2.5 w-full gap-2`}
            >
              {pending ? (
                <Loader2 className="size-5 animate-spin" aria-hidden="true" />
              ) : null}
              {pending
                ? en
                  ? 'Sending…'
                  : 'Küldés…'
                : en
                  ? 'Send me the link'
                  : 'Küldjétek a linket'}
              {pending ? null : (
                <ArrowRight
                  className="size-[18px]"
                  strokeWidth={2}
                  aria-hidden="true"
                />
              )}
            </button>
          </form>
        )}
        <AuthLegalNotice locale={locale} />
      </div>
    </main>
  )
}
