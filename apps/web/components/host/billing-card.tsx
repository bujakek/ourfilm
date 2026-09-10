'use client'

import {
  type CheckoutState,
  startEventCheckout,
} from '@/app/(product)/host/events/[slug]/billing-actions'
import { eventPriceLabel } from '@/lib/pricing'
import { cn } from '@/lib/utils'
import { CreditCard, Loader2, Users } from 'lucide-react'
import { useActionState } from 'react'
import { Button } from '@/components/ui/button'
import { PaidTermsAcceptance } from '@/components/host/paid-terms-acceptance'
import { useSettlePolling } from '@/components/host/use-settle-polling'

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
  locale,
  slug,
  participantLimit,
  participantCount,
  unlimited,
  planNote,
  stripeReady,
  checkout,
}: BillingCardProps) {
  const en = locale === 'en'
  const [state, submit, pending] = useActionState(startEventCheckout, INITIAL)

  // Stripe's redirect lands before the webhook does; `useSettlePolling` says
  // why that gap is polled rather than waited out.
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
            <p className="font-medium">
              {en ? 'Full event' : 'Teljes esemény'}
            </p>
            <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
              {planNote ??
                (en
                  ? 'Unlimited guests — this account has no participant cap.'
                  : 'Ehhez a fiókhoz nem tartozik vendégkorlát.')}
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
        <p className="font-medium">{en ? 'Free event' : 'Ingyenes esemény'}</p>
        <p
          className={cn(
            'text-sm tabular-nums',
            full ? 'text-destructive' : 'text-muted-foreground',
          )}
        >
          {participantCount} / {participantLimit} {en ? 'guests' : 'vendég'}
        </p>
      </div>

      <div
        className="mt-3 h-1.5 w-full overflow-hidden rounded-full bg-white/10"
        role="progressbar"
        aria-valuenow={used}
        aria-valuemin={0}
        aria-valuemax={participantLimit}
        aria-label={en ? 'Guest allowance used' : 'Csatlakozott vendégek'}
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
          ? en
            ? 'The allowance is full. Existing guests can still take photos.'
            : 'Betelt a vendégkeret. Új vendég egyelőre nem tud csatlakozni, aki pedig már csatlakozott, továbbra is fotózhat.'
          : en
            ? `${left} more guests can join before you need to unlock the event.`
            : `Még ${left} vendég csatlakozhat. Ezután csak akkor csatlakozhat új vendég, ha megszünteted a vendégkorlátot.`}
      </p>

      {settling ? (
        <p className="mt-4 flex items-center gap-2 text-xs text-muted-foreground">
          <Loader2 className="size-3.5 animate-spin" aria-hidden="true" />
          {en
            ? 'Processing the payment — this takes a few seconds.'
            : 'Feldolgozzuk a fizetést. Ez általában csak néhány másodpercig tart.'}
        </p>
      ) : null}

      {checkout === 'cancelled' && !settling ? (
        <p className="mt-4 text-xs text-muted-foreground">
          {en
            ? 'Payment was cancelled. You were not charged.'
            : 'A fizetést megszakítottad. Nem történt terhelés.'}
        </p>
      ) : null}

      {stripeReady ? (
        <form action={submit} className="mt-4">
          <input type="hidden" name="slug" value={slug} />
          <input type="hidden" name="locale" value={locale} />
          <label className="mb-4 flex cursor-pointer items-start gap-3 text-xs leading-relaxed text-muted-foreground">
            <input
              type="checkbox"
              name="legal_acceptance"
              required
              className="mt-0.5 size-4 shrink-0 accent-[var(--accent)]"
            />
            <PaidTermsAcceptance locale={locale} />
          </label>
          <Button
            type="submit"
            disabled={pending}
            aria-busy={pending}
            className="w-full"
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
              ? en
                ? 'Redirecting…'
                : 'Átirányítás…'
              : en
                ? `Unlock full event – ${eventPriceLabel(locale)}`
                : `Vendégkorlát megszüntetése · ${eventPriceLabel(locale)}`}
          </Button>
          <p className="mt-2 text-center text-xs text-muted-foreground">
            {en
              ? 'Unlimited guests with one payment. Final price appears at checkout.'
              : 'Korlátlan számú vendég, egyszeri fizetéssel.'}
          </p>
        </form>
      ) : (
        // Honest about the state of the world rather than offering a button
        // that would 500 — no STRIPE_* variables are set in this environment.
        <p className="mt-4 rounded-xl bg-white/5 px-4 py-3 text-xs leading-relaxed text-muted-foreground">
          {en
            ? 'Payments are not enabled yet. Contact us and we can unlock the event manually.'
            : 'A fizetés még nincs beállítva. Addig is használhatod az albumot, segítségért pedig írj nekünk.'}
        </p>
      )}

      {state.error ? (
        <p className="mt-3 text-xs text-destructive">{state.error}</p>
      ) : null}
    </div>
  )
}
