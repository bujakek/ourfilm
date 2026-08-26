import {
  ArrowLeft,
  Camera,
  Download,
  ExternalLink,
  Images,
  Settings,
  Users,
} from 'lucide-react'
import type { Metadata } from 'next'
import Image from 'next/image'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { Suspense } from 'react'

import { ModerationGrid } from '@/components/admin/moderation-grid'
import { QrCard } from '@/components/admin/qr-card'
import { ModerationGridSkeleton } from '@/components/admin/skeletons'
import { getEventQuota } from '@/lib/billing'
import { captureWindowState } from '@/lib/camera'
import { revealModeLabel } from '@/lib/event-copy'
import { getOwnedEventBySlug } from '@/lib/events'
import { eventTimeZoneLabel, formatDeadline } from '@/lib/format'
import { signPhotoUrl } from '@/lib/photo-urls'
import { getAllEventPhotos, toModerationTiles } from '@/lib/photos'
import { eventUrl } from '@/lib/site'

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
 * What a host needs *during* the event: the code on the tables, the link to
 * hand out, how the camera is configured, the photos as they arrive, and the
 * album to take home.
 *
 * Everything that *changes* the configuration lives behind the gear, on
 * `settings`. This page states the settings and links to them — a host checking
 * their phone mid-party needs to read the reveal time far more often than they
 * need to move it.
 */
export default async function AdminEventPage({ params }: Props) {
  const { slug } = await params
  const event = await getOwnedEventBySlug(slug)
  if (!event) notFound()

  const url = eventUrl(event.slug)
  const zone = event.time_zone
  const windowState = captureWindowState({
    now: new Date(),
    captureStartAt: new Date(event.capture_start_at),
    captureEndAt: new Date(event.capture_end_at),
  })

  const coverUrl = await signPhotoUrl(event.cover_path)

  return (
    <main className="mx-auto w-full max-w-lg px-4 py-10 sm:py-16">
      <Link
        href="/admin"
        className="print-hidden inline-flex min-h-11 items-center gap-2 text-sm text-muted-foreground transition-colors hover:text-foreground"
      >
        <ArrowLeft className="size-4" />
        Eseményeid
      </Link>

      <div className="print-hidden mt-6 flex items-start justify-between gap-4">
        <div className="min-w-0">
          <h1 className="text-3xl font-semibold tracking-tight text-balance">
            {event.event_name}
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">
            {windowState === 'before'
              ? 'A kamera még nem nyílt meg'
              : windowState === 'open'
                ? 'A vendégek most fotózhatnak'
                : 'Véget ért a fotózás'}
          </p>
        </div>

        <Link
          href={`/admin/events/${event.slug}/settings`}
          aria-label="Beállítások"
          title="Beállítások"
          className="glass glass-hover inline-flex size-11 shrink-0 items-center justify-center rounded-full"
        >
          <Settings className="size-5 text-accent" strokeWidth={1.8} />
        </Link>
      </div>

      {coverUrl ? (
        <div className="print-hidden relative mt-6 aspect-[4/3] w-full overflow-hidden rounded-3xl">
          <Image
            src={coverUrl}
            alt={`${event.event_name} borítóképe`}
            fill
            sizes="(max-width: 512px) 100vw, 512px"
            unoptimized
            className="object-cover"
          />
        </div>
      ) : null}

      <div className="mt-8">
        <QrCard
          name={event.event_name}
          url={url}
          shots={event.shots_per_participant}
        />
      </div>

      <div className="print-hidden mt-8 flex flex-col gap-3">
        <p className="text-sm text-muted-foreground">Meghívólink</p>
        <code className="glass truncate rounded-xl px-4 py-3 text-sm text-accent">
          {url}
        </code>
        <div className="mt-2 flex flex-col gap-2 sm:flex-row">
          <Link
            href={`/e/${event.slug}`}
            className="glass glass-hover inline-flex min-h-12 flex-1 items-center justify-center gap-2 rounded-full px-5 text-sm font-semibold"
          >
            <ExternalLink className="size-4" />
            Vendégnézet
          </Link>
          <Link
            href={`/e/${event.slug}/gallery`}
            className="glass glass-hover inline-flex min-h-12 flex-1 items-center justify-center gap-2 rounded-full px-5 text-sm font-semibold"
          >
            <Images className="size-4" />
            Galéria
          </Link>
        </div>
      </div>

      <section className="print-hidden mt-10">
        <h2 className="mb-3 text-lg font-semibold tracking-tight">
          A kamera beállításai
        </h2>
        <dl className="glass flex flex-col gap-3 rounded-2xl px-5 py-4 text-sm">
          {/* No "Fotózás kezdete" row. The camera opens when the event is
              created, so it is the one line here that could never say anything
              a host did not already know. */}
          <Row
            label="Fotózás vége"
            value={formatDeadline(event.capture_end_at, zone)}
          />
          <Row
            label="Leleplezés"
            value={
              event.reveal_mode === 'instant'
                ? revealModeLabel('instant')
                : `${revealModeLabel(event.reveal_mode)} — ${formatDeadline(event.reveal_at, zone)}`
            }
          />
          <Row
            label="Képek vendégenként"
            value={String(event.shots_per_participant)}
          />
          <Row
            label="Vendégek galériája"
            value={event.guests_can_view ? 'Megnyithatják' : 'Csak te látod'}
          />
          <Row label="Időzóna" value={eventTimeZoneLabel(zone)} />
        </dl>
      </section>

      <Suspense fallback={null}>
        <EventStanding slug={event.slug} eventId={event.id} />
      </Suspense>

      <section className="print-hidden mt-10">
        <h2 className="mb-3 text-lg font-semibold tracking-tight">
          Elkészült képek
        </h2>
        <p className="mb-4 text-sm leading-relaxed text-muted-foreground">
          A vendégek képei itt jelennek meg, a leleplezés előtt is. A rejtett
          képeket csak te látod, és bármikor visszaállíthatod őket.
        </p>
        <Suspense fallback={<ModerationGridSkeleton />}>
          <EventPhotos slug={event.slug} eventId={event.id} />
        </Suspense>
      </section>

      <section className="print-hidden mt-10">
        <h2 className="mb-3 text-lg font-semibold tracking-tight">
          Album letöltése
        </h2>
        <Suspense fallback={<AlbumDownloadSkeleton />}>
          <AlbumDownload slug={event.slug} eventId={event.id} />
        </Suspense>
      </section>
    </main>
  )
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between gap-4">
      <dt className="shrink-0 text-muted-foreground">{label}</dt>
      <dd className="min-w-0 truncate text-right font-medium">{value}</dd>
    </div>
  )
}

/**
 * Participants and the plan, together — because on a free event they are the
 * same fact. "3 / 5 résztvevő" is both a stat and a warning, and separating
 * them would put the number on one screen and the consequence on another.
 *
 * Silent on any failure: the cap is enforced in `join_event` either way, and a
 * billing read that throws must not take out the screen holding the QR code.
 */
async function EventStanding({
  slug,
  eventId,
}: {
  slug: string
  eventId: string
}) {
  let quota
  try {
    quota = await getEventQuota(eventId)
  } catch (e) {
    console.error('Could not read participant quota', e)
    return null
  }

  const full =
    !quota.unlimited && quota.participantCount >= quota.participantLimit

  return (
    <section className="print-hidden mt-10">
      <h2 className="mb-3 text-lg font-semibold tracking-tight">Résztvevők</h2>

      <div className="glass flex items-center justify-between gap-4 rounded-2xl px-5 py-4">
        <span className="inline-flex items-center gap-2 text-sm">
          <Users className="size-4 text-accent" strokeWidth={1.8} />
          {quota.unlimited
            ? `${quota.participantCount} résztvevő`
            : `${quota.participantCount} / ${quota.participantLimit} résztvevő`}
        </span>
        <span className="text-xs text-muted-foreground">
          {quota.unlimited ? 'Teljes esemény' : 'Ingyenes esemény'}
        </span>
      </div>

      {!quota.unlimited ? (
        <Link
          href={`/admin/events/${slug}/settings`}
          className="glass glass-hover mt-3 flex items-center justify-between gap-4 rounded-2xl px-5 py-4"
        >
          <span className="min-w-0">
            <span
              className={`block font-medium ${full ? 'text-destructive' : ''}`}
            >
              {full
                ? 'Betelt az ingyenes keret'
                : 'Teljes esemény feloldása – 12 900 Ft'}
            </span>
            <span className="mt-1 block text-xs leading-relaxed text-muted-foreground">
              {full
                ? 'Új vendégek egyelőre nem tudnak csatlakozni. A beállításokban feloldhatod.'
                : 'Korlátlan résztvevő, egyszeri fizetéssel.'}
            </span>
          </span>
          <Camera className="size-5 shrink-0 text-accent" strokeWidth={1.8} />
        </Link>
      ) : null}
    </section>
  )
}

function AlbumDownloadSkeleton() {
  return (
    <div aria-hidden="true">
      <p className="mb-4 h-10 animate-pulse rounded-md bg-muted-foreground/15" />
      <div className="h-14 w-full animate-pulse rounded-full bg-muted-foreground/15" />
    </div>
  )
}

async function AlbumDownload({
  slug,
  eventId,
}: {
  slug: string
  eventId: string
}) {
  const photos = await getAllEventPhotos(eventId)
  const empty = photos.length === 0

  return (
    <>
      {/* Not "eredeti méretben": `lib/image.ts` re-encodes every capture to a
          4096px JPEG in the browser, so the ZIP holds the largest render we
          have, not the untouched frame off the sensor. */}
      <p className="mb-4 text-sm leading-relaxed text-muted-foreground">
        {empty
          ? 'Még nincs elkészült kép — a letöltés akkor lesz elérhető, ha a vendégek fotóznak.'
          : 'Töltsd le az esemény összes fotóját egy ZIP-fájlban, nagy felbontásban. Az elrejtett képek külön mappába kerülnek. Nagy albumnál a letöltés indulása eltarthat egy ideig.'}
      </p>
      {empty ? (
        <button
          type="button"
          disabled
          className="inline-flex min-h-14 w-full items-center justify-center gap-2 rounded-full bg-primary px-7 text-base font-semibold text-primary-foreground disabled:opacity-60"
        >
          <Download className="size-5" strokeWidth={1.8} />
          Összes kép letöltése
        </button>
      ) : (
        <a
          href={`/admin/events/${slug}/export`}
          className="btn-shine inline-flex min-h-14 w-full items-center justify-center gap-2 rounded-full bg-primary px-7 text-base font-semibold text-primary-foreground"
        >
          <Download className="size-5" strokeWidth={1.8} />
          Összes kép letöltése
        </a>
      )}
    </>
  )
}

async function EventPhotos({
  slug,
  eventId,
}: {
  slug: string
  eventId: string
}) {
  const photos = await getAllEventPhotos(eventId)
  return <ModerationGrid photos={await toModerationTiles(photos)} slug={slug} />
}
