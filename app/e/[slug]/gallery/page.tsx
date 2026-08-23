import { CreateOwnAlbum } from '@/components/event/create-own-album'
import { InviteButton } from '@/components/event/invite-button'
import { JoinGate } from '@/components/event/join-gate'
import { PhotoGrid } from '@/components/event/photo-grid'
import { getEventBySlug, uploadsAreOpen } from '@/lib/events'
import { guestHasJoined } from '@/lib/guest-name-server'
import { getGalleryPhotosBySlug, type GalleryPhoto } from '@/lib/photos'
import { eventUrl } from '@/lib/site'
import { ArrowLeft, EyeOff, ImagePlus } from 'lucide-react'
import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'

// A guest who just uploaded comes straight here to see their photo land.
export const dynamic = 'force-dynamic'

type Props = { params: Promise<{ slug: string }> }

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params
  const event = await getEventBySlug(slug)
  return event ? { title: `Közös album — ${event.event_name}` } : {}
}

export default async function GalleryPage({ params }: Props) {
  const { slug } = await params

  // A cookie read, so this costs nothing and can gate the query below it.
  const joined = await guestHasJoined()

  // Both keyed on the slug, so they go out together. The photo read used to
  // need `event.id`, which chained it behind the event lookup and made every
  // gallery load two serial round trips to Postgres.
  const [event, photos] = await Promise.all([
    getEventBySlug(slug),
    joined ? getGalleryPhotosBySlug(slug) : Promise.resolve<GalleryPhoto[]>([]),
  ])
  if (!event) notFound()

  // Before the grid, and before the album is fetched at all. This is the leak
  // the old layout-level gate could not close: it hid the photos in the DOM
  // while Next serialised every `thumb_path` and `uploader_name` into the
  // payload behind it, so view-source reconstructed the album.
  if (!joined) return <JoinGate eventName={event.event_name} />

  // `event_gallery_by_slug` already returns nothing while the gallery is
  // closed, so this branch is about telling the guest why — not enforcement.
  const canUpload = uploadsAreOpen(event)

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-3xl flex-col px-4 py-10 sm:py-16">
      <Link
        href={`/e/${event.slug}`}
        className="inline-flex min-h-11 items-center gap-2 self-start text-sm text-muted-foreground transition-colors hover:text-foreground"
      >
        <ArrowLeft className="size-4" />
        {event.event_name}
      </Link>

      <div className="mt-6 flex flex-wrap items-center justify-between gap-x-4 gap-y-3">
        <div className="flex flex-wrap items-baseline gap-x-4 gap-y-1">
          <h1 className="text-3xl font-semibold tracking-tight text-balance">
            Közös album
          </h1>
          {photos.length > 0 ? (
            <p className="text-sm text-muted-foreground">{photos.length} kép</p>
          ) : null}
        </div>
        {/* Icon-only actions. Upload leads and carries the primary fill: it
            is the point of the page, and it lost the full-width button that
            used to sit at the bottom of the grid. */}
        <div className="flex items-center gap-2">
          {canUpload ? (
            <Link
              href={`/e/${event.slug}`}
              aria-label="Képek feltöltése"
              className="btn-shine inline-flex size-11 items-center justify-center rounded-full bg-primary text-primary-foreground transition-transform hover:scale-[1.05]"
            >
              <ImagePlus className="size-5" strokeWidth={1.8} />
            </Link>
          ) : null}
          {/* Grants no access the link itself does not already grant — the
              album has no gate. It just saves a trip to the address bar. */}
          <InviteButton url={eventUrl(event.slug)} />
        </div>
      </div>

      {event.gallery_private ? (
        <div className="mt-10 flex flex-col items-center gap-3 text-center">
          <span className="glass flex size-14 items-center justify-center rounded-full">
            <EyeOff className="size-6 text-accent" strokeWidth={1.6} />
          </span>
          <p className="text-lg font-semibold">A közös album most rejtve van</p>
          <p className="max-w-sm text-sm leading-relaxed text-pretty text-muted-foreground">
            A házigazda egyelőre elrejtette a közös albumot. A feltöltött képek
            megvannak — akkor lesznek láthatók, amikor újra megnyitja.
          </p>
        </div>
      ) : photos.length === 0 ? (
        <div className="mt-10 flex flex-col items-center gap-3 text-center">
          <span className="glass flex size-14 items-center justify-center rounded-full">
            <ImagePlus className="size-6 text-accent" strokeWidth={1.6} />
          </span>
          <p className="text-lg font-semibold">Még nincs feltöltött kép</p>
          <p className="max-w-sm text-sm leading-relaxed text-pretty text-muted-foreground">
            {canUpload
              ? 'Legyél te az első — töltsd fel a képeidet, és itt gyűlnek majd a többiekéivel együtt.'
              : 'Erre az eseményre nem érkezett kép.'}
          </p>
          {canUpload ? (
            <Link
              href={`/e/${event.slug}`}
              className="btn-shine mt-3 inline-flex min-h-14 items-center justify-center gap-2 rounded-full bg-primary px-7 text-base font-semibold text-primary-foreground"
            >
              <ImagePlus className="size-5" strokeWidth={1.8} />
              Képek feltöltése
            </Link>
          ) : null}
        </div>
      ) : (
        <>
          <div className="mt-8">
            <PhotoGrid photos={photos} />
          </div>
          {/* Only renders for a guest who has already uploaded here. */}
          <CreateOwnAlbum eventId={event.id} />
        </>
      )}
    </main>
  )
}
