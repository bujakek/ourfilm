import { HostBlock } from '@/components/host/host-block'
import { LiveDot } from '@/components/ui/live-dot'
import type { EventListItem } from '@/lib/events'
import { captureIsOpen } from '@/lib/events'
import { shortTimeRemaining } from '@/lib/event-copy'
import { formatEventDay } from '@/lib/format'
import { FREE_PARTICIPANT_LIMIT } from '@/lib/onboarding'
import Image from 'next/image'
import Link from 'next/link'

/**
 * The host's events, as contact sheets.
 *
 * A row used to be four stacked paragraphs — deadline, slug, guest count,
 * gallery visibility — each in the same 12px grey, above a strip of three
 * thumbnails. Four sentences is not something anyone reads at a glance, and
 * the photos, which are the one thing that tells two events apart instantly,
 * were the smallest part of the card.
 *
 * So the photos become the row and the four sentences become one mono line.
 * The strip bleeds to the card's edge because a contact sheet is a sheet: the
 * frames run to the paper's edge, and a margin around them would make them
 * illustrations of the event rather than the event itself.
 */

/** Eight across, which is what `owned_events_with_previews` now returns. The
 *  last cell is the overflow count when there are more photos than frames. */
const STRIP_COLUMNS = 8

function PreviewStrip({ event }: { event: EventListItem }) {
  if (event.previewUrls.length === 0) return null

  // The overflow count covers hidden photos too, so the number matches what the
  // moderation grid shows rather than only what is on display here.
  const overflow = event.photoCount - event.previewUrls.length
  const shown =
    overflow > 0
      ? event.previewUrls.slice(0, STRIP_COLUMNS - 1)
      : event.previewUrls.slice(0, STRIP_COLUMNS)

  return (
    <div
      className="grid gap-[2px] px-[2px] pb-[2px]"
      style={{
        gridTemplateColumns: `repeat(${STRIP_COLUMNS}, minmax(0, 1fr))`,
      }}
    >
      {shown.map((url) => (
        <span
          key={url}
          className="relative aspect-square overflow-hidden rounded-[2px]"
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
      {overflow > 0 ? (
        <span className="flex aspect-square items-center justify-center rounded-[2px] bg-white/5 font-mono text-[13px] font-medium text-foreground/55">
          +{overflow}
        </span>
      ) : null}
      {/* An event with fewer than eight photos still gets a full-width sheet.
          The empty cells are the same idea as the guest strip's unexposed
          frames — the roll has room left — and without them the strip stops
          mid-card and reads as a failed load. */}
      {Array.from(
        {
          length: Math.max(
            0,
            STRIP_COLUMNS - shown.length - (overflow > 0 ? 1 : 0),
          ),
        },
        (_, i) => (
          <span
            key={`empty-${i}`}
            aria-hidden="true"
            className="aspect-square rounded-[2px] bg-white/3"
          />
        ),
      )}
    </div>
  )
}

/**
 * Everything the old four paragraphs said, on one line.
 *
 * Mono because every clause is a count, a duration or an address — the one
 * voice that reads as a readout rather than as prose, which is what makes it
 * skimmable down a column of cards.
 */
function metadataParts(event: EventListItem, en: boolean): string[] {
  const open = captureIsOpen(event)
  const parts: string[] = []

  if (!open) {
    parts.push(
      `${en ? 'CLOSED' : 'LEZÁRT'} ${formatEventDay(
        event.capture_end_at,
        event.time_zone,
        en ? 'en' : 'hu',
      ).toUpperCase()}`,
    )
  }
  if (event.photoCount > 0) {
    parts.push(`${event.photoCount} ${en ? 'PHOTOS' : 'KÉP'}`)
  }
  parts.push(`${event.participantCount} ${en ? 'GUESTS' : 'VENDÉG'}`)
  parts.push(
    `${event.shots_per_participant} ${en ? 'EACH' : 'FEJENKÉNT'}`.toUpperCase(),
  )
  if (!event.guests_can_view) {
    parts.push(en ? 'ONLY YOU SEE IT' : 'CSAK TE LÁTOD')
  }
  parts.push(`/E/${event.slug.toUpperCase()}`)
  return parts
}

function EventRow({
  event,
  locale,
  index,
}: {
  event: EventListItem
  locale: 'en' | 'hu'
  /** Position in the load sequence. Rows stagger; the cells inside never do. */
  index: number
}) {
  const en = locale === 'en'
  const open = captureIsOpen(event)

  return (
    <li>
      {/* The row animates inside the list item rather than as one, so the
          markup stays a real `<ul>` of `<li>`s. */}
      <HostBlock index={index}>
        <Link
          href={`/host/events/${event.slug}?lang=${event.locale}`}
          className={`block overflow-hidden rounded-lg border transition-colors ${
            open
              ? 'border-white/12 hover:border-white/25'
              : 'border-white/9 hover:border-white/20'
          }`}
        >
          <div className="flex items-start justify-between gap-5 px-5 pt-4.5 pb-3.5">
            <div className="min-w-0 flex-1">
              <h3
                className={`font-display text-[28px] leading-[1.05] text-balance ${
                  // A closed event is still the host's, just no longer the thing
                  // they are watching. It drops a step rather than greying out.
                  open ? '' : 'text-foreground/85'
                }`}
              >
                {event.event_name}
              </h3>
              <p className="mt-2 font-mono text-[10.5px] tracking-[0.08em] text-foreground/50">
                {/* Only a running event breathes. A closed one is a record,
                    and a record that pulses is asking to be looked at. */}
                {open ? (
                  <span className="inline-flex items-center gap-1.5 text-accent">
                    <LiveDot />
                    {en ? 'LIVE' : 'NYITVA'}{' '}
                    {shortTimeRemaining(
                      new Date(event.capture_end_at),
                      new Date(),
                      locale,
                    )}
                  </span>
                ) : null}
                {open ? ' · ' : ''}
                {metadataParts(event, en).join(' · ')}
              </p>
            </div>

            {/* An event that has stopped admitting guests is the one thing
                on this screen a host has to act on, so it gets the
                destructive treatment rather than another clause in the mono
                line. */}
            {!event.isFullPlan &&
            event.participantCount >= FREE_PARTICIPANT_LIMIT ? (
              <span className="shrink-0 rounded-full border border-destructive/35 bg-destructive/8 px-3 py-1.5 font-mono text-[9.5px] font-medium tracking-[0.12em] text-destructive">
                {en ? 'GUEST CAP FULL' : 'KERET BETELT'}
              </span>
            ) : null}
          </div>

          <PreviewStrip event={event} />
        </Link>
      </HostBlock>
    </li>
  )
}

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
  return (
    <div className="mt-6 flex flex-col gap-7">
      {active.length > 0 ? (
        <section>
          {/* Lilac on the running section only — the same rule the rest of the
              product now follows: the colour means the film is live. */}
          <h2 className="font-mono text-[9.5px] font-medium tracking-[0.2em] text-accent">
            {en ? 'RUNNING NOW' : 'MOST FUT'}
          </h2>
          <ul className="mt-3.5 flex flex-col gap-3">
            {active.map((event, i) => (
              <EventRow
                key={event.id}
                event={event}
                locale={locale}
                index={i}
              />
            ))}
          </ul>
        </section>
      ) : null}

      {closed.length > 0 ? (
        <section>
          <h2 className="font-mono text-[9.5px] font-medium tracking-[0.2em] text-foreground/38">
            {en ? 'CLOSED' : 'LEZÁRULT'}
          </h2>
          <ul className="mt-3.5 flex flex-col gap-3">
            {/* The closed section continues the count rather than restarting
                it, so the page assembles top to bottom as one sheet. */}
            {closed.map((event, i) => (
              <EventRow
                key={event.id}
                event={event}
                locale={locale}
                index={active.length + i}
              />
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  )
}
