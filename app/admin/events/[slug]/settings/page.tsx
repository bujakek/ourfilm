import { BillingCard } from '@/components/admin/billing-card'
import { CaptureWindowCard } from '@/components/admin/capture-window-card'
import { DangerZone } from '@/components/admin/danger-zone'
import { GuestsToggle } from '@/components/admin/guests-toggle'
import { RevealCard } from '@/components/admin/reveal-card'
import { RevealNowButton } from '@/components/admin/reveal-now-button'
import { ShotsCard } from '@/components/admin/shots-card'
import {
  type EventQuota,
  formatAmount,
  getEventPurchase,
  getEventQuota,
  type Purchase,
} from '@/lib/billing'
import { captureWindowState, type ShotOption } from '@/lib/camera'
import { getOwnedEventBySlug } from '@/lib/events'
import { formatEventLocalInput, formatMoment } from '@/lib/format'
import { getAllEventPhotos } from '@/lib/photos'
import { stripeIsConfigured } from '@/lib/stripe/env'
import { ArrowLeft } from 'lucide-react'
import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { Suspense } from 'react'

export const dynamic = 'force-dynamic'

type Props = {
  params: Promise<{ slug: string }>
  searchParams: Promise<{ checkout?: string }>
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params
  const event = await getOwnedEventBySlug(slug)
  return {
    title: event
      ? `Beállítások — ${event.event_name} — OurFilm`
      : 'Beállítások — OurFilm',
    robots: { index: false, follow: false },
  }
}

/**
 * Everything that *changes* the event, kept off the event page itself.
 *
 * The event page is what a host opens mid-party — the QR code, the photos, the
 * download. Visibility, billing and deletion are decisions made once, and
 * sitting them next to the QR card made the one screen that has to work in a
 * dim room at 1am the busiest in the product. Stripe sends the host back here
 * too, so the receipt lands next to the card that explains it.
 *
 * Each card carries its own heading, so this page deliberately has no section
 * headings of its own — a second title above every card would only repeat it.
 */
export default async function AdminEventSettingsPage({
  params,
  searchParams,
}: Props) {
  const { slug } = await params
  const event = await getOwnedEventBySlug(slug)
  if (!event) notFound()

  // Every date field is rendered in the event's own zone, not the server's and
  // not the browser's — a `datetime-local` carries no zone, so handing it any
  // other wall clock would show a host a window their guests are not held to.
  const zone = event.time_zone
  const windowState = captureWindowState({
    now: new Date(),
    captureStartAt: new Date(event.capture_start_at),
    captureEndAt: new Date(event.capture_end_at),
  })

  // Only the two values Stripe is sent back with are honoured. Anything else
  // in the query string is somebody typing, and a "payment succeeded" banner
  // is not something a URL should be able to conjure.
  const { checkout } = await searchParams
  const checkoutState =
    checkout === 'success' || checkout === 'cancelled' ? checkout : null

  return (
    <main className="mx-auto w-full max-w-lg px-4 py-10 sm:py-16">
      <Link
        href={`/admin/events/${event.slug}`}
        className="inline-flex min-h-11 items-center gap-2 text-sm text-muted-foreground transition-colors hover:text-foreground"
      >
        <ArrowLeft className="size-4" />
        {event.event_name}
      </Link>

      <h1 className="mt-6 text-3xl font-semibold tracking-tight text-balance">
        Beállítások
      </h1>
      <p className="mt-2 text-sm text-muted-foreground">
        Itt állíthatod be, mikor lehet fotózni, mikor jelenjenek meg a képek,
        hányat készíthet egy vendég — és itt törölheted az eseményt.
      </p>

      <div className="mt-8 flex flex-col gap-4">
        <CaptureWindowCard
          slug={event.slug}
          startValue={formatEventLocalInput(
            new Date(event.capture_start_at),
            zone,
          )}
          endValue={formatEventLocalInput(new Date(event.capture_end_at), zone)}
          timeZone={zone}
          state={windowState}
        />

        <RevealCard
          slug={event.slug}
          mode={event.reveal_mode}
          customValue={formatEventLocalInput(new Date(event.reveal_at), zone)}
          timeZone={zone}
          minValue={formatEventLocalInput(new Date(event.capture_end_at), zone)}
        />

        <div className="glass rounded-2xl px-5 py-4">
          <p className="font-medium">Korai leleplezés</p>
          <p className="mt-1 mb-4 text-xs leading-relaxed text-muted-foreground">
            Nem akarsz várni? Nyisd meg a galériát most.
          </p>
          <RevealNowButton
            slug={event.slug}
            guestsCanView={event.guests_can_view}
          />
        </div>

        <ShotsCard
          slug={event.slug}
          shots={event.shots_per_participant as ShotOption}
        />

        <GuestsToggle slug={event.slug} canView={event.guests_can_view} />

        <Suspense fallback={<BillingCardSkeleton />}>
          <EventBilling
            slug={event.slug}
            eventId={event.id}
            checkout={checkoutState}
          />
        </Suspense>
      </div>

      <Suspense fallback={null}>
        <EventDangerZone
          slug={event.slug}
          eventName={event.event_name}
          eventId={event.id}
        />
      </Suspense>
    </main>
  )
}

function BillingCardSkeleton() {
  return (
    <div
      className="skeleton h-32 animate-pulse rounded-2xl"
      aria-hidden="true"
    />
  )
}

async function EventBilling({
  slug,
  eventId,
  checkout,
}: {
  slug: string
  eventId: string
  checkout: 'success' | 'cancelled' | null
}) {
  // Contained on purpose. A billing read that throws would take the whole
  // route to the error boundary and leave a host unable to reach the other
  // settings — including deletion, which is the one thing they may be here to
  // do in a hurry.
  let quota: EventQuota
  let purchase: Purchase | null
  try {
    ;[quota, purchase] = await Promise.all([
      getEventQuota(eventId),
      getEventPurchase(eventId),
    ])
  } catch (e) {
    console.error('Could not read billing state', e)
    return (
      <div className="glass rounded-2xl px-5 py-4">
        <p className="font-medium">Résztvevői keret</p>
        <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
          Most nem tudjuk lekérdezni. A kamera és a galéria ettől változatlanul
          működik.
        </p>
      </div>
    )
  }

  // Only shown when a payment is what lifted the cap. An admin-owned event is
  // also unlimited and has no receipt to show, and inventing one would be a
  // lie in the one place a host looks to check they were charged correctly.
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
    <BillingCard
      slug={slug}
      participantLimit={quota.participantLimit}
      participantCount={quota.participantCount}
      unlimited={quota.unlimited}
      paidLabel={receipt ? `Kifizetve — ${receipt}` : null}
      stripeReady={stripeIsConfigured()}
      checkout={checkout}
    />
  )
}

async function EventDangerZone({
  slug,
  eventName,
  eventId,
}: {
  slug: string
  eventName: string
  eventId: string
}) {
  const photos = await getAllEventPhotos(eventId)
  return (
    <DangerZone slug={slug} eventName={eventName} photoCount={photos.length} />
  )
}
