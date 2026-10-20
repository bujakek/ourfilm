import { Eye, Settings } from 'lucide-react'
import { getHostLocale } from '@/lib/host-locale'
import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'

import {
  HOST_ICON_BUTTON,
  HOST_KICKER,
  HOST_KICKER_DOT,
  HOST_PANEL,
  HOST_TILE,
  HOST_TITLE,
} from '@/components/host/ui/classes'
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
import { quotaBannerState } from '@/lib/host-ui'
import { localeTag } from '@/lib/i18n'
import { getAllEventPhotos, toModerationTiles } from '@/lib/photos'
import { eventUrl } from '@/lib/site'
import { reportServerIssue } from '@/lib/telemetry-server'
import { BackLink } from '@/components/ui/back-link'

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
  // The host's own language, from their profile — not the event's, which
  // is only the fallback for an account with none on record.
  const locale = await getHostLocale(event.locale)
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
  // No `?lang`: the guest page follows each guest's own phone.
  const url = eventUrl(event.slug)
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

  const bannerState = quota
    ? quotaBannerState({
        count: quota.participantCount,
        limit: quota.participantLimit,
        unlimited: quota.unlimited,
      })
    : null

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
        <BackLink href={`/host?lang=${locale}`}>
          {en ? 'Your events' : 'Eseményeid'}
        </BackLink>
        <div className="flex items-center gap-2">
          <Link
            href={`/e/${event.slug}?lang=${locale}`}
            aria-label={en ? 'Guest view' : 'Vendégnézet'}
            className={HOST_ICON_BUTTON}
          >
            <Eye className="size-5" aria-hidden="true" />
          </Link>
          <Link
            href={`/host/events/${event.slug}/settings?lang=${locale}`}
            aria-label={en ? 'Settings' : 'Beállítások'}
            className={HOST_ICON_BUTTON}
          >
            <Settings className="size-5" aria-hidden="true" />
          </Link>
        </div>
      </HostBlock>

      <HostBlock index={1} className="mt-6 min-w-0">
        <CaptureKicker
          state={windowState}
          captureEndAt={event.capture_end_at}
          now={now}
          locale={locale}
        />

        <h1 className={`mt-4 [overflow-wrap:anywhere] ${HOST_TITLE}`}>
          {event.event_name}
        </h1>

        {/* Three tiles share the width; a long label wraps inside its own. */}
        <div className="mt-6 grid grid-cols-3 gap-2">
          <Figure value={photos.length} label={en ? 'photos' : 'kép'} />
          {quota ? (
            <Figure
              value={quota.participantCount}
              of={quota.unlimited ? null : quota.participantLimit}
              label={
                overQuota
                  ? en
                    ? 'cap full'
                    : 'betelt'
                  : en
                    ? 'guests'
                    : 'vendég'
              }
              alarming={overQuota}
            />
          ) : null}
          <Figure
            value={event.shots_per_participant}
            label={en ? 'photos / guest' : 'kép / fő'}
          />
        </div>

        {/* The host's own roll, in the guest's own shape. */}
        <HostCamera
          slug={event.slug}
          eventId={event.id}
          eventName={event.event_name}
          eventUrl={url}
          shots={event.shots_per_participant}
          canCapture={windowState === 'open'}
          locale={locale}
        />

        {quota && bannerState ? (
          <QuotaBanner
            slug={event.slug}
            eventId={event.id}
            quota={quota}
            state={bannerState}
            locale={locale}
          />
        ) : null}
      </HostBlock>

      <HostBlock index={2}>
        <section className={`print-hidden mt-6 p-5 ${HOST_PANEL}`}>
          <ModerationGrid
            photos={tiles}
            slug={event.slug}
            eventId={event.id}
            locale={locale}
            timeZone={event.time_zone}
            title={en ? 'Photos' : 'Képek'}
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

/** The capture window as a kicker; the sky dot marks the live state. */
function CaptureKicker({
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
  return (
    <p className={`flex items-center gap-2 ${HOST_KICKER}`}>
      {state === 'open' ? (
        <>
          <span aria-hidden="true" className={HOST_KICKER_DOT} />
          {en ? 'Open' : 'Nyitva'} ·{' '}
          {shortTimeRemaining(new Date(captureEndAt), now, locale)}
        </>
      ) : state === 'before' ? (
        en ? (
          'Not open yet'
        ) : (
          'Még nem lehet fotózni'
        )
      ) : en ? (
        'Shooting ended'
      ) : (
        'Véget ért a fotózás'
      )}
    </p>
  )
}

/**
 * One number a host watches. It rolls, and nothing else on the page responds:
 * a figure that changes while the host is looking elsewhere should be correct
 * when they look back, not something that demanded they look now.
 */
function Figure({
  value,
  of = null,
  label,
  alarming = false,
}: {
  value: number
  /** The cap this figure is measured against, when it has one. */
  of?: number | null
  label: string
  alarming?: boolean
}) {
  return (
    <div className={`min-w-0 px-3 py-4 ${HOST_TILE}`}>
      <p
        className={`host-figure flex items-baseline text-[38px] leading-none ${
          alarming ? 'text-host-danger' : 'text-white'
        }`}
      >
        <Odometer value={value} dir="up" />
        {of === null ? null : <span>/{of}</span>}
      </p>
      <p
        className={`mt-2 ${HOST_KICKER} ${alarming ? 'text-host-danger' : ''}`}
      >
        {label}
      </p>
    </div>
  )
}
