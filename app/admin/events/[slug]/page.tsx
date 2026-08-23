import { ModerationGrid } from '@/components/admin/moderation-grid'
import { QrCard } from '@/components/admin/qr-card'
import { ModerationGridSkeleton } from '@/components/admin/skeletons'
import { getEventQuota } from '@/lib/billing'
import { getOwnedEventBySlug } from '@/lib/events'
import { formatDeadline } from '@/lib/format'
import { getAllEventPhotos } from '@/lib/photos'
import { eventUrl } from '@/lib/site'
import {
  ArrowLeft,
  Download,
  ExternalLink,
  Images,
  Settings,
} from 'lucide-react'
import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { Suspense } from 'react'

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
 * hand out, the photos as they arrive, and the album to take home.
 *
 * Everything that configures the event — gallery visibility, the upload cap,
 * deletion — lives behind the gear, on `settings`. Only the exhausted-cap
 * notice below reaches back out of it, because that is the one setting whose
 * state stops guests uploading while the host is standing in the room.
 */
export default async function AdminEventPage({ params }: Props) {
  const { slug } = await params
  const event = await getOwnedEventBySlug(slug)
  if (!event) notFound()

  const url = eventUrl(event.slug)
  const closed =
    event.uploads_close_at !== null &&
    new Date(event.uploads_close_at) <= new Date()
  // The deadline, not the event date: this is the host's own screen, and what
  // they need from a glance at it is whether guests can still upload. Events
  // created before the deadline was required have none — say that plainly
  // rather than leaving the line blank.
  const deadline = !event.uploads_close_at
    ? 'Nincs feltöltési határidő'
    : closed
      ? 'A feltöltési határidő lejárt'
      : `Feltöltés ${formatDeadline(event.uploads_close_at)}-ig`

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
          <p className="mt-2 text-sm text-muted-foreground">{deadline}</p>
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

      <div className="mt-8">
        <QrCard name={event.event_name} url={url} />
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
            Vendégnézet megnyitása
          </Link>
          <Link
            href={`/e/${event.slug}/gallery`}
            className="glass glass-hover inline-flex min-h-12 flex-1 items-center justify-center gap-2 rounded-full px-5 text-sm font-semibold"
          >
            <Images className="size-4" />
            Album megnyitása
          </Link>
        </div>
      </div>

      <Suspense fallback={null}>
        <UploadCapNotice slug={event.slug} eventId={event.id} />
      </Suspense>

      <section className="print-hidden mt-10">
        <h2 className="mb-3 text-lg font-semibold tracking-tight">
          Feltöltött képek
        </h2>
        <p className="mb-4 text-sm leading-relaxed text-muted-foreground">
          A vendégek által feltöltött képek itt jelennek meg. A rejtett képeket
          csak te látod, és bármikor visszaállíthatod őket.
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

/**
 * Shown only when the free cap is full — the one billing state a host has to
 * find out about without going looking, because it is guests being turned
 * away mid-event. Every other quota detail stays on the settings page.
 *
 * Silent on any failure: this is a courtesy line on the screen holding the QR
 * code, and the cap is enforced in the database either way.
 */
async function UploadCapNotice({
  slug,
  eventId,
}: {
  slug: string
  eventId: string
}) {
  let full: boolean
  try {
    const quota = await getEventQuota(eventId)
    full = !quota.unlimited && quota.remaining === 0
  } catch (e) {
    console.error('Could not read billing state', e)
    return null
  }
  if (!full) return null

  return (
    <Link
      href={`/admin/events/${slug}/settings`}
      className="glass glass-hover print-hidden mt-6 flex items-center justify-between gap-4 rounded-2xl px-5 py-4"
    >
      <span className="min-w-0">
        <span className="text-destructive block font-medium">
          Betelt az ingyenes keret
        </span>
        <span className="mt-1 block text-xs leading-relaxed text-muted-foreground">
          A vendégeid egyelőre nem tudnak több képet feltölteni. A
          beállításokban feloldhatod.
        </span>
      </span>
      <Settings className="size-5 shrink-0 text-accent" strokeWidth={1.8} />
    </Link>
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
      {/* Not "eredeti méretben": `lib/image.ts` re-encodes every upload to a
          4096px JPEG in the browser, so the ZIP holds the largest render we
          have, not the untouched file off the phone. */}
      <p className="mb-4 text-sm leading-relaxed text-muted-foreground">
        {empty
          ? 'Még nincs feltöltött kép — a letöltés akkor lesz elérhető, ha a vendégek feltöltenek.'
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
  return <ModerationGrid photos={photos} slug={slug} />
}
