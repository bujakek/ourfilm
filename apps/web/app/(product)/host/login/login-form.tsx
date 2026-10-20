'use client'

import { ArrowRight, Loader2 } from 'lucide-react'
import {
  startTransition,
  useActionState,
  useEffect,
  useId,
  useRef,
  useState,
} from 'react'

import { AuthLegalNotice } from '@/components/host/auth-legal-notice'
import { AuthDivider, GoogleSignIn } from '@/components/host/google-sign-in'
import {
  HOST_FIELD,
  HOST_FOCUS,
  HOST_PANEL,
  HOST_PRIMARY,
  HOST_SECONDARY,
  HOST_TITLE,
} from '@/components/host/ui/classes'
import { StateNotice } from '@/components/host/ui/state-notice'
import { sendSignInLink } from '@/lib/auth-link'
import { resendSecondsLeft, SIGN_IN_LINK_TTL_MINUTES } from '@/lib/host-ui'
import type { Locale } from '@/lib/i18n'
import { track } from '@/lib/telemetry'

/**
 * `sent` survives a failed resend, so the confirmation stays on screen with
 * the error under it rather than dropping the host back to an empty form.
 */
type LoginState = {
  sent: { email: string; sentAt: number } | null
  error: string | null
}

const INITIAL: LoginState = { sent: null, error: null }

function countdown(seconds: number): string {
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`
}

export function LoginForm({
  linkError,
  oauthError,
  next,
  locale,
}: {
  linkError: boolean
  oauthError: boolean
  next: string
  locale: Locale
}) {
  const en = locale === 'en'
  const emailId = useId()
  const [googlePending, setGooglePending] = useState(false)
  // Controlled, because React resets an uncontrolled form after its action
  // runs, and "Másik e-mail-cím" has to come back with the address in it.
  const [email, setEmail] = useState('')
  // Not hand-rolled useState, and the difference is visible: `<form action>`
  // runs its function inside a transition, and a transition deliberately
  // suppresses intermediate renders — it holds the current UI rather than
  // flashing a loading state. A manual setState('sending') therefore never
  // reliably painted, so the spinner and the disabled styling did not appear.
  // `useActionState` exposes the pending flag React itself manages, which is
  // the one that renders. The resend goes through the same dispatch.
  const [state, dispatch, pending] = useActionState(sendLink, INITIAL)

  // React queues concurrent dispatches rather than dropping them, so `pending`
  // alone still allows a fast double-tap to send twice. This flips
  // synchronously and is what actually closes that window — each new magic
  // link invalidates the previous one, so the second mail would kill the first.
  const sendingRef = useRef(false)

  // "Másik e-mail-cím" marks the send it stepped back from. A later send is a
  // new object, so the confirmation returns without anything resetting this.
  const [editing, setEditing] = useState<LoginState['sent']>(null)
  const sent = state.sent !== null && state.sent !== editing ? state.sent : null

  // Ticks from the last send, on the confirmation and after "Másik
  // e-mail-cím" alike: going back to the form is not a way round the
  // cooldown. Zero until the first tick, which `resendSecondsLeft` reads as
  // the full cooldown.
  const [now, setNow] = useState(0)
  const sentAt = state.sent?.sentAt
  useEffect(() => {
    if (sentAt === undefined) return
    const timer = window.setInterval(() => setNow(Date.now()), 1000)
    return () => window.clearInterval(timer)
  }, [sentAt])
  const wait = state.sent ? resendSecondsLeft(state.sent.sentAt, now) : 0
  // Only the address the last link went to waits; another one sends at once.
  const sameAddress = (address: string, last: LoginState['sent']) =>
    last !== null && address.trim().toLowerCase() === last.email.toLowerCase()
  const formWait = sameAddress(email, state.sent) ? wait : 0

  const headingRef = useRef<HTMLHeadingElement>(null)
  const hasSent = sent !== null
  useEffect(() => {
    if (hasSent) headingRef.current?.focus()
  }, [hasSent])

  async function sendLink(
    previous: LoginState,
    formData: FormData,
  ): Promise<LoginState> {
    const address = String(formData.get('email') ?? '').trim()
    if (!address) return previous

    if (sendingRef.current || googlePending) return previous
    // The same check as the disabled button, for an Enter that beats it.
    if (
      previous.sent &&
      sameAddress(address, previous.sent) &&
      resendSecondsLeft(previous.sent.sentAt, Date.now()) > 0
    ) {
      return previous
    }
    sendingRef.current = true

    const context = { method: 'email' as const, surface: 'login' as const }
    track('sign_in_started', context)
    try {
      const outcome = await sendSignInLink({ email: address, next, locale })
      if (outcome.status === 'error') {
        track('sign_in_blocked', context)
        return { sent: previous.sent, error: outcome.message ?? null }
      }
      const at = Date.now()
      // The countdown reads from this send, not from a tick up to a second
      // older than it.
      setNow(at)
      return { sent: { email: address, sentAt: at }, error: null }
    } catch {
      track('sign_in_blocked', context)
      return {
        sent: previous.sent,
        error: en
          ? 'Could not send the link. Please try again.'
          : 'Nem sikerült elküldeni a linket. Próbáld újra.',
      }
    } finally {
      // The cooldown is what spaces out resends; this only covers the
      // request itself.
      sendingRef.current = false
    }
  }

  function resend() {
    if (!sent || wait > 0) return
    const formData = new FormData()
    formData.set('email', sent.email)
    startTransition(() => dispatch(formData))
  }

  const errorLine = state.error ? (
    <p
      role="alert"
      className="mt-2.5 text-[14px] leading-[1.5] text-pretty text-host-danger"
    >
      {state.error}
    </p>
  ) : null

  if (sent) {
    return (
      <section className={`${HOST_PANEL} px-6 py-8`}>
        <h1
          ref={headingRef}
          tabIndex={-1}
          className="landing-serif font-landing-display text-[30px] leading-[1.15] text-balance text-white outline-none"
        >
          {en ? 'Check your inbox' : 'Nézd meg a postaládád'}
        </h1>
        <p className="mt-3 text-[15px] leading-[1.6] text-pretty text-white/65">
          {en ? (
            <>
              We sent the sign-in link to{' '}
              <span className="break-all text-white">{sent.email}</span>. It
              works for {SIGN_IN_LINK_TTL_MINUTES} minutes, in this browser. If
              you cannot see it, check your spam folder too.
            </>
          ) : (
            <>
              Elküldtük a belépő linket erre a címre:{' '}
              <span className="break-all text-white">{sent.email}</span>.{' '}
              {SIGN_IN_LINK_TTL_MINUTES} percig érvényes, ebben a böngészőben
              nyisd meg. Ha nem látod, nézd meg a spamet is.
            </>
          )}
        </p>
        <button
          type="button"
          onClick={resend}
          disabled={wait > 0 || pending}
          aria-busy={pending}
          className={`${HOST_SECONDARY} mt-6 w-full gap-2`}
        >
          {pending ? (
            <Loader2 className="size-5 animate-spin" aria-hidden="true" />
          ) : null}
          {en ? 'Send a new link' : 'Új link küldése'}
          {wait > 0 ? (
            <span className="tabular-nums">· {countdown(wait)}</span>
          ) : null}
        </button>
        {errorLine}
        <button
          type="button"
          onClick={() => {
            setEmail(sent.email)
            setEditing(sent)
          }}
          disabled={pending}
          className={`mt-2 inline-flex min-h-12 w-full items-center justify-center rounded-[14px] text-[14px] font-medium text-white/65 transition-colors hover:text-white disabled:opacity-40 ${HOST_FOCUS}`}
        >
          {en ? 'Use another email address' : 'Másik e-mail-cím'}
        </button>
      </section>
    )
  }

  // 7i. The callback's URL carries no address, so the host types it again;
  // nothing remembers the one that link went to.
  const expired = linkError && state.sent === null

  const emailForm = (
    <form action={dispatch} className="flex flex-col">
      <label htmlFor={emailId} className="sr-only">
        {en ? 'Email address' : 'E-mail-cím'}
      </label>
      <input
        id={emailId}
        name="email"
        type="email"
        required
        autoComplete="email"
        value={email}
        onChange={(event) => setEmail(event.target.value)}
        disabled={pending || googlePending}
        placeholder={en ? 'you@example.com' : 'te@pelda.hu'}
        className={HOST_FIELD}
      />
      {errorLine}
      <button
        type="submit"
        disabled={pending || googlePending || formWait > 0}
        aria-busy={pending}
        className={`${HOST_PRIMARY} mt-3 w-full gap-2`}
      >
        {pending ? (
          <Loader2 className="size-5 animate-spin" aria-hidden="true" />
        ) : null}
        {pending
          ? en
            ? 'Sending…'
            : 'Küldés…'
          : expired
            ? en
              ? 'Send a new link'
              : 'Új link küldése'
            : en
              ? 'Send me the link'
              : 'Küldjétek a linket'}
        {formWait > 0 && !pending ? (
          <span className="tabular-nums">· {countdown(formWait)}</span>
        ) : null}
        {pending || expired || formWait > 0 ? null : (
          <ArrowRight
            className="size-[18px]"
            strokeWidth={2}
            aria-hidden="true"
          />
        )}
      </button>
    </form>
  )

  if (expired) {
    return (
      <>
        <h1 className="sr-only">{en ? 'Sign in' : 'Belépés'}</h1>
        <StateNotice
          tone="neutral"
          title={en ? 'This link has expired' : 'Ez a link lejárt'}
          body={
            en
              ? `Sign-in links work for ${SIGN_IN_LINK_TTL_MINUTES} minutes and only once. Enter your email address and we will send a new one.`
              : `A belépő linkek ${SIGN_IN_LINK_TTL_MINUTES} percig érvényesek, és egyszer használhatók. Add meg az e-mail-címed, és küldünk egy újat.`
          }
        />
        <div className="mt-4">{emailForm}</div>
        <AuthLegalNotice locale={locale} />
      </>
    )
  }

  return (
    <>
      <h1 className={HOST_TITLE}>{en ? 'Sign in' : 'Belépés'}</h1>
      <p className="mt-3 text-[16px] leading-[1.6] text-pretty text-white/65">
        {en
          ? 'No password needed. If you do not have an account yet, this creates one.'
          : 'Jelszó nélkül lépsz be. Ha még nincs fiókod, ezzel létrejön.'}
      </p>
      {/* Above Google, with the button it is about — below the divider the
          message reads as a complaint about the email form. */}
      {oauthError ? (
        <div className="mt-6">
          <StateNotice
            tone="neutral"
            title={
              en
                ? 'Google sign-in was not completed'
                : 'A Google-belépés nem fejeződött be'
            }
            body={
              en
                ? 'Try again or use an email link.'
                : 'Próbáld újra, vagy kérj e-mailes linket.'
            }
          />
        </div>
      ) : null}
      <div className="mt-7 flex flex-col">
        <GoogleSignIn
          locale={locale}
          surface="login"
          next={next}
          disabled={pending}
          onPendingChange={setGooglePending}
          className={`${HOST_SECONDARY} w-full gap-2.5`}
        />
        <AuthDivider locale={locale} />
        {emailForm}
      </div>
      <AuthLegalNotice locale={locale} />
    </>
  )
}
