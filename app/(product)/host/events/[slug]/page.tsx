import { ArrowLeft, ExternalLink, Settings } from 'lucide-react'
import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'

import { ModerationGrid } from '@/components/host/moderation-grid'
import { QrCard } from '@/components/host/qr-card'
import { getEventQuota, type EventQuota } from '@/lib/billing'
import { captureWindowState } from '@/lib/camera'
import { revealSummary, shortTimeRemaining } from '@/lib/event-copy'
import { getOwnedEventBySlug } from '@/lib/events'
import { formatDeadline } from '@/lib/format'
import { localeTag } from '@/lib/i18n'
import { getAllEventPhotos, toModerationTiles } from '@/lib/photos'
import { eventPriceLabel } from '@/lib/pricing'
import { eventUrl } from '@/lib/site'

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
  const tiles = await toModerationTiles(photos)
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
      <div className="print-hidden flex items-center justify-between gap-4">
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
      </div>

      <div className="mt-6 grid gap-7 sm:grid-cols-[1fr_260px] sm:items-start">
        <div className="min-w-0">
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
              value={String(photos.length)}
              label={en ? 'PHOTOS TAKEN' : 'KÉP KÉSZÜLT'}
            />
            {quota ? (
              <Figure
                value={
                  quota.unlimited
                    ? String(quota.participantCount)
                    : `${quota.participantCount}/${quota.participantLimit}`
                }
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
              value={String(event.shots_per_participant)}
              label={en ? 'SHOTS EACH' : 'KÉP FEJENKÉNT'}
              divided
            />
          </div>

          {quota && !quota.unlimited ? (
            <QuotaBanner slug={event.slug} quota={quota} locale={locale} />
          ) : null}
        </div>

        {/* 260px of paper answering the one question a host has at a venue. */}
        <div className="sm:sticky sm:top-7">
          <QrCard
            name={event.event_name}
            url={url}
            shots={event.shots_per_participant}
            locale={locale}
          />
        </div>
      </div>

      <section className="print-hidden mt-9 border-t border-border pt-5">
        <ModerationGrid
          photos={tiles}
          slug={event.slug}
          locale={locale}
          title={en ? 'Photos' : 'Elkészült képek'}
          albumHref={
            photos.length > 0 ? `/host/events/${event.slug}/export` : null
          }
        />
      </section>

      {/* Four values read once. They do not need a 56px disclosure; they need
          to be legible and out of the way. */}
      <div className="print-hidden mt-8 flex flex-wrap border-t border-border pt-4 font-mono text-[11px] tracking-[0.06em] text-foreground/45">
        <ConfigCell>
          {en ? 'ENDS' : 'VÉGE'} ·{' '}
          {formatDeadline(event.capture_end_at, event.time_zone, locale)}
        </ConfigCell>
        <ConfigCell divided>
          {en ? 'DEVELOPING' : 'ELŐHÍVÁS'} ·{' '}
          {revealSummary(event.reveal_mode, locale)}
        </ConfigCell>
        <ConfigCell divided>
          {en ? 'GALLERY' : 'GALÉRIA'} ·{' '}
          {event.guests_can_view
            ? en
              ? 'GUESTS CAN SEE IT'
              : 'VENDÉGEK LÁTJÁK'
            : en
              ? 'ONLY YOU'
              : 'CSAK TE'}
        </ConfigCell>
        <ConfigCell divided>/E/{event.slug.toUpperCase()}</ConfigCell>
      </div>
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

function Figure({
  value,
  label,
  alarming = false,
  divided = false,
}: {
  value: string
  label: string
  alarming?: boolean
  divided?: boolean
}) {
  return (
    <div className={`py-4 ${divided ? 'border-l border-border px-5' : 'pr-5'}`}>
      <p
        className={`font-mono text-[30px] leading-none font-medium tracking-[-0.05em] ${
          alarming ? 'text-destructive' : ''
        }`}
      >
        {value}
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

function ConfigCell({
  children,
  divided = false,
}: {
  children: React.ReactNode
  divided?: boolean
}) {
  return (
    <span
      className={`py-1 ${divided ? 'border-l border-border px-5' : 'pr-5'}`}
    >
      {children}
    </span>
  )
}

/**
 * The free tier's edge, seen from the host's side.
 *
 * Unlike the guest's version of this message, the host is the person who can
 * act on it — so this one ends in a price and a button rather than a shrug.
 * The button goes to the billing card rather than straight to Stripe on
 * purpose: `startEventCheckout` requires the consumer-law acceptance, and that
 * checkbox is where it is shown.
 */
function QuotaBanner({
  slug,
  quota,
  locale,
}: {
  slug: string
  quota: EventQuota
  locale: 'en' | 'hu'
}) {
  const full = quota.participantCount >= quota.participantLimit
  const en = locale === 'en'

  return (
    <div
      className={`print-hidden mt-4.5 flex flex-wrap items-center justify-between gap-4 rounded-lg border px-4.5 py-3.5 ${
        full
          ? 'border-destructive/30 bg-destructive/8'
          : 'border-border bg-white/3'
      }`}
    >
      <div className="min-w-0">
        <p
          className={`text-[13.5px] font-semibold ${full ? 'text-destructive' : ''}`}
        >
          {full
            ? en
              ? 'New guests cannot join'
              : 'Új vendégek nem tudnak csatlakozni'
            : en
              ? 'Free event'
              : 'Ingyenes esemény'}
        </p>
        <p className="mt-1 text-[12.5px] leading-[1.5] text-muted-foreground">
          {full
            ? en
              ? `The free allowance filled up at ${quota.participantLimit} guests. Everyone already in can keep shooting.`
              : `Az ingyenes keret ${quota.participantLimit} vendégnél betelt. A már csatlakozottak tovább fotózhatnak.`
            : en
              ? `Up to ${quota.participantLimit} guests are free on this event.`
              : `Ezen az eseményen ${quota.participantLimit} vendégig ingyenes.`}
        </p>
      </div>
      <Link
        href={`/host/events/${slug}/settings?lang=${locale}#billing`}
        className="shrink-0 rounded-full bg-primary px-4.5 py-2.5 text-[12.5px] font-semibold text-primary-foreground transition-opacity hover:opacity-90"
      >
        {en ? 'Unlock' : 'Feloldás'} — {eventPriceLabel(locale)}
      </Link>
    </div>
  )
}
