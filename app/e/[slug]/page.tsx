import type { Metadata } from 'next'
import { notFound, redirect } from 'next/navigation'

import { JoinForm } from '@/components/event/join-form'
import {
  getGuestEventState,
  getPublicEventBySlug,
  hasJoined,
} from '@/lib/events'
import { joinStateLabel } from '@/lib/event-copy'
import { captureWindowState } from '@/lib/camera'
import { signPhotoUrl } from '@/lib/photo-urls'

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
 * A guest who has already joined on this device never sees it — they go
 * straight to the camera, which is the whole point of remembering them. The
 * redirect is deliberate rather than rendering the camera here: the camera has
 * its own URL so "back" from the gallery returns to it, and so a guest can keep
 * the tab open on the camera all evening.
 */
export default async function EventPage({ params }: Props) {
  const { slug } = await params
  const event = await getGuestEventState(slug)
  if (!event) notFound()

  if (hasJoined(event)) redirect(`/e/${slug}/camera`)

  const now = new Date()
  const timing = {
    now,
    captureStartAt: new Date(event.capture_start_at),
    captureEndAt: new Date(event.capture_end_at),
    revealAt: new Date(event.reveal_at),
    guestsCanView: event.guests_can_view,
    timeZone: event.time_zone,
  }

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
