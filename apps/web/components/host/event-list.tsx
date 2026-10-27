import { Camera, Plus, UserRound } from 'lucide-react'
import Image from 'next/image'
import Link from 'next/link'

import { HostBlock } from '@/components/host/host-block'
import { QrSheetButton } from '@/components/host/qr-sheet'
import {
  HOST_FOCUS,
  HOST_PANEL,
  HOST_PRIMARY,
} from '@/components/host/ui/classes'
import type { EventListItem } from '@/lib/events'
import { longTimeRemaining } from '@/lib/event-copy'
import { formatAlbumDate } from '@/lib/format'
import { eventUrl } from '@/lib/site'

/**
 * The host's events: what is running now, then the albums.
 *
 * The two halves answer different questions, so they get different shapes. A
 * running event is something to act on — take a photo, hand out the code — and
 * is a tall card with the camera on it. A closed one is a record to go back to,
 * and is a name, a date and a fan of its photos with nothing around them.
 *
 * There are no counts on this screen, on purpose. Photos, guests and the roll
 * are the event page's figure row; here they were three numbers per row that
 * nobody acts on from a list. What is left is the time a running event has
 * and the day an album closed.
 */

/** The page title's face, shared with the skeleton so the two line up. */
export const LIST_TITLE =
  'landing-serif font-landing-display text-[30px] leading-[1.1] tracking-[-0.01em] text-white'

/** Section labels here are a step quieter than `HOST_KICKER`, per the mockup. */
const KICKER =
  'text-[12px] leading-[1.3] font-medium tracking-[0.24em] uppercase text-white/55'

const CARD_SHAPE = 'aspect-[3/4] w-[276px] rounded-[32px]'

const SERIF = 'landing-serif font-landing-display'

/** The fan's tilt, in order; a fifth photo would repeat it, but there is none. */
const FAN_TILT = ['-3deg', '2deg', '-2deg', '3deg'] as const

/**
 * Darkens the photo where the name and the time sit, and a little behind the
 * camera button. The top stop is held to half the card because a 40-character
 * name wraps to three or four lines, and white on the brightest photo still
 * clears 4.5:1 at `.62` over `#0d0d0d`.
 */
const COVER_SCRIM =
  'linear-gradient(180deg, rgba(13,13,13,.82), rgba(13,13,13,.62) 50%, transparent 72%, transparent 78%, rgba(13,13,13,.55))'

function eventHref(slug: string, locale: 'en' | 'hu') {
  return `/host/events/${slug}?lang=${locale}`
}

function timeLeft(event: EventListItem, locale: 'en' | 'hu') {
  const left = longTimeRemaining(
    new Date(event.capture_end_at),
    new Date(),
    locale,
  )
  return locale === 'en' ? `${left} left` : `Még ${left}`
}

export function ListHeader({
  locale,
  showNew = true,
}: {
  locale: 'en' | 'hu'
  /** Off on the empty screen, whose own white button is the one primary. */
  showNew?: boolean
}) {
  const en = locale === 'en'
  return (
    <header className="flex min-h-14 items-center gap-2 px-5">
      <h1 className={`flex-1 ${LIST_TITLE}`}>
        {en ? 'Your events' : 'Eseményeid'}
      </h1>
      <Link
        href={`/host/account?lang=${locale}`}
        aria-label={en ? 'Account' : 'Fiók'}
        className={`inline-flex size-11 shrink-0 items-center justify-center rounded-[14px] bg-host-tile text-white transition-colors hover:bg-white/10 ${HOST_FOCUS}`}
      >
        <UserRound
          className="size-[19px]"
          strokeWidth={1.7}
          aria-hidden="true"
        />
      </Link>
      {showNew ? (
        <Link
          href={`/host/events/new?lang=${locale}`}
          className={`inline-flex h-11 shrink-0 items-center gap-2 rounded-[14px] bg-white px-[18px] text-[15px] font-medium text-landing-ink transition-colors hover:bg-white/90 ${HOST_FOCUS}`}
        >
          <Plus className="size-[18px]" strokeWidth={1.8} aria-hidden="true" />
          {en ? 'New' : 'Új'}
        </Link>
      ) : null}
    </header>
  )
}

/** The white camera button on a running event's card. */
function CameraLink({
  slug,
  locale,
  className = '',
}: {
  slug: string
  locale: 'en' | 'hu'
  className?: string
}) {
  // The host's camera is the event page's: the upload queue that carries its
  // photos lives there, so the button goes where the shutter is.
  return (
    <Link
      href={eventHref(slug, locale)}
      className={`relative z-10 inline-flex h-14 items-center justify-center gap-2.5 rounded-[16px] bg-white px-[22px] text-[15px] font-medium text-landing-ink transition-colors hover:bg-white/90 ${HOST_FOCUS} ${className}`}
    >
      <Camera className="size-[18px]" strokeWidth={1.9} aria-hidden="true" />
      {locale === 'en' ? 'Camera' : 'Kamera'}
    </Link>
  )
}

/**
 * One running event.
 *
 * Links cannot nest, so the card is not one. The name is the link, and its
 * `::after` is stretched over the whole card so a tap anywhere opens the event;
 * the camera button sits above that layer as a link of its own. A screen reader
 * hears the card as the event's name, then "Kamera".
 */
function OpenCard({
  event,
  locale,
  first,
}: {
  event: EventListItem
  locale: 'en' | 'hu'
  /** The first card's cover is the screen's largest paint; load it at once. */
  first: boolean
}) {
  const en = locale === 'en'
  const cover = event.previewUrls[0]

  return (
    <article
      className={`relative isolate flex flex-col overflow-hidden p-4 text-white ${CARD_SHAPE} ${
        cover ? 'bg-host-tile' : 'bg-host-panel'
      }`}
    >
      {cover ? (
        <div aria-hidden="true" className="absolute inset-0 -z-10">
          <Image
            src={cover}
            alt=""
            fill
            sizes="276px"
            unoptimized
            loading={first ? 'eager' : 'lazy'}
            className="object-cover"
          />
          <span
            className="absolute inset-0"
            style={{ background: COVER_SCRIM }}
          />
        </div>
      ) : null}

      <div className="px-1.5 pt-1.5">
        <h3 className={`text-[26px] leading-[1.15] ${SERIF}`}>
          <Link
            href={eventHref(event.slug, locale)}
            className="text-balance [overflow-wrap:anywhere] outline-none after:absolute after:inset-0 after:rounded-[32px] focus-visible:after:ring-2 focus-visible:after:ring-white focus-visible:after:ring-inset"
          >
            {event.event_name}
          </Link>
        </h3>
        <p className="mt-2 flex items-center gap-2 text-[13px] leading-[1.4] font-medium">
          <span
            aria-hidden="true"
            className="size-1.5 shrink-0 rounded-full bg-landing-sky"
          />
          {timeLeft(event, locale)}
        </p>
      </div>

      {cover ? (
        <CameraLink
          slug={event.slug}
          locale={locale}
          className="mt-auto self-start"
        />
      ) : (
        <>
          {/* 9c: nothing to show yet, so the card says what starts it. */}
          <div className="my-auto px-2 py-4 text-center">
            <p className={`text-[22px] leading-[1.25] ${SERIF}`}>
              {en ? 'No photos yet' : 'Még nem érkezett kép'}
            </p>
            <p className="mt-2 text-[14px] leading-[1.5] text-white/65">
              {en
                ? 'Share the QR code to get it started.'
                : 'Oszd meg a QR-kódot, hogy elinduljon.'}
            </p>
          </div>
          <div className="relative z-10 flex gap-2">
            <CameraLink slug={event.slug} locale={locale} className="flex-1" />
            <QrSheetButton
              name={event.event_name}
              url={eventUrl(event.slug)}
              eventId={event.id}
              shots={event.shots_per_participant}
              locale={locale}
            />
          </div>
        </>
      )}
    </article>
  )
}

/** 9b: nothing running, albums below. */
function NothingOpen({ locale }: { locale: 'en' | 'hu' }) {
  const en = locale === 'en'
  return (
    <section className={`mx-5 mt-6 px-6 py-7 ${HOST_PANEL}`}>
      <h2 className={`text-[24px] leading-[1.2] text-balance ${SERIF}`}>
        {en ? 'Nothing is open right now' : 'Most nincs nyitott esemény'}
      </h2>
      <p className="mt-2.5 text-[15px] leading-[1.6] text-pretty text-white/65">
        {en
          ? 'Your closed albums stay below. You can start a new event any time.'
          : 'A lezárt albumaid lent maradnak. Új eseményt bármikor indíthatsz.'}
      </p>
      <Link
        href={`/host/events/new?lang=${locale}`}
        className={`${HOST_PRIMARY} mt-5 h-[52px] w-full`}
      >
        {en ? 'Create an event' : 'Esemény létrehozása'}
      </Link>
    </section>
  )
}

/** One closed event: its name, the day it closed, and up to four photos. */
function AlbumRow({
  event,
  locale,
}: {
  event: EventListItem
  locale: 'en' | 'hu'
}) {
  const fan = event.previewUrls.slice(0, FAN_TILT.length)

  return (
    <Link
      href={eventHref(event.slug, locale)}
      className={`block rounded-[24px] pt-5 pb-2 text-white focus-visible:outline-offset-[-2px] ${HOST_FOCUS}`}
    >
      <span className="flex items-baseline gap-3 px-5">
        <span
          className={`min-w-0 flex-1 text-[24px] leading-[1.2] text-balance [overflow-wrap:anywhere] ${SERIF}`}
        >
          {event.event_name}
        </span>
        <span className="shrink-0 text-[13px] whitespace-nowrap text-white/65">
          {formatAlbumDate(event.capture_end_at, event.time_zone, locale)}
        </span>
      </span>
      {fan.length > 0 ? (
        <span aria-hidden="true" className="flex h-[164px] px-5 pt-4">
          {fan.map((url, i) => (
            <span
              key={url}
              className="relative -mr-3.5 h-[132px] w-24 shrink-0 overflow-hidden rounded-[18px] bg-[#1c1c1c] shadow-[0_12px_24px_-12px_rgba(0,0,0,.9)]"
              style={{ transform: `rotate(${FAN_TILT[i]})` }}
            >
              <Image
                src={url}
                alt=""
                fill
                sizes="96px"
                unoptimized
                className="object-cover"
              />
            </span>
          ))}
        </span>
      ) : null}
    </Link>
  )
}

/** 7a: no events at all. */
function NoEvents({ locale }: { locale: 'en' | 'hu' }) {
  const en = locale === 'en'
  return (
    <div className="px-5">
      <div className="flex min-h-11 items-center justify-between gap-2">
        <p className={KICKER}>{en ? 'Your events' : 'Eseményeid'}</p>
        <Link
          href={`/host/account?lang=${locale}`}
          aria-label={en ? 'Account' : 'Fiók'}
          className={`inline-flex size-11 shrink-0 items-center justify-center rounded-[14px] bg-host-tile text-white transition-colors hover:bg-white/10 ${HOST_FOCUS}`}
        >
          <UserRound
            className="size-[19px]"
            strokeWidth={1.7}
            aria-hidden="true"
          />
        </Link>
      </div>
      <section className={`mt-3 px-6 py-8 ${HOST_PANEL}`}>
        <h1 className={`text-balance ${LIST_TITLE} leading-[1.15]`}>
          {en ? 'No events yet' : 'Még nincs eseményed'}
        </h1>
        <p className="mt-3 text-[15px] leading-[1.6] text-pretty text-white/65">
          {en
            ? 'Create your first event and share the QR code with your guests. The photos they take appear here.'
            : 'Hozd létre az első eseményt, és oszd meg a QR-kódot a vendégekkel. Az elkészült képek itt jelennek meg.'}
        </p>
        <Link
          href={`/host/events/new?lang=${locale}`}
          className={`${HOST_PRIMARY} mt-6 h-[52px] w-full`}
        >
          {en ? 'Create an event' : 'Esemény létrehozása'}
        </Link>
      </section>
    </div>
  )
}

/** Rows stagger 60ms each, up to this many; a long archive does not queue. */
const STAGGER_CAP = 8

export function EventList({
  active,
  closed,
  locale,
}: {
  active: EventListItem[]
  closed: EventListItem[]
  locale: 'en' | 'hu'
}) {
  const en = locale === 'en'

  if (active.length === 0 && closed.length === 0) {
    return <NoEvents locale={locale} />
  }

  // Newest album first, by the day it closed rather than the day it was made.
  const albums = [...closed].sort(
    (a, b) =>
      new Date(b.capture_end_at).getTime() -
      new Date(a.capture_end_at).getTime(),
  )

  return (
    <>
      <ListHeader locale={locale} />

      {active.length > 0 ? (
        <section aria-labelledby="host-list-open">
          <h2 id="host-list-open" className={`mx-5 mt-7 ${KICKER}`}>
            {en ? 'Open' : 'Nyitva'}
          </h2>
          {/* Cards arrive together; only the album rows stagger. */}
          <HostBlock index={0}>
            <ul className="mt-3 flex snap-x snap-mandatory scroll-px-5 scrollbar-none gap-3 overflow-x-auto px-5">
              {active.map((event, i) => (
                <li key={event.id} className="shrink-0 snap-start">
                  <OpenCard event={event} locale={locale} first={i === 0} />
                </li>
              ))}
            </ul>
          </HostBlock>
        </section>
      ) : (
        <NothingOpen locale={locale} />
      )}

      {albums.length > 0 ? (
        <section aria-labelledby="host-list-albums">
          <h2
            id="host-list-albums"
            className={`mx-5 mt-10 border-t border-dashed border-white/12 pt-7 ${KICKER}`}
          >
            {en ? 'Albums' : 'Albumok'}
          </h2>
          <ul className="mt-2">
            {albums.map((event, i) => (
              <li key={event.id}>
                <HostBlock index={Math.min(i, STAGGER_CAP)}>
                  <AlbumRow event={event} locale={locale} />
                </HostBlock>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </>
  )
}

/** The list could not be read. Nothing was lost, and the next load may work. */
export function EventListError({ locale }: { locale: 'en' | 'hu' }) {
  const en = locale === 'en'
  return (
    <>
      <ListHeader locale={locale} />
      <section role="status" className={`mx-5 mt-6 px-6 py-7 ${HOST_PANEL}`}>
        <h2
          className={`text-[24px] leading-[1.2] text-balance text-host-warn ${SERIF}`}
        >
          {en
            ? 'Your events did not load'
            : 'Nem sikerült betölteni az eseményeidet'}
        </h2>
        <p className="mt-2.5 text-[15px] leading-[1.6] text-pretty text-white/65">
          {en
            ? 'Your events and photos are safe. Check your connection and try again.'
            : 'Az eseményeid és a képeid biztonságban vannak. Ellenőrizd a kapcsolatot, és próbáld újra.'}
        </p>
        {/* A plain anchor: a full load re-runs the server read. */}
        <a
          href={`/host?lang=${locale}`}
          className={`${HOST_PRIMARY} mt-5 h-[52px] w-full`}
        >
          {en ? 'Try again' : 'Újra'}
        </a>
      </section>
    </>
  )
}
