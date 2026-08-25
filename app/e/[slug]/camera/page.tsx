import type { Metadata } from 'next'
import { notFound, redirect } from 'next/navigation'

import { CameraView } from '@/components/event/camera-view'
import {
  captureStateDetail,
  captureStateHeading,
  revealLabel,
} from '@/lib/event-copy'
import {
  getGuestEventState,
  getPublicEventBySlug,
  hasJoined,
} from '@/lib/events'

export const dynamic = 'force-dynamic'

type Props = {
  params: Promise<{ slug: string }>
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params
  const event = await getPublicEventBySlug(slug)
  return {
    title: event ? `${event.event_name} — kamera` : 'Kamera — OurFilm',
  }
}

/**
 * The camera.
 *
 * Everything it is allowed to do was decided in Postgres and arrives on the
 * state row: whether the window is open, how many frames are left, whether the
 * album has developed. The component re-reads none of it — and `reserve_shot`
 * checks the window and the count again anyway, inside the transaction that
 * spends the frame, so a page left open past the end of the event cannot shoot
 * however convincing it looks.
 */
export default async function CameraPage({ params }: Props) {
  const { slug } = await params
  const event = await getGuestEventState(slug)
  if (!event) notFound()

  // No participant on this device: back to the join screen, which is the only
  // thing that can create one.
  if (!hasJoined(event)) redirect(`/e/${slug}`)

  const timing = {
    now: new Date(),
    captureStartAt: new Date(event.capture_start_at),
    captureEndAt: new Date(event.capture_end_at),
    revealAt: new Date(event.reveal_at),
    guestsCanView: event.guests_can_view,
    timeZone: event.time_zone,
  }

  const heading = captureStateHeading(timing)

  return (
    <main className="mx-auto w-full max-w-md px-4 py-8 sm:py-12">
      <header className="mb-6 text-center">
        <h1 className="text-xl font-semibold tracking-tight text-balance">
          {event.event_name}
        </h1>
        <p className="mt-1 text-xs text-muted-foreground">
          {event.display_name}
        </p>
      </header>

      {/* Closed windows get a plain explanation instead of the camera. The
          camera is not merely hidden — there is nothing to press, because the
          database would refuse it anyway and a dead shutter is worse than an
          honest sentence. */}
      {heading ? (
        <ClosedWindow
          heading={heading}
          detail={captureStateDetail(timing)}
          slug={slug}
          canViewGallery={event.can_guest_view_gallery}
          revealDate={revealLabel(timing)}
        />
      ) : (
        <CameraView
          eventId={event.id}
          slug={slug}
          initialShotsRemaining={event.shots_remaining}
          canViewGallery={event.can_guest_view_gallery}
          revealLabel={revealLabel(timing)}
        />
      )}
    </main>
  )
}

function ClosedWindow({
  heading,
  detail,
  slug,
  canViewGallery,
  revealDate,
}: {
  heading: string
  detail: string | null
  slug: string
  canViewGallery: boolean
  revealDate: string | null
}) {
  return (
    <div className="glass flex flex-col items-center rounded-3xl px-6 py-10 text-center">
      <h2 className="text-2xl font-semibold tracking-tight text-balance">
        {heading}
      </h2>

      {detail ? (
        <p className="mt-3 text-sm leading-relaxed text-pretty text-muted-foreground">
          {detail}
        </p>
      ) : null}

      {!canViewGallery && revealDate ? (
        <p className="mt-3 text-sm leading-relaxed text-pretty text-muted-foreground">
          A galéria {revealDate} nyílik meg.
        </p>
      ) : null}

      {canViewGallery ? (
        <a
          href={`/e/${slug}/gallery`}
          className="btn-shine mt-7 inline-flex min-h-14 items-center justify-center rounded-full bg-primary px-7 text-base font-semibold text-primary-foreground"
        >
          Képek megtekintése
        </a>
      ) : null}
    </div>
  )
}
