import type { Metadata } from 'next'
import { notFound } from 'next/navigation'

import { JoinForm } from '@/components/event/join-form'
import { GuestEventView } from '@/components/event/guest-event-view'
import {
  getGuestParticipantCount,
  getGuestEventState,
  getPublicEventBySlug,
  hasJoined,
} from '@/lib/events'
import { galleryLock, joinStateLabel } from '@/lib/event-copy'
import { captureWindowState } from '@/lib/camera'
import { signPhotoUrl } from '@/lib/photo-urls'
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
    title: event ? `${event.event_name} — OurFilm` : 'Esemény — OurFilm',
  }
}

/**
 * Where a QR scan lands: the join screen.
 *
 * Before joining this is the one-field gate. Afterwards it becomes the whole
 * guest experience: event status, sharing, native camera and the developed
 * photos. Keeping that on one URL means a QR scan always has one destination
 * and the guest never has to understand the app's route structure.
 */
export default async function EventPage({ params }: Props) {
  const { slug } = await params
  const event = await getGuestEventState(slug)
  if (!event) notFound()

  const now = new Date()
  const timing = {
    now,
    captureStartAt: new Date(event.capture_start_at),
    captureEndAt: new Date(event.capture_end_at),
    revealAt: new Date(event.reveal_at),
    guestsCanView: event.guests_can_view,
    timeZone: event.time_zone,
  }

  if (!hasJoined(event)) {
    const coverUrl = await signPhotoUrl(event.cover_path)
    return (
      <JoinForm
        slug={slug}
        eventName={event.event_name}
        hostName={event.host_name}
        coverUrl={coverUrl}
        shotsPerParticipant={event.shots_per_participant}
        stateLabel={joinStateLabel(timing, event.shots_per_participant)}
        // `can_capture` requires a participant and there is none yet, so the
        // button's label comes from the window itself.
        canCapture={captureWindowState(timing) === 'open'}
      />
    )
  }

  const lock = galleryLock(timing)
  const [participantCount, tiles] = await Promise.all([
    getGuestParticipantCount(event.id),
    lock.open
      ? getGalleryPhotosBySlug(slug).then(toGalleryTiles)
      : Promise.resolve([]),
  ])

  return (
    <GuestEventView
      eventId={event.id}
      slug={slug}
      eventName={event.event_name}
      eventUrl={eventUrl(event.slug)}
      captureEndAt={event.capture_end_at}
      initialNow={now.getTime()}
      initialCanCapture={event.can_capture}
      initialShotsRemaining={event.shots_remaining}
      participantCount={participantCount}
      gallery={lock}
      photos={tiles}
    />
  )
}
