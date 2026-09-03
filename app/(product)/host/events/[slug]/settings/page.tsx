import { BillingCard } from '@/components/host/billing-card'
import { CaptureEndCard } from '@/components/host/capture-end-card'
import { DangerZone } from '@/components/host/danger-zone'
import { GuestsToggle } from '@/components/host/guests-toggle'
import { RevealCard } from '@/components/host/reveal-card'
import { ShotsCard } from '@/components/host/shots-card'
import {
  type EventQuota,
  formatAmount,
  getEventPurchase,
  getEventQuota,
  type Purchase,
} from '@/lib/billing'
import {
  captureWindowState,
  type RevealChoice,
  type ShotOption,
} from '@/lib/camera'
import { getOwnedEventBySlug } from '@/lib/events'
import { localeTag } from '@/lib/i18n'
import { formatEventLocalInput, formatMoment } from '@/lib/format'
import { getAllEventPhotos } from '@/lib/photos'
import { planNote } from '@/lib/plan-copy'
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
  const locale = event.locale
  const en = locale === 'en'

  // Every date field is rendered in the event's own zone, not the server's and
  // not the browser's — a `datetime-local` carries no zone, so handing it any
  // other wall clock would show a host a window their guests are not held to.
  const zone = event.time_zone
  const now = new Date()
  const windowState = captureWindowState({
    now,
    captureStartAt: new Date(event.capture_start_at),
    captureEndAt: new Date(event.capture_end_at),
  })

  // Only the two values Stripe is sent back with are honoured. Anything else
  // in the query string is somebody typing, and a "payment succeeded" banner
  // is not something a URL should be able to conjure.
  const { checkout } = await searchParams
  const checkoutState =
    checkout === 'success' || checkout === 'cancelled' ? checkout : null

  // Older events may still carry the retired custom mode. If their album has
  // already opened, that is equivalent to "Azonnal"; otherwise the safe
  // editable choice is the event end.
  const revealChoice: RevealChoice =
    event.reveal_mode === 'instant' ||
    (event.reveal_mode === 'custom' && new Date(event.reveal_at) <= now)
      ? 'instant'
      : 'event_end'

  return (
    <main
      className="mx-auto w-full max-w-lg px-4 py-10 sm:py-16"
      lang={localeTag[locale]}
    >
      <Link
        href={`/host/events/${event.slug}?lang=${locale}`}
        className="inline-flex min-h-11 items-center gap-2 text-sm text-muted-foreground transition-colors hover:text-foreground"
      >
        <ArrowLeft className="size-4" />
        {event.event_name}
      </Link>

      <h1 className="mt-6 text-3xl font-semibold tracking-tight text-balance">
        {en ? 'Settings' : 'Beállítások'}
      </h1>
      <p className="mt-2 text-sm text-muted-foreground">
        {en
          ? 'Change when shooting ends, when photos appear, each guest’s roll, gallery access, billing and deletion.'
          : 'Itt állíthatod be, meddig lehet fotózni, mikor jelenjenek meg a képek, hányat készíthet egy vendég — és itt törölheted az eseményt.'}
      </p>

      <div className="mt-8 flex flex-col gap-4">
        <CaptureEndCard
          slug={event.slug}
          endValue={formatEventLocalInput(new Date(event.capture_end_at), zone)}
          // The card's calendar refuses exactly what `setCaptureEnd` refuses,
          // and that is `end <= start` — not `end < now`. Closing the camera
          // early means picking a moment already past.
          startDay={formatEventLocalInput(
            new Date(event.capture_start_at),
            zone,
          ).slice(0, 10)}
          state={windowState}
          locale={locale}
        />

        <RevealCard slug={event.slug} mode={revealChoice} locale={locale} />

        <ShotsCard
          slug={event.slug}
          shots={event.shots_per_participant as ShotOption}
          locale={locale}
        />

        <GuestsToggle
          slug={event.slug}
          canView={event.guests_can_view}
          locale={locale}
        />

        {/* The event page's quota banner links straight here — the unlock has
            to be reached with its consumer-law checkbox, not around it. */}
        <div id="billing" className="scroll-mt-6">
          <Suspense fallback={<BillingCardSkeleton />}>
            <EventBilling
              slug={event.slug}
              eventId={event.id}
              checkout={checkoutState}
              locale={locale}
            />
          </Suspense>
        </div>
      </div>

      <Suspense fallback={null}>
        <EventDangerZone
          slug={event.slug}
          eventName={event.event_name}
          eventId={event.id}
          locale={locale}
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
  locale,
  checkout,
}: {
  slug: string
  eventId: string
  locale: 'en' | 'hu'
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
        <p className="font-medium">
          {locale === 'en' ? 'Guest allowance' : 'Résztvevői keret'}
        </p>
        <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
          {locale === 'en'
            ? 'We cannot load it right now. The camera and gallery still work.'
            : 'Most nem tudjuk lekérdezni. A kamera és a galéria ettől változatlanul működik.'}
        </p>
      </div>
    )
  }

  // The receipt is only ever read by `planNote`'s `paid` branch. An event that
  // is uncapped for any other reason has no receipt to show, and inventing one
  // would be a lie in the one place a host looks to check what they were
  // charged.
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
      locale={locale}
      slug={slug}
      participantLimit={quota.participantLimit}
      participantCount={quota.participantCount}
      unlimited={quota.unlimited}
      planNote={planNote(quota.planSource, locale, receipt || null)}
      stripeReady={stripeIsConfigured()}
      checkout={checkout}
    />
  )
}

async function EventDangerZone({
  slug,
  eventName,
  eventId,
  locale,
}: {
  slug: string
  eventName: string
  eventId: string
  locale: 'en' | 'hu'
}) {
  const photos = await getAllEventPhotos(eventId)
  return (
    <DangerZone
      slug={slug}
      eventName={eventName}
      photoCount={photos.length}
      locale={locale}
    />
  )
}
