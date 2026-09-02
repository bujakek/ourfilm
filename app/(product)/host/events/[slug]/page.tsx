import {
  ArrowLeft,
  ChevronDown,
  Clock3,
  Download,
  ExternalLink,
  Image,
  Settings,
  Users,
} from 'lucide-react'
import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import type { ReactNode } from 'react'

import { InviteButton } from '@/components/event/invite-button'
import { ModerationGrid } from '@/components/host/moderation-grid'
import { QrCard } from '@/components/host/qr-card'
import { getEventQuota, type EventQuota } from '@/lib/billing'
import { captureWindowState } from '@/lib/camera'
import { revealModeLabel } from '@/lib/event-copy'
import { getOwnedEventBySlug } from '@/lib/events'
import { formatDeadline } from '@/lib/format'
import { localeTag } from '@/lib/i18n'
import { getAllEventPhotos, toModerationTiles } from '@/lib/photos'
import { eventPriceLabel } from '@/lib/pricing'
import { eventUrl } from '@/lib/site'
import { buttonVariants } from '@/components/ui/button'

export const dynamic = 'force-dynamic'

type Props = {
  params: Promise<{ slug: string }>
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params
  const event = await getOwnedEventBySlug(slug)
  return {
    title: event ? `${event.event_name} — OurFilm` : 'Esemény — OurFilm',
    robots: { index: false, follow: false },
  }
}

/**
 * The host's compact event overview.
 *
 * Everything used during the event stays in the first viewport: status,
 * sharing, the downloadable QR and incoming photos. Configuration is still fully
 * available, but collapsed into details or the dedicated settings page so it
 * does not compete with the live event.
 */
export default async function AdminEventPage({ params }: Props) {
  const { slug } = await params
  const event = await getOwnedEventBySlug(slug)
  if (!event) notFound()
  const locale = event.locale
  const en = locale === 'en'

  const [quota, photos] = await Promise.all([
    getEventQuota(event.id).catch((error) => {
      console.error('Could not read participant quota', error)
      return null
    }),
    getAllEventPhotos(event.id),
  ])
  const tiles = await toModerationTiles(photos)
  const hiddenCount = photos.filter((photo) => photo.hidden_at !== null).length
  const url = eventUrl(event.slug, locale)
  const windowState = captureWindowState({
    now: new Date(),
    captureStartAt: new Date(event.capture_start_at),
    captureEndAt: new Date(event.capture_end_at),
  })

  return (
    <main
      className="mx-auto min-h-dvh w-full max-w-3xl px-4 pt-8 pb-14 sm:px-6 sm:pt-12"
      lang={localeTag[locale]}
    >
      <Link
        href={`/host?lang=${locale}`}
        className="print-hidden inline-flex min-h-11 items-center gap-2 text-sm text-muted-foreground transition-colors hover:text-foreground"
      >
        <ArrowLeft className="size-4" aria-hidden="true" />
        {en ? 'Your events' : 'Eseményeid'}
      </Link>

      <header className="mt-5">
        <div className="flex items-start justify-between gap-4">
          <h1 className="min-w-0 text-4xl font-semibold tracking-tight text-balance sm:text-5xl">
            {event.event_name}
          </h1>
          <Link
            href={`/host/events/${event.slug}/settings?lang=${locale}`}
            aria-label={en ? 'Settings' : 'Beállítások'}
            title={en ? 'Settings' : 'Beállítások'}
            className={buttonVariants({ variant: 'secondary', size: 'icon' })}
          >
            <Settings className="size-5 text-accent" strokeWidth={1.8} />
          </Link>
        </div>

        <dl className="mt-6 space-y-2 text-sm text-muted-foreground">
          <Fact icon={Clock3}>{captureLabel(windowState, en)}</Fact>
          {quota ? (
            <Fact icon={Users}>{participantLabel(quota, en)}</Fact>
          ) : null}
          <Fact icon={Image}>
            {photos.length === 1
              ? en
                ? '1 photo taken'
                : '1 kép készült'
              : en
                ? `${photos.length} photos taken`
                : `${photos.length} kép készült`}
          </Fact>
        </dl>

        <div className="mt-8 grid grid-cols-[minmax(0,0.9fr)_minmax(0,1.35fr)] gap-3">
          <InviteButton url={url} locale={locale} />
          <QrCard
            name={event.event_name}
            url={url}
            shots={event.shots_per_participant}
            locale={locale}
          />
        </div>

        <div className="mt-3 flex flex-wrap items-center justify-center gap-x-6 gap-y-1">
          <Link
            href={`/e/${event.slug}?lang=${locale}`}
            className="inline-flex min-h-11 items-center gap-2 text-sm text-muted-foreground transition-colors hover:text-foreground"
          >
            <ExternalLink className="size-4" aria-hidden="true" />
            {en ? 'Guest view' : 'Vendégnézet'}
          </Link>
          {photos.length > 0 ? (
            <a
              href={`/host/events/${event.slug}/export`}
              className="inline-flex min-h-11 items-center gap-2 text-sm text-muted-foreground transition-colors hover:text-foreground"
            >
              <Download className="size-4" aria-hidden="true" />
              {en ? 'Download album' : 'Album letöltése'}
            </a>
          ) : null}
        </div>
      </header>

      <section className="print-hidden mt-9 border-t border-border pt-8">
        <div className="mb-5 flex items-end justify-between gap-4">
          <h2 className="text-xl font-semibold tracking-tight">
            {en ? 'Photos' : 'Elkészült képek'}
          </h2>
          {photos.length > 0 ? (
            <p className="text-sm text-muted-foreground">
              {photos.length} {en ? 'photos' : 'kép'}
              {hiddenCount > 0
                ? ` · ${hiddenCount} ${en ? 'hidden' : 'rejtve'}`
                : ''}
            </p>
          ) : null}
        </div>
        <ModerationGrid photos={tiles} slug={event.slug} locale={locale} />
      </section>

      <details className="glass group print-hidden mt-9 rounded-2xl">
        <summary className="flex min-h-14 cursor-pointer list-none items-center justify-between gap-4 px-5 text-sm font-semibold [&::-webkit-details-marker]:hidden">
          {en ? 'Event details' : 'Esemény részletei'}
          <ChevronDown
            className="size-4 text-muted-foreground transition-transform group-open:rotate-180"
            aria-hidden="true"
          />
        </summary>
        <dl className="space-y-4 border-t border-border px-5 py-5 text-sm">
          <Row
            label={en ? 'Shooting ends' : 'Fotózás vége'}
            value={formatDeadline(event.capture_end_at, event.time_zone)}
          />
          <Row
            label={en ? 'Reveal' : 'Leleplezés'}
            value={
              event.reveal_mode === 'instant'
                ? revealLabel('instant', en)
                : `${revealLabel(event.reveal_mode, en)} — ${formatDeadline(
                    event.reveal_at,
                    event.time_zone,
                  )}`
            }
          />
          <Row
            label={en ? 'Photos per guest' : 'Képek vendégenként'}
            value={String(event.shots_per_participant)}
          />
          <Row
            label={en ? 'Guest gallery' : 'Vendégek galériája'}
            value={
              event.guests_can_view
                ? en
                  ? 'Visible to guests'
                  : 'Megnyithatják'
                : en
                  ? 'Only you can view'
                  : 'Csak te látod'
            }
          />
        </dl>
      </details>

      {quota && !quota.unlimited ? (
        <PlanBanner slug={event.slug} quota={quota} locale={locale} />
      ) : null}
    </main>
  )
}

function Fact({
  icon: Icon,
  children,
}: {
  icon: typeof Clock3
  children: ReactNode
}) {
  return (
    <div className="flex items-center gap-2">
      <dt className="sr-only">Eseményadat</dt>
      <Icon className="size-4 shrink-0" strokeWidth={1.8} aria-hidden="true" />
      <dd>{children}</dd>
    </div>
  )
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-start justify-between gap-5">
      <dt className="shrink-0 text-muted-foreground">{label}</dt>
      <dd className="text-right font-medium">{value}</dd>
    </div>
  )
}

function captureLabel(state: 'before' | 'open' | 'after', en: boolean): string {
  if (state === 'before')
    return en ? 'The camera is not open yet' : 'A kamera még nem nyílt meg'
  if (state === 'open')
    return en ? 'Guests can take photos now' : 'A vendégek most fotózhatnak'
  return en ? 'Shooting has ended' : 'Véget ért a fotózás'
}

function revealLabel(mode: 'instant' | 'event_end' | 'custom', en: boolean) {
  if (!en) return revealModeLabel(mode)
  if (mode === 'instant') return 'Immediately'
  if (mode === 'event_end') return 'At the end of the event'
  return 'Later'
}

function participantLabel(quota: EventQuota, en: boolean): string {
  if (quota.unlimited) {
    return quota.participantCount === 1
      ? en
        ? '1 guest joined'
        : '1 vendég csatlakozott'
      : en
        ? `${quota.participantCount} guests joined`
        : `${quota.participantCount} vendég csatlakozott`
  }
  return `${quota.participantCount} / ${quota.participantLimit} ${en ? 'guests joined' : 'vendég csatlakozott'}`
}

function PlanBanner({
  slug,
  quota,
  locale,
}: {
  slug: string
  quota: EventQuota
  locale: 'en' | 'hu'
}) {
  const full = quota.participantCount >= quota.participantLimit
  const en = locale === 'en'

  return (
    <Link
      href={`/host/events/${slug}/settings?lang=${locale}`}
      className="glass glass-hover print-hidden mt-4 flex items-center justify-between gap-4 rounded-2xl px-5 py-4"
    >
      <span className="min-w-0">
        <span
          className={`block text-sm font-semibold ${full ? 'text-destructive' : ''}`}
        >
          {full
            ? en
              ? 'Free allowance reached'
              : 'Betelt az ingyenes keret'
            : en
              ? 'Free event'
              : 'Ingyenes esemény'}
        </span>
        <span className="mt-1 block text-xs leading-relaxed text-muted-foreground">
          {full
            ? en
              ? 'New guests can join after the full event is unlocked.'
              : 'Új vendégek csak a teljes esemény feloldása után csatlakozhatnak.'
            : en
              ? `Unlock full event — ${eventPriceLabel(locale)}`
              : 'Teljes esemény feloldása — 12 900 Ft'}
        </span>
      </span>
      <Settings className="size-5 shrink-0 text-accent" strokeWidth={1.8} />
    </Link>
  )
}
