'use client'

import { Check, Loader2, Mail } from 'lucide-react'
import { useActionState, useRef, useState } from 'react'

import { sendSignInLink } from '@/lib/auth-link'

import { Sheet } from '@/components/host/sheet'
import { Button } from '@/components/ui/button'
import { inputClassName } from '@/components/ui/input'
import type { Locale } from '@/lib/i18n'

type Result = { status: 'idle' | 'sent' | 'error'; message?: string }

const INITIAL: Result = { status: 'idle' }

/**
 * Asks for an account at the end of the flow, not the start.
 *
 * The same magic link `/host/login` sends, and deliberately through the same
 * `sendSignInLink` — one link both signs up and signs in, so there is no
 * "register or log in?" fork to put in front of someone who has already
 * answered four questions. No new provider was added for this.
 *
 * What is different is where the link comes back to: `returnTo` carries the
 * resume route, so the callback lands on the screen that reads the draft and
 * finishes the creation rather than on the events list.
 *
 * The mail has to be opened **in this browser**. The draft lives in
 * `localStorage`, which no other device can see — the resume route says so in
 * as many words when it finds nothing, and the confirmation below says it
 * before that happens.
 */
export function AuthDialog({
  open,
  onClose,
  returnTo,
  locale = 'hu',
}: {
  open: boolean
  onClose: () => void
  /** Path the magic link should land on, already carrying whatever the resume
   *  route needs. Passed through `safeNext` on the way back. */
  returnTo: string
  locale?: Locale
}) {
  const en = locale === 'en'
  const [result, submit, pending] = useActionState(sendLink, INITIAL)
  const [existing, setExisting] = useState(false)
  const sendingRef = useRef(false)

  async function sendLink(previous: Result, formData: FormData) {
    const email = String(formData.get('email') ?? '').trim()
    if (!email) return INITIAL

    // React queues concurrent dispatches rather than dropping them, so
    // `pending` alone still allows a fast double-tap to send twice — and each
    // new magic link invalidates the previous one, so the second mail would
    // kill the link in the first.
    if (sendingRef.current) return previous
    sendingRef.current = true

    const outcome = await sendSignInLink({ email, next: returnTo, locale })

    if (outcome.status === 'error') {
      sendingRef.current = false
      return outcome
    }
    return { status: 'sent' as const }
  }

  if (result.status === 'sent') {
    return (
      <Sheet
        open={open}
        onClose={onClose}
        closeLabel={en ? 'Close' : 'Bezárás'}
        title={en ? 'Check your inbox' : 'Elküldtük a linket'}
        detail={
          en
            ? 'Open the link in this browser. Your event settings are saved on this device.'
            : 'Nézd meg a postaládádat, és koppints a linkre. Ugyanebben a böngészőben nyisd meg — az eseményed beállításai ezen az eszközön vannak elmentve.'
        }
      >
        <div className="flex items-center justify-center">
          <span className="flex size-14 items-center justify-center rounded-full bg-accent/20">
            <Check className="size-7 text-accent" strokeWidth={2.2} />
          </span>
        </div>
      </Sheet>
    )
  }

  return (
    <Sheet
      open={open}
      onClose={onClose}
      closeLabel={en ? 'Close' : 'Bezárás'}
      title={en ? 'Save your event' : 'Mentsd el az eseményed'}
      detail={
        existing
          ? en
            ? 'Enter your email and we will send you a sign-in link. Your settings are already saved.'
            : 'Add meg az e-mail-címed, és küldünk egy belépési linket. A beállításaid már el vannak mentve.'
          : en
            ? 'Create a free account so you can come back and manage your event. Your settings are already saved.'
            : 'Hozz létre egy ingyenes fiókot, hogy később is elérd és kezeld az eseményt. A beállításaid már el vannak mentve.'
      }
    >
      <form action={submit} className="flex flex-col gap-3">
        <input
          name="email"
          type="email"
          required
          autoComplete="email"
          disabled={pending}
          placeholder={en ? 'you@example.com' : 'te@pelda.hu'}
          aria-label={en ? 'Email address' : 'E-mail-cím'}
          className={inputClassName}
        />

        {result.status === 'error' ? (
          <p role="alert" className="text-sm text-destructive">
            {result.message}
          </p>
        ) : null}

        <Button
          type="submit"
          disabled={pending}
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
              ? 'Send me the link'
              : 'Küldjétek a linket'}
        </Button>

        {/* One link signs up and signs in, so this changes the wording rather
            than the flow — but a host who already has an account needs to see
            that they are in the right place. */}
        {existing ? null : (
          <button
            type="button"
            onClick={() => setExisting(true)}
            className="min-h-11 text-sm text-muted-foreground underline-offset-4 transition-colors hover:text-foreground hover:underline"
          >
            {en
              ? 'Already have an account? Sign in'
              : 'Már van fiókod? Belépés'}
          </button>
        )}
      </form>
    </Sheet>
  )
}
