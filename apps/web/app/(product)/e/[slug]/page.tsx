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
import { publicPhotoUrl } from '@/lib/photo-urls'
import {
  getDevelopingGalleryBySlug,
  getGalleryPhotosBySlug,
  toGalleryTiles,
} from '@/lib/photos'
import { eventUrl } from '@/lib/site'
import { cookies, headers } from 'next/headers'

import { resolveLocale } from '@/lib/i18n'
import { guestLocale, LOCALE_PREFERENCE_COOKIE } from '@/lib/locale-preference'

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
  // The guest's own language first. The couple's language is not
  // necessarily theirs, and the `?lang` on a printed QR code or a shared
  // invitation is the host's default rather than anything the guest chose —
  // so a saved switcher choice, then the browser's `Accept-Language`, and
  // only then that `?lang` and the event's stored locale. `resolveLocale`
  // catches a row written before the column was constrained. Language only:
  // nothing a guest can do depends on it.
  const [cookieStore, headerStore] = await Promise.all([cookies(), headers()])
  const locale = guestLocale({
    cookie: cookieStore.get(LOCALE_PREFERENCE_COOKIE)?.value,
    acceptLanguage: headerStore.get('accept-language'),
    lang: query.lang,
    eventLocale: resolveLocale(event.locale),
  })

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
    const coverUrl = event.cover_path ? publicPhotoUrl(event.cover_path) : null
    return (
      <JoinForm
        eventId={event.id}
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
  const [participantCount, frames, tiles, wall] = await Promise.all([
    getGuestParticipantCount(event.id),
    getMyFrames(event.id),
    lock.open
      ? getGalleryPhotosBySlug(slug).then(toGalleryTiles)
      : Promise.resolve([]),
    // The locked album as a wall of undeveloped tiles. Not while the host
    // keeps guests out: that lock is a decision, and a wall would promise a
    // reveal that is not coming. Never fatal either — it decorates a sentence
    // that is already true on its own, so a failed read (the migration not yet
    // on this database) falls back to that sentence.
    lock.open || !event.guests_can_view
      ? Promise.resolve(null)
      : getDevelopingGalleryBySlug(slug).catch((error) => {
          console.error('Could not read the developing gallery', error)
          return null
        }),
  ])

  return (
    <GuestEventView
      eventId={event.id}
      locale={locale}
      slug={slug}
      eventName={event.event_name}
      // Invitations carry the event's language as the default, never this
      // guest's: the next guest's own browser decides for them.
      eventUrl={eventUrl(event.slug, resolveLocale(event.locale))}
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
      wall={wall}
      revealAt={event.reveal_at}
    />
  )
}
