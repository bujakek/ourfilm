import { ArrowLeft, ExternalLink, Settings } from 'lucide-react'
import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'

import { HostBlock } from '@/components/host/host-block'
import { ModerationGrid } from '@/components/host/moderation-grid'
import { exportAnswer, exportNote } from '@/lib/exports/answer'
import { HostCamera } from '@/components/host/host-camera'
import { QuotaBanner } from '@/components/host/quota-banner'
import { Odometer } from '@/components/ui/odometer'
import { getEventQuota } from '@/lib/billing'
import { captureWindowState } from '@/lib/camera'
import { shortTimeRemaining } from '@/lib/event-copy'
import { getOwnedEventBySlug } from '@/lib/events'
import { localeTag } from '@/lib/i18n'
import { getAllEventPhotos, toModerationTiles } from '@/lib/photos'
import { eventUrl } from '@/lib/site'
import { reportServerIssue } from '@/lib/telemetry-server'

export const dynamic = 'force-dynamic'

type Props = {
  params: Promise<{ slug: string }>
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params
  const event = await getOwnedEventBySlug(slug)
  return {
    title: event ? `${event.event_name} — OurFilm` : 'Esemény — OurFilm',
    robots: { index: false, follow: false },
  }
}

/**
 * The host's console for one event, restructured so the live event outranks
 * its configuration.
 *
 * What a host wants while standing at a venue is: is it running, how much has
 * arrived, and where is the code. Those are now the whole first screen — a
 * status pill, the name, three figures, and the printable ticket beside them —
 * instead of a three-row `<dl>` in body text with the QR behind a button.
 *
 * Configuration did not go anywhere; it stopped competing. The four values a
 * host reads once are a ruled mono strip at the bottom rather than a 56px
 * disclosure, and everything editable is still one tap away in settings.
 */
export default async function AdminEventPage({ params }: Props) {
  const { slug } = await params
  const event = await getOwnedEventBySlug(slug)
  if (!event) notFound()
  const locale = event.locale
  const en = locale === 'en'

  const [quota, photos] = await Promise.all([
    getEventQuota(event.id).catch((error) => {
      console.error('Could not read participant quota', error)
      return null
    }),
    getAllEventPhotos(event.id),
  ])
  const tiles = toModerationTiles(photos, event.time_zone)
  // What the Album button should say before anyone taps it: a host coming
  // back to a prepared archive, or to one still being built, sees that state
  // rendered rather than a generic button they have to tap to find out.
  //
  // Best effort, never fatal: the album is the page, and the export's state
  // is a line on a button. If reading it throws — the migration not yet on
  // this database, Storage refusing to sign — the button starts blank and
  // finds out on tap, and the failure is reported rather than shown as a
  // whole-page error.
  const initialExport =
    photos.length > 0
      ? await exportAnswer(event, photos).catch(async (e) => {
          await reportServerIssue(e, {
            operation: 'album_export_status',
            eventId: event.id,
            route: '/host/events/[slug]',
            routeType: 'page',
            method: 'GET',
          })
          return null
        })
      : null
  const url = eventUrl(event.slug, locale)
  const now = new Date()
  const windowState = captureWindowState({
    now,
    captureStartAt: new Date(event.capture_start_at),
    captureEndAt: new Date(event.capture_end_at),
  })
  const overQuota =
    quota !== null &&
    !quota.unlimited &&
    quota.participantCount >= quota.participantLimit

  return (
    <main
      className="mx-auto min-h-dvh w-full max-w-3xl px-5 pt-7 pb-11 sm:px-7"
      lang={localeTag[locale]}
    >
      {/* Utility row. The settings gear stops being a lone lilac icon button:
          it is a destination, not a state, and lilac now means the film is
          live. */}
      <HostBlock
        index={0}
        className="print-hidden flex items-center justify-between gap-4"
      >
        <Link
          href={`/host?lang=${locale}`}
          className="inline-flex items-center gap-2 font-mono text-[11px] tracking-[0.1em] text-foreground/45 transition-colors hover:text-foreground"
        >
          <ArrowLeft className="size-3.5" aria-hidden="true" />
          {en ? 'YOUR EVENTS' : 'ESEMÉNYEID'}
        </Link>
        <div className="flex items-center gap-2">
          <Link href={`/e/${event.slug}?lang=${locale}`} className={pillClass}>
            <ExternalLink className="size-3.5" aria-hidden="true" />
            {en ? 'Guest view' : 'Vendégnézet'}
          </Link>
          <Link
            href={`/host/events/${event.slug}/settings?lang=${locale}`}
            className={pillClass}
          >
            <Settings className="size-3.5" aria-hidden="true" />
            {en ? 'Settings' : 'Beállítások'}
          </Link>
        </div>
      </HostBlock>

      <HostBlock index={1} className="mt-6 min-w-0">
        <CapturePill
          state={windowState}
          captureEndAt={event.capture_end_at}
          now={now}
          locale={locale}
        />

        <h1 className="mt-4 font-display text-[40px] leading-none tracking-[-0.012em] text-balance sm:text-[52px]">
          {event.event_name}
        </h1>

        {/* Three figures on one ruled row, replacing the three-row `<dl>`.
              Each is a number a host actually watches, and each was previously
              a sentence weighted exactly like the other two. */}
        {/* A grid rather than a wrapping row: with `flex-wrap` the third
              figure dropped to a second line still carrying its left divider,
              which reads as a broken table. Three columns share the width and
              a long label wraps inside its own cell instead. */}
        <div className="mt-6 grid grid-cols-3 border-y border-border">
          <Figure
            value={photos.length}
            label={en ? 'PHOTOS TAKEN' : 'KÉP KÉSZÜLT'}
          />
          {quota ? (
            <Figure
              value={quota.participantCount}
              of={quota.unlimited ? null : quota.participantLimit}
              label={
                overQuota
                  ? en
                    ? 'GUEST CAP FULL'
                    : 'KERET BETELT'
                  : en
                    ? 'GUESTS'
                    : 'VENDÉG'
              }
              alarming={overQuota}
              divided
            />
          ) : null}
          <Figure
            value={event.shots_per_participant}
            label={en ? 'SHOTS EACH' : 'KÉP FEJENKÉNT'}
            divided
          />
        </div>

        {/* The host's own roll, in the guest's own shape. Directly under
              the figures because those are what it changes: a photo taken
              here lands in the grid below and moves "KÉP KÉSZÜLT" above. */}
        <HostCamera
          slug={event.slug}
          eventId={event.id}
          eventName={event.event_name}
          eventUrl={url}
          shots={event.shots_per_participant}
          canCapture={windowState === 'open'}
          locale={locale}
        />

        {quota && !quota.unlimited ? (
          <QuotaBanner
            slug={event.slug}
            eventId={event.id}
            quota={quota}
            locale={locale}
          />
        ) : null}
      </HostBlock>

      <HostBlock index={2}>
        <section className="print-hidden mt-9 border-t border-border pt-5">
          <ModerationGrid
            photos={tiles}
            slug={event.slug}
            eventId={event.id}
            locale={locale}
            timeZone={event.time_zone}
            title={en ? 'Photos' : 'Elkészült képek'}
            exportEndpoint={
              photos.length > 0 ? `/host/events/${event.slug}/export` : null
            }
            exportInitial={initialExport}
            exportNote={exportNote(photos.length, locale)}
          />
        </section>
      </HostBlock>
    </main>
  )
}

const pillClass =
  'inline-flex min-h-9 items-center gap-2 rounded-full border border-white/14 px-4 text-[11px] font-medium text-foreground/80 transition-colors hover:border-white/30 hover:text-foreground'

/** The capture window as a state, in the one colour that means it is running. */
function CapturePill({
  state,
  captureEndAt,
  now,
  locale,
}: {
  state: 'before' | 'open' | 'after'
  captureEndAt: string
  now: Date
  locale: 'en' | 'hu'
}) {
  const en = locale === 'en'
  if (state === 'open') {
    return (
      <span className="inline-flex items-center gap-2 rounded-full border border-accent/35 px-3 py-1.5 font-mono text-[9.5px] font-medium tracking-[0.16em] text-accent">
        <span
          aria-hidden="true"
          className="size-[5px] rounded-full bg-accent"
        />
        {en ? 'CAMERA OPEN' : 'A KAMERA NYITVA'} ·{' '}
        {shortTimeRemaining(new Date(captureEndAt), now, locale)}
      </span>
    )
  }
  return (
    <span className="inline-flex items-center rounded-full border border-border px-3 py-1.5 font-mono text-[9.5px] font-medium tracking-[0.16em] text-foreground/45">
      {state === 'before'
        ? en
          ? 'NOT OPEN YET'
          : 'MÉG NEM NYÍLT MEG'
        : en
          ? 'SHOOTING ENDED'
          : 'VÉGET ÉRT A FOTÓZÁS'}
    </span>
  )
}

/**
 * One number a host watches.
 *
 * It rolls, and nothing else on the page responds — no toast, no highlighted
 * row. A figure that changes while the host is looking elsewhere should be
 * correct when he looks back, not something that demanded he look now.
 */
function Figure({
  value,
  of = null,
  label,
  alarming = false,
  divided = false,
}: {
  value: number
  /** The cap this figure is measured against, when it has one. */
  of?: number | null
  label: string
  alarming?: boolean
  divided?: boolean
}) {
  return (
    <div className={`py-4 ${divided ? 'border-l border-border px-5' : 'pr-5'}`}>
      <p
        className={`flex items-baseline font-mono text-[30px] leading-none font-medium tracking-[-0.05em] ${
          alarming ? 'text-destructive' : ''
        }`}
      >
        <Odometer value={value} dir="up" />
        {of === null ? null : <span>/{of}</span>}
      </p>
      <p
        className={`mt-1.5 font-mono text-[9px] font-medium tracking-[0.16em] ${
          alarming ? 'text-destructive' : 'text-foreground/45'
        }`}
      >
        {label}
      </p>
    </div>
  )
}
