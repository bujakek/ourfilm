'use client'

import Link from 'next/link'
import { useEffect } from 'react'

import { HOST_PAY, HOST_SECONDARY } from '@/components/host/ui/classes'
import { StateNotice } from '@/components/host/ui/state-notice'
import type { EventQuota } from '@/lib/billing'
import { track } from '@/lib/telemetry'

/**
 * The free tier's edge, seen from the host's side.
 *
 * The page renders this only when `quotaBannerState` says so: one seat from
 * the cap (`near`) or at it (`full`). Unlike the guest's version of this
 * message, the host is the person who can act on it, so it ends in a button.
 * The button goes to the billing card rather than straight to Stripe on
 * purpose: `startEventCheckout` requires the consumer-law acceptance, and that
 * checkbox is where it is shown.
 */
export function QuotaBanner({
  slug,
  eventId,
  quota,
  state,
  locale,
}: {
  slug: string
  /** Telemetry only. */
  eventId: string
  quota: EventQuota
  state: 'near' | 'full'
  locale: 'en' | 'hu'
}) {
  const full = state === 'full'
  const en = locale === 'en'
  const { participantCount: count, participantLimit: limit } = quota

  // The host's side of `guest_join_refused`. Together they answer the question
  // this product most needs answered: of the events that hit the free cap, how
  // many hosts then paid — and how many simply watched guests be turned away.
  //
  // Once per mount, with the counts as they arrived. A host reloading their
  // dashboard through an evening is a legitimate repeat.
  useEffect(() => {
    track('quota_banner_viewed', {
      event_id: eventId,
      participant_count: count,
      participant_limit: limit,
      full,
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps -- arrival snapshot
  }, [eventId])

  const href = `/host/events/${slug}/settings?lang=${locale}#billing`
  const onClick = () =>
    track('quota_upgrade_clicked', { event_id: eventId, full })

  const title = full
    ? en
      ? `Full ${count}/${limit}`
      : `Betelt ${count}/${limit}`
    : en
      ? `Guests ${count}/${limit}`
      : `Vendégek ${count}/${limit}`

  const body = full
    ? en
      ? 'New guests cannot join. Everyone already in can keep shooting.'
      : 'Új vendégek nem tudnak csatlakozni. A már csatlakozottak tovább fotózhatnak.'
    : en
      ? `One free seat left. The next guest after that will be told the event is full and to ask you.`
      : `Már csak egy ingyenes hely van. A következő vendég azt látja majd, hogy az esemény betelt, és hozzád kell fordulnia.`

  return (
    <div className="print-hidden mt-4">
      <StateNotice
        tone={full ? 'danger' : 'warn'}
        title={title}
        body={body}
        figure={
          full ? undefined : (
            <div
              role="img"
              aria-label={`${count}/${limit}`}
              className="h-1.5 w-full overflow-hidden rounded-full bg-white/10"
            >
              <div
                className="h-full rounded-full bg-host-warn"
                style={{ width: `${Math.min(100, (count / limit) * 100)}%` }}
              />
            </div>
          )
        }
        actions={
          full ? (
            <Link href={href} onClick={onClick} className={HOST_PAY}>
              {en
                ? 'Unlock unlimited guests →'
                : 'Feloldás korlátlan vendéggel →'}
            </Link>
          ) : (
            <Link href={href} onClick={onClick} className={HOST_SECONDARY}>
              {en ? 'Unlock' : 'Feloldás'}
            </Link>
          )
        }
      />
    </div>
  )
}
