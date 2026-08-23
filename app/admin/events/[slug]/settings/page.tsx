import { BillingCard } from '@/components/admin/billing-card'
import { DangerZone } from '@/components/admin/danger-zone'
import { DeadlineCard } from '@/components/admin/deadline-card'
import { GalleryToggle } from '@/components/admin/gallery-toggle'
import {
  type EventQuota,
  formatAmount,
  getEventPurchase,
  getEventQuota,
  type Purchase,
} from '@/lib/billing'
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

  // Only the two values Stripe is sent back with are honoured. Anything else
  // in the query string is somebody typing, and a "payment succeeded" banner
  // is not something a URL should be able to conjure.
  // The field needs a wall clock either way. An event that predates the
  // required deadline has none to show, so it gets the same week-out
  // suggestion the create form offers rather than an empty picker.
  const now = new Date()
  const deadlineState = !event.uploads_close_at
    ? 'none'
    : new Date(event.uploads_close_at) <= now
      ? 'closed'
      : 'open'
  const deadlineValue = event.uploads_close_at
    ? formatEventLocalInput(new Date(event.uploads_close_at))
    : `${formatEventLocalInput(new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000)).slice(0, 10)}T23:59`

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
        Itt szabályozhatod, hogy a vendégek láthatják-e a közös albumot, meddig
        tölthetnek fel képeket, és törölheted az eseményt.
      </p>

      <div className="mt-8 flex flex-col gap-4">
        <GalleryToggle
          slug={event.slug}
          hidden={event.gallery_hidden_at !== null}
        />

        <DeadlineCard
          slug={event.slug}
          value={deadlineValue}
          state={deadlineState}
        />

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
  // do in a hurry. Before the billing migrations are pushed this is not
  // hypothetical: the table and the RPC do not exist yet.
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
        <p className="font-medium">Feltöltési keret</p>
        <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
          Most nem tudjuk lekérdezni. Az album és a feltöltés ettől
          változatlanul működik.
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
      photoLimit={quota.photoLimit}
      remaining={quota.remaining}
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
