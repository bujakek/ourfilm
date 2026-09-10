import {
  type CheckoutOutcome,
  CheckoutSuccess,
} from '@/components/host/checkout-success'
import {
  formatAmount,
  getEventPurchase,
  getEventQuota,
  type EventQuota,
  type Purchase,
} from '@/lib/billing'
import { getOwnedEventBySlug } from '@/lib/events'
import { formatMoment } from '@/lib/format'
import { planNote } from '@/lib/plan-copy'
import type { Metadata } from 'next'
import { notFound } from 'next/navigation'

export const dynamic = 'force-dynamic'

type Props = { params: Promise<{ slug: string }> }

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params
  const event = await getOwnedEventBySlug(slug)
  return {
    title: event
      ? `Kifizetve — ${event.event_name} — OurFilm`
      : 'Kifizetve — OurFilm',
    robots: { index: false, follow: false },
  }
}

/**
 * Where Stripe sends a host after they pay for one event.
 *
 * It replaced a redirect straight back to `/host/events/[slug]/settings`, and
 * the reason that destination was chosen still holds: the sentence a host needs
 * after paying is "this album is unlimited", not the QR code. What it got wrong
 * was the register. Landing on a settings form — six cards, a delete button —
 * is an odd place to arrive from a checkout, and the only thing that had
 * changed was one line inside the fifth card. So the answer gets its own
 * screen, and the card that explains the billing is one quiet link away.
 *
 * **Nothing here trusts the redirect.** Stripe returning the browser to this
 * URL proves only that a browser reached this URL. The outcome is read from
 * `getEventQuota()`, which is `event_plan_source()` — the same predicate
 * `join_event` enforces on the sixth guest. A host who types this address sees
 * the state of their event, which for an unpaid one is not a celebration.
 */
export default async function CheckoutSuccessPage({ params }: Props) {
  const { slug } = await params
  const event = await getOwnedEventBySlug(slug)
  if (!event) notFound()

  let quota: EventQuota | null = null
  let purchase: Purchase | null = null
  try {
    ;[quota, purchase] = await Promise.all([
      getEventQuota(event.id),
      getEventPurchase(event.id),
    ])
  } catch (e) {
    // A billing read that throws would take this route to the error boundary,
    // which is the worst screen to show somebody who has just been charged.
    // Not knowing is a state this page can already describe, so describe it.
    console.error('Could not read billing state after checkout', e)
  }

  // `pending` is the row `createEventCheckoutUrl` wrote before Stripe was ever
  // called, so it is exactly "a checkout was started and has not settled" —
  // the gap worth polling. A missing row, or a `failed`/`expired` one, is not
  // a wait; it is an answer, and the host is told so rather than watched over
  // by a spinner that has nothing to wait for.
  const outcome: CheckoutOutcome = quota?.unlimited
    ? 'paid'
    : purchase?.status === 'pending'
      ? 'settling'
      : 'unconfirmed'

  // Only a settled payment has a receipt. `planNote` owns the wording so an
  // Early Couple Program event cannot end up reading "Kifizetve — 12 900 Ft".
  const receipt =
    purchase?.status === 'paid'
      ? [
          formatAmount(purchase.amount_minor, purchase.currency),
          purchase.paid_at ? formatMoment(purchase.paid_at) : null,
        ]
          .filter(Boolean)
          .join(' · ')
      : ''

  return (
    <CheckoutSuccess
      locale={event.locale}
      slug={event.slug}
      outcome={outcome}
      shots={event.shots_per_participant}
      note={planNote(quota?.planSource ?? null, event.locale, receipt || null)}
    />
  )
}
