import { ArrowLeft, Camera } from 'lucide-react'
import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound, redirect } from 'next/navigation'

import { CreateOwnAlbum } from '@/components/event/create-own-album'
import { InviteButton } from '@/components/event/invite-button'
import { PhotoGrid } from '@/components/event/photo-grid'
import { galleryLock } from '@/lib/event-copy'
import {
  getGuestEventState,
  getPublicEventBySlug,
  hasJoined,
} from '@/lib/events'
import { getGalleryPhotosBySlug, toGalleryTiles } from '@/lib/photos'
import { eventUrl } from '@/lib/site'

export const dynamic = 'force-dynamic'

type Props = {
  params: Promise<{ slug: string }>
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params
  const event = await getPublicEventBySlug(slug)
  return {
    title: event ? `Közös album — ${event.event_name}` : 'Album — OurFilm',
  }
}

/**
 * The developed album.
 *
 * Two gates, and neither is this page's. The photo query is skipped entirely
 * when the reveal has not happened — but `event_gallery_by_slug` also carries
 * the reveal in its own `where` clause, so calling it directly with curl before
 * the reveal returns nothing either. Skipping the query here is about not
 * serialising an album into a flight payload nobody is allowed to see; the RPC
 * is what makes it true.
 *
 * That distinction is the lesson recorded in CLAUDE.md about the old join gate:
 * a page that declines to render something has still fetched it.
 */
export default async function GalleryPage({ params }: Props) {
  const { slug } = await params
  const event = await getGuestEventState(slug)
  if (!event) notFound()

  if (!hasJoined(event)) redirect(`/e/${slug}`)

  const timing = {
    now: new Date(),
    captureStartAt: new Date(event.capture_start_at),
    captureEndAt: new Date(event.capture_end_at),
    revealAt: new Date(event.reveal_at),
    guestsCanView: event.guests_can_view,
    timeZone: event.time_zone,
  }

  const lock = galleryLock(timing)

  const tiles = lock.open
    ? await toGalleryTiles(await getGalleryPhotosBySlug(slug))
    : []

  return (
    <main className="mx-auto w-full max-w-3xl px-4 py-8 sm:py-12">
      <Link
        href={`/e/${slug}/camera`}
        className="inline-flex min-h-11 items-center gap-2 text-sm text-muted-foreground transition-colors hover:text-foreground"
      >
        <ArrowLeft className="size-4" />
        Kamera
      </Link>

      <div className="mt-4 flex items-start justify-between gap-4">
        <div className="min-w-0">
          <h1 className="text-2xl font-semibold tracking-tight text-balance">
            {event.event_name}
          </h1>
          {lock.open ? (
            <p className="mt-1 text-sm text-muted-foreground">
              {tiles.length} kép
            </p>
          ) : null}
        </div>

        <div className="flex shrink-0 items-center gap-2">
          {event.can_capture ? (
            <Link
              href={`/e/${slug}/camera`}
              aria-label="Fotózás"
              title="Fotózás"
              className="glass glass-hover inline-flex size-11 items-center justify-center rounded-full"
            >
              <Camera className="size-5 text-accent" strokeWidth={1.8} />
            </Link>
          ) : null}
          <InviteButton url={eventUrl(event.slug)} />
        </div>
      </div>

      {!lock.open ? (
        <div className="glass mt-8 flex flex-col items-center rounded-3xl px-6 py-12 text-center">
          <h2 className="text-lg font-semibold text-balance">{lock.heading}</h2>
          {lock.detail ? (
            <p className="mt-2 text-sm leading-relaxed text-pretty text-muted-foreground">
              {lock.detail}
            </p>
          ) : null}
        </div>
      ) : tiles.length === 0 ? (
        <p className="glass mt-8 rounded-3xl px-6 py-12 text-center text-sm text-muted-foreground">
          Még nincs egyetlen kép sem.
        </p>
      ) : (
        <>
          <div className="mt-6">
            <PhotoGrid photos={tiles} />
          </div>
          <CreateOwnAlbum />
        </>
      )}
    </main>
  )
}
