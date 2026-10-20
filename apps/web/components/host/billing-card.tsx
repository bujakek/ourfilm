'use client'

import {
  type CheckoutState,
  startEventCheckout,
} from '@/app/(product)/host/events/[slug]/billing-actions'
import {
  type BillingCountry,
  type CheckoutReadiness,
  initialBillingCountry,
} from '@/lib/billing-country'
import { eventPriceLabelFor } from '@/lib/pricing'
import { Check, Loader2 } from 'lucide-react'
import { useActionState, useEffect, useId, useState } from 'react'
import { BillingCountryField } from '@/components/host/billing-country-field'
import {
  LegalDetails,
  PaidTermsAcceptance,
} from '@/components/host/paid-terms-acceptance'
import {
  HOST_PANEL,
  HOST_PAY,
  HOST_ROW_DETAIL,
  HOST_ROW_QUESTION,
  HOST_SECONDARY,
} from '@/components/host/ui/classes'
import { useSettlePolling } from '@/components/host/use-settle-polling'
import { cn } from '@/lib/utils'

const INITIAL: CheckoutState = { error: null }

export type BillingCardProps = {
  locale: 'en' | 'hu'
  slug: string
  participantLimit: number
  participantCount: number
  unlimited: boolean
  /**
   * Why the cap is lifted, already phrased for the host — a receipt, an Early
   * Couple Program line, an operator unlock. Null falls back to the card's own
   * copy, which is what an admin-owned event gets. Built by `planNote()` so the
   * reasons cannot drift into describing each other.
   */
  planNote: string | null
  /** Which side of the HU / non-HU boundary this deployment can sell to. */
  readiness: CheckoutReadiness
  /** The country this host confirmed on an earlier attempt, if any. */
  savedBillingCountry: string | null
  /** A suggested default on the checkout screen; always editable. */
  suggestedBillingCountry: BillingCountry | null
  checkout: 'success' | 'cancelled' | null
  presentation?: 'settings' | 'checkout'
}

/**
 * The billing state of one event, and the one button that changes it.
 *
 * The cap counts **participants**, not photos. Every guest gets the host's
 * chosen roll of film whether or not the event is paid for; what paying buys is
 * more guests. So the question this card answers is "can another friend join",
 * which is also the only way a host ever runs into the limit.
 *
 * In settings it is one quiet row — "Ingyenes esemény · 4/5 vendég" and a
 * "Feloldás" button — and the country, the withdrawal waiver and the sky pay
 * button appear only after that tap. It opens already expanded when the URL
 * says `#billing`, which is where the event page's quota banner links, so the
 * host lands ready to pay; and after a cancelled checkout, which is a host
 * coming back mid-decision. The post-save checkout screen shows the form
 * straight away.
 *
 * The pay button stays at 40% until the waiver is ticked and a country is
 * chosen. The checkbox is still a real `required` input named
 * `legal_acceptance`: `startEventCheckout` checks it on the server.
 */
export function BillingCard({
  locale,
  slug,
  participantLimit,
  participantCount,
  unlimited,
  planNote,
  readiness,
  savedBillingCountry,
  suggestedBillingCountry,
  checkout,
  presentation = 'settings',
}: BillingCardProps) {
  const en = locale === 'en'
  const standalone = presentation === 'checkout'
  const formId = useId()
  const [state, submit, pending] = useActionState(startEventCheckout, INITIAL)
  const stripeReady = readiness.domestic || readiness.international
  // Controlled, so the price follows the choice before anything is
  // submitted. Where it starts is `initialBillingCountry`'s decision, the
  // same on the checkout screen and in settings.
  const [country, setCountry] = useState<BillingCountry | null>(() =>
    initialBillingCountry({
      saved: savedBillingCountry,
      locale,
      ipCountry: suggestedBillingCountry,
    }),
  )
  const [accepted, setAccepted] = useState(false)
  const [open, setOpen] = useState(checkout === 'cancelled')

  // The hash only exists in the browser, so it is read after mount — in a
  // timeout, because a synchronous setState in an effect body is a cascading
  // render. `hashchange` covers a page already open when the link is followed.
  useEffect(() => {
    const read = () => {
      if (window.location.hash === '#billing') setOpen(true)
    }
    const timer = window.setTimeout(read, 0)
    window.addEventListener('hashchange', read)
    return () => {
      window.clearTimeout(timer)
      window.removeEventListener('hashchange', read)
    }
  }, [])

  // Stripe's redirect lands before the webhook does; `useSettlePolling` says
  // why that gap is polled rather than waited out.
  const settling = checkout === 'success' && !unlimited
  useSettlePolling(settling)

  if (unlimited) {
    return (
      <section className={`${HOST_PANEL} p-5`}>
        <p className={HOST_ROW_QUESTION}>
          {en ? 'Full event' : 'Teljes esemény'}
        </p>
        <p className={HOST_ROW_DETAIL}>
          {planNote ??
            (en
              ? 'Unlimited guests — this account has no participant cap.'
              : 'Ehhez a fiókhoz nem tartozik vendégkorlát.')}
        </p>
      </section>
    )
  }

  const full = participantCount >= participantLimit
  const expanded = standalone || open

  const form = stripeReady ? (
    <form action={submit} className="flex flex-col gap-3">
      <input type="hidden" name="slug" value={slug} />
      <input type="hidden" name="locale" value={locale} />
      <input
        type="hidden"
        name="source"
        value={standalone ? 'onboarding' : 'settings'}
      />
      <p className={HOST_ROW_DETAIL}>
        {en
          ? 'A one-time fee for this event, with unlimited guests.'
          : 'Egyszeri díj ennél az eseménynél, korlátlan vendéggel.'}
      </p>
      <BillingCountryField
        locale={locale}
        name="billing_country"
        value={country}
        onChange={setCountry}
        suggested={suggestedBillingCountry}
        compact={standalone}
      />
      {country ? (
        <p aria-live="polite" className="flex flex-wrap items-baseline gap-x-2">
          <span className="host-figure text-[28px] leading-none whitespace-nowrap text-white">
            {eventPriceLabelFor(country)}
          </span>
          <span className="text-[14px] text-white/65">
            {en ? 'one-time payment' : 'egyszeri díj'}
          </span>
        </p>
      ) : null}
      <label className="flex min-h-11 cursor-pointer items-start gap-3 text-[13px] leading-[1.5] text-white/65">
        <input
          type="checkbox"
          name="legal_acceptance"
          required
          checked={accepted}
          onChange={(event) => setAccepted(event.target.checked)}
          className="peer sr-only"
        />
        <span
          aria-hidden="true"
          className={`mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-[6px] transition-colors peer-focus-visible:ring-2 peer-focus-visible:ring-white/60 ${
            accepted ? 'bg-white text-landing-ink' : 'bg-white/14'
          }`}
        >
          {accepted ? <Check className="size-3.5" strokeWidth={3} /> : null}
        </span>
        <PaidTermsAcceptance locale={locale} />
      </label>
      <div className="-mt-2 ml-8">
        <LegalDetails locale={locale} />
      </div>
      <button
        type="submit"
        // A country the deployment cannot sell to is refused by the action
        // with a sentence, which is the explanation the host needs.
        disabled={pending || !country || !accepted}
        aria-busy={pending}
        className={`${HOST_PAY} w-full gap-2 whitespace-normal`}
      >
        {pending ? (
          <Loader2 className="size-4 animate-spin" aria-hidden="true" />
        ) : null}
        {pending
          ? en
            ? 'Redirecting…'
            : 'Átirányítás…'
          : standalone
            ? en
              ? 'Continue to payment →'
              : 'Tovább a fizetéshez →'
            : en
              ? 'Unlock with payment →'
              : 'Feloldás fizetéssel →'}
      </button>
      <p className="text-center text-[13px] text-white/65">
        {en
          ? 'No subscription. No app for guests.'
          : 'Nincs előfizetés. A vendégeknek nem kell app.'}
      </p>
      {state.error ? (
        <p role="alert" className="text-[14px] text-host-danger">
          {state.error}
        </p>
      ) : null}
    </form>
  ) : (
    // Honest about the state of the world rather than offering a button
    // that would 500 — no STRIPE_* variables are set in this environment.
    <p className="rounded-[16px] bg-host-tile px-4 py-3 text-[14px] leading-[1.5] text-white/65">
      {en
        ? 'Payments are not enabled yet. Contact us and we can unlock the event manually.'
        : 'A fizetés még nincs beállítva. Addig is használhatod az albumot, segítségért pedig írj nekünk.'}
    </p>
  )

  return (
    <section className={`${HOST_PANEL} p-5`}>
      {!standalone ? (
        <div className="flex items-center gap-4">
          <div className="min-w-0 flex-1">
            <p className={HOST_ROW_QUESTION}>
              {en ? 'Free event' : 'Ingyenes esemény'}
            </p>
            <p className={HOST_ROW_DETAIL}>
              <span className="host-figure text-[18px] text-white">
                {participantCount}/{participantLimit}
              </span>{' '}
              {en ? 'guests' : 'vendég'}
              {full ? (
                <span className="text-host-warn">
                  {en ? ' · Full' : ' · Betelt'}
                </span>
              ) : null}
            </p>
          </div>
          {stripeReady ? (
            <button
              type="button"
              aria-expanded={open}
              aria-controls={formId}
              onClick={() => setOpen((value) => !value)}
              className={cn(
                HOST_SECONDARY,
                'h-11 shrink-0 rounded-[14px] px-4 text-[14px]',
              )}
            >
              {open ? (en ? 'Cancel' : 'Mégsem') : en ? 'Unlock' : 'Feloldás'}
            </button>
          ) : null}
        </div>
      ) : null}

      {full && !standalone ? (
        <p className={`mt-2 ${HOST_ROW_DETAIL}`}>
          {en
            ? 'New guests cannot join. Everyone already in can keep shooting.'
            : 'Új vendég nem tud csatlakozni, aki pedig már csatlakozott, továbbra is fotózhat.'}
        </p>
      ) : null}

      {settling ? (
        <p className="mt-3 flex items-center gap-2 text-[14px] text-white/65">
          <Loader2 className="size-4 animate-spin" aria-hidden="true" />
          {en
            ? 'Processing the payment — this takes a few seconds.'
            : 'Feldolgozzuk a fizetést. Ez általában csak néhány másodpercig tart.'}
        </p>
      ) : null}

      {checkout === 'cancelled' && !settling ? (
        <p className="mt-3 text-[14px] text-white/65">
          {en
            ? 'Payment was cancelled. You were not charged.'
            : 'A fizetést megszakítottad. Nem történt terhelés.'}
        </p>
      ) : null}

      {!stripeReady ? (
        <div className={standalone ? '' : 'mt-4'}>{form}</div>
      ) : (
        <div
          id={formId}
          hidden={!expanded}
          className={standalone ? '' : 'mt-4'}
        >
          {expanded ? form : null}
        </div>
      )}
    </section>
  )
}
