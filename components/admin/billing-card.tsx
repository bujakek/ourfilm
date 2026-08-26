'use client'

import {
  type CheckoutState,
  startEventCheckout,
} from '@/app/admin/events/[slug]/billing-actions'
import { EVENT_PRICE_LABEL } from '@/lib/pricing'
import { cn } from '@/lib/utils'
import { CreditCard, Loader2, Users } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { useActionState, useEffect, useState } from 'react'

const INITIAL: CheckoutState = { error: null }

/** How long to keep re-checking after Stripe sends the host back. */
const SETTLE_POLL_MS = 2000
const SETTLE_POLL_TRIES = 6

export type BillingCardProps = {
  slug: string
  participantLimit: number
  participantCount: number
  unlimited: boolean
  /** Set when the cap is lifted by a payment rather than by the owner's role. */
  paidLabel: string | null
  stripeReady: boolean
  checkout: 'success' | 'cancelled' | null
}

/**
 * The billing state of one event, and the one button that changes it.
 *
 * The cap counts **participants**, not photos. Every guest gets the host's
 * chosen roll of film whether or not the event is paid for; what paying buys is
 * more guests. So the question this card answers is "can another friend join",
 * which is also the only way a host ever runs into the limit.
 *
 * No per-guest price and no tiers anywhere: one event, one payment.
 */
export function BillingCard({
  slug,
  participantLimit,
  participantCount,
  unlimited,
  paidLabel,
  stripeReady,
  checkout,
}: BillingCardProps) {
  const [state, submit, pending] = useActionState(startEventCheckout, INITIAL)

  // Stripe redirects the host back the instant checkout finishes, which is
  // often before the webhook that records it has landed. Without this the
  // first thing a host sees after paying is their album still saying it is
  // capped, so the page re-reads itself for a few seconds rather than making
  // them wonder whether the money went anywhere.
  const settling = checkout === 'success' && !unlimited
  useSettlePolling(settling)

  if (unlimited) {
    return (
      <div className="glass rounded-2xl px-5 py-4">
        <div className="flex items-center gap-3">
          <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-accent/20">
            <Users className="size-5 text-accent" strokeWidth={1.8} />
          </span>
          <div className="min-w-0">
            <p className="font-medium">Teljes esemény</p>
            <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
              {paidLabel ??
                'Korlátlan résztvevő — ehhez a fiókhoz nem tartozik keret.'}
            </p>
          </div>
        </div>
      </div>
    )
  }

  const used = Math.min(participantCount, participantLimit)
  const left = Math.max(participantLimit - participantCount, 0)
  const full = left === 0

  return (
    <div className="glass rounded-2xl px-5 py-4">
      <div className="flex items-baseline justify-between gap-4">
        <p className="font-medium">Ingyenes esemény</p>
        <p
          className={cn(
            'text-sm tabular-nums',
            full ? 'text-destructive' : 'text-muted-foreground',
          )}
        >
          {participantCount} / {participantLimit} résztvevő
        </p>
      </div>

      <div
        className="mt-3 h-1.5 w-full overflow-hidden rounded-full bg-white/10"
        role="progressbar"
        aria-valuenow={used}
        aria-valuemin={0}
        aria-valuemax={participantLimit}
        aria-label="Felhasznált résztvevői keret"
      >
        <div
          className={cn(
            'h-full rounded-full transition-[width]',
            full ? 'bg-destructive' : 'bg-accent',
          )}
          style={{
            width: `${Math.min((used / participantLimit) * 100, 100)}%`,
          }}
        />
      </div>

      <p className="mt-3 text-xs leading-relaxed text-muted-foreground">
        {full
          ? 'A keret betelt — új vendég egyelőre nem tud csatlakozni. Aki már csatlakozott, változatlanul fotózhat.'
          : `Még ${left} vendég csatlakozhat. Utána új résztvevőt nem tudunk beengedni, amíg fel nem oldod.`}
      </p>

      {settling ? (
        <p className="mt-4 flex items-center gap-2 text-xs text-muted-foreground">
          <Loader2 className="size-3.5 animate-spin" aria-hidden="true" />
          Feldolgozzuk a fizetést — ez néhány másodperc.
        </p>
      ) : null}

      {checkout === 'cancelled' && !settling ? (
        <p className="mt-4 text-xs text-muted-foreground">
          A fizetést megszakítottad. Nem történt terhelés.
        </p>
      ) : null}

      {stripeReady ? (
        <form action={submit} className="mt-4">
          <input type="hidden" name="slug" value={slug} />
          <button
            type="submit"
            disabled={pending}
            aria-busy={pending}
            className="btn-shine inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-full bg-primary px-6 text-sm font-semibold text-primary-foreground disabled:opacity-60"
          >
            {pending ? (
              <Loader2 className="size-4 animate-spin" aria-hidden="true" />
            ) : (
              <CreditCard
                className="size-4"
                strokeWidth={1.8}
                aria-hidden="true"
              />
            )}
            {pending
              ? 'Átirányítás…'
              : `Teljes esemény feloldása – ${EVENT_PRICE_LABEL}`}
          </button>
          <p className="mt-2 text-center text-xs text-muted-foreground">
            Korlátlan résztvevő, egyszeri fizetéssel.
          </p>
        </form>
      ) : (
        // Honest about the state of the world rather than offering a button
        // that would 500 — no STRIPE_* variables are set in this environment.
        <p className="mt-4 rounded-xl bg-white/5 px-4 py-3 text-xs leading-relaxed text-muted-foreground">
          A fizetés még nincs bekapcsolva. Amíg nincs, írj nekünk, és feloldjuk
          neked kézzel.
        </p>
      )}

      {state.error ? (
        <p className="mt-3 text-xs text-destructive">{state.error}</p>
      ) : null}
    </div>
  )
}

/**
 * Re-render the page every couple of seconds while a payment settles, then
 * stop.
 *
 * Bounded on purpose. An unbounded poll would keep a tab hitting the server
 * forever when a webhook is misconfigured — which is exactly the situation
 * where nobody is watching — and the host is better served by the page going
 * quiet and them reloading than by a spinner that never resolves.
 */
function useSettlePolling(active: boolean) {
  const router = useRouter()
  const [tries, setTries] = useState(0)

  useEffect(() => {
    if (!active || tries >= SETTLE_POLL_TRIES) return
    const timer = setTimeout(() => {
      setTries((n) => n + 1)
      router.refresh()
    }, SETTLE_POLL_MS)
    return () => clearTimeout(timer)
  }, [active, tries, router])
}
