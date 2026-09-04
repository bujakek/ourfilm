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
import { getMyFrames } from '@/lib/frames'
import { signPhotoUrl } from '@/lib/photo-urls'
import { getGalleryPhotosBySlug, toGalleryTiles } from '@/lib/photos'
import { eventUrl } from '@/lib/site'
import { isLocale, type Locale, resolveLocale } from '@/lib/i18n'

export const dynamic = 'force-dynamic'

type Props = {
  params: Promise<{ slug: string }>
  searchParams: Promise<{ lang?: string }>
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
export default async function EventPage({ params, searchParams }: Props) {
  const { slug } = await params
  const query = await searchParams
  const event = await getGuestEventState(slug)
  if (!event) notFound()
  // `?lang` wins so a guest can read the page in their own language; the
  // event's stored locale is the default, and `resolveLocale` catches a row
  // written before the column was constrained.
  const locale: Locale =
    typeof query.lang === 'string' && isLocale(query.lang)
      ? query.lang
      : resolveLocale(event.locale)

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
        locale={locale}
        eventName={event.event_name}
        hostName={event.host_name}
        coverUrl={coverUrl}
        shotsPerParticipant={event.shots_per_participant}
        revealMode={event.reveal_mode}
        captureEndAt={event.capture_end_at}
        timeZone={event.time_zone}
        stateLabel={joinStateLabel(timing, event.shots_per_participant, locale)}
        // `can_capture` requires a participant and there is none yet, so the
        // button's label comes from the window itself.
        canCapture={captureWindowState(timing) === 'open'}
      />
    )
  }

  const lock = galleryLock(timing, locale)
  // The guest's own frames are fetched whether or not the gallery is open —
  // they are theirs, and the reveal exists so the *group* sees the night
  // together, not to withhold your own shots from you. `my_frames` is a
  // separate, narrower read than the gallery's; see `lib/frames.ts`.
  const [participantCount, frames, tiles] = await Promise.all([
    getGuestParticipantCount(event.id),
    getMyFrames(event.id),
    lock.open
      ? getGalleryPhotosBySlug(slug).then(toGalleryTiles)
      : Promise.resolve([]),
  ])

  return (
    <GuestEventView
      eventId={event.id}
      locale={locale}
      slug={slug}
      eventName={event.event_name}
      eventUrl={eventUrl(event.slug, locale)}
      captureStartAt={event.capture_start_at}
      captureEndAt={event.capture_end_at}
      initialNow={now.getTime()}
      initialCanCapture={event.can_capture}
      initialShotsRemaining={event.shots_remaining}
      shotsPerParticipant={event.shots_per_participant}
      frames={frames}
      participantCount={participantCount}
      gallery={lock}
      photos={tiles}
    />
  )
}
