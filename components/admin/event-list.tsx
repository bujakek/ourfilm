import type { EventListItem } from '@/lib/events'
import { formatDeadline } from '@/lib/format'
import { EyeOff, Images, Users } from 'lucide-react'
import Image from 'next/image'
import Link from 'next/link'

function PreviewStrip({ event }: { event: EventListItem }) {
  if (event.previewUrls.length === 0) {
    return (
      <p className="mt-3 flex items-center gap-1.5 text-xs text-muted-foreground">
        <Images className="size-3.5" />
        Még nincs feltöltött kép
      </p>
    )
  }

  // The overflow count covers hidden photos too, so the number matches what the
  // moderation grid shows rather than only what is on display here.
  const overflow = event.photoCount - event.previewUrls.length

  return (
    <div className="mt-3 flex items-center gap-2">
      {event.previewUrls.map((url) => (
        <div
          key={url}
          className="relative size-14 shrink-0 overflow-hidden rounded-xl"
        >
          <Image
            src={url}
            alt=""
            fill
            sizes="56px"
            unoptimized
            className="object-cover"
          />
        </div>
      ))}
      {overflow > 0 ? (
        <span className="glass flex size-14 shrink-0 items-center justify-center rounded-xl text-sm font-medium text-muted-foreground">
          +{overflow}
        </span>
      ) : null}
    </div>
  )
}

function EventRow({ event }: { event: EventListItem }) {
  return (
    <li>
      <Link
        href={`/admin/events/${event.slug}`}
        className="glass glass-hover block rounded-2xl px-5 py-4"
      >
        <div className="flex flex-wrap items-baseline justify-between gap-x-4">
          <p className="truncate font-semibold">{event.event_name}</p>
          <p className="text-xs text-muted-foreground">
            {formatDeadline(event.capture_end_at, event.time_zone)}
          </p>
        </div>
        <p className="mt-1 truncate text-xs text-muted-foreground">
          /e/{event.slug}
          {event.photoCount > 0 ? ` · ${event.photoCount} kép` : ''}
        </p>
        <p className="mt-1 inline-flex items-center gap-1.5 text-xs text-muted-foreground">
          <Users className="size-3" />
          {event.participantCount} résztvevő · {event.shots_per_participant} kép
          fejenként
        </p>
        {!event.guests_can_view ? (
          <p className="mt-2 inline-flex items-center gap-1.5 text-xs text-muted-foreground">
            <EyeOff className="size-3" />A galériát csak te látod
          </p>
        ) : null}
        <PreviewStrip event={event} />
      </Link>
    </li>
  )
}

export function EventList({
  active,
  closed,
}: {
  active: EventListItem[]
  closed: EventListItem[]
}) {
  return (
    <div className="mt-8 flex flex-col gap-8">
      {active.length > 0 ? (
        <section>
          <h2 className="mb-3 text-xs font-medium tracking-[0.2em] text-muted-foreground">
            AKTÍV
          </h2>
          <ul className="flex flex-col gap-3">
            {active.map((event) => (
              <EventRow key={event.id} event={event} />
            ))}
          </ul>
        </section>
      ) : null}

      {closed.length > 0 ? (
        <section>
          <h2 className="mb-3 text-xs font-medium tracking-[0.2em] text-muted-foreground">
            LEZÁRULT
          </h2>
          <ul className="flex flex-col gap-3">
            {closed.map((event) => (
              <EventRow key={event.id} event={event} />
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  )
}
