'use client'

import { ArrowRight, Loader2 } from 'lucide-react'
import { motion } from 'motion/react'
import Image from 'next/image'
import Link from 'next/link'
import { useActionState, useEffect, useState } from 'react'

import {
  HOST_FIELD,
  HOST_KICKER,
  HOST_KICKER_BASE,
  HOST_LINK,
  HOST_PANEL,
  HOST_PRIMARY,
  HOST_TITLE,
} from '@/components/host/ui/classes'

import {
  joinEventAction,
  type JoinState,
} from '@/app/(product)/e/[slug]/actions'
import { capReachedNotice, revealSummary } from '@/lib/event-copy'
import { formatEventDay } from '@/lib/format'
import { type Locale, localeTag } from '@/lib/i18n'
import { FREE_PARTICIPANT_LIMIT } from '@/lib/onboarding'
import { ticket } from '@/lib/motion'
import { track } from '@/lib/telemetry'
import { useEntrance } from '@/lib/use-entrance'

const initial: JoinState = { error: null }

const NAME_MAX_LENGTH = 40

/**
 * The guest's front door, as a ticket.
 *
 * It wears the landing look the host app does, and borrows its class strings:
 * the ticket is a panel, the roll size is a Crimson figure, and the one action
 * is the white primary. It used to be a paper stub with a lilac button; the
 * shape is the same, only the material changed.
 *
 * The printed QR sheet was already the strongest-designed thing in the product
 * and it stopped at the sheet; this is its vocabulary used as the front door. A
 * stub issued to you, with the roll size printed on it and a tear line above
 * the one field you fill in — which says *what this is* before any copy does,
 * and does it on the one screen where a guest has never seen the product
 * before.
 *
 * The mechanism underneath is unchanged. It still posts to a server action that
 * creates the participant row and sets an httpOnly cookie the page can never
 * read — because the cookie decides how many photos someone gets, and a value
 * the page can read is a value the page can forge. It is still one screen and
 * one field: joining is the only thing standing between a guest and the camera,
 * and every extra question costs participation, which is the number the pilot
 * exists to measure.
 */
export function JoinForm({
  eventId,
  slug,
  eventName,
  hostName,
  coverUrl,
  shotsPerParticipant,
  revealMode,
  captureEndAt,
  timeZone,
  stateLabel,
  revealed,
  canCapture,
  locale,
}: {
  eventId: string
  slug: string
  eventName: string
  hostName: string | null
  coverUrl: string | null
  shotsPerParticipant: number
  revealMode: 'instant' | 'event_end' | 'custom'
  captureEndAt: string
  timeZone: string
  /** What the event is doing right now — before, during, or after. */
  stateLabel: string
  /** The reveal has passed. The ticket stops promising a development that
   *  already happened. */
  revealed: boolean
  canCapture: boolean
  locale: Locale
}) {
  const en = locale === 'en'
  const [state, action, pending] = useActionState(joinEventAction, initial)
  const [name, setName] = useState('')

  // The top of the guest funnel: a QR scan that reached the ticket. `camera`
  // is what the ticket could promise at that moment. Once per mount, with the
  // props as they were on arrival — the deps are deliberately just the slug.
  useEffect(() => {
    track('guest_page_viewed', {
      event_id: eventId,
      joined: false,
      camera: canCapture ? 'open' : 'closed',
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps -- arrival snapshot
  }, [slug])

  // `useActionState` hands back a fresh object per action result, which is
  // exactly once per refused submit — the one place that property is useful.
  useEffect(() => {
    if (state.error) {
      track('guest_join_refused', {
        event_id: eventId,
        reason: state.reason ?? 'unknown',
      })
    }
  }, [eventId, state])
  // The stub is torn off and handed over: it drops a little and straightens.
  // The same variant carries the QR sheet at the end of the create flow —
  // same object, same motion, both surfaces.
  const stage = useEntrance({ step: 0.12 })
  // No effect watching for success, and no `router.refresh()` — the navigation
  // to the camera happens inside `joinEventAction`, which redirects. An effect
  // keyed on `useActionState`'s state has no stable resting point, since that
  // state is a fresh object on every render.
  if (state.capReached)
    return <ParticipantCapReached eventName={eventName} locale={locale} />

  const day = formatEventDay(captureEndAt, timeZone, locale)
  const byline = hostName
    ? en
      ? `Hosted by ${hostName} · ${day}`
      : `${hostName} eseménye · ${day}`
    : day

  return (
    <main
      className="mx-auto flex min-h-dvh w-full max-w-md flex-col justify-center px-5 py-11"
      // `/e/` sits outside the locale tree, so the product root layout can only
      // set the document to the site default. This subtree is in the event's
      // own language, and marking it is what a screen reader actually reads.
      lang={localeTag[locale]}
    >
      {coverUrl ? (
        <div className="relative mb-6 aspect-[4/3] w-full overflow-hidden rounded-2xl">
          <Image
            src={coverUrl}
            alt={en ? `${eventName} cover photo` : `${eventName} borítóképe`}
            fill
            sizes="(max-width: 448px) 100vw, 448px"
            unoptimized
            priority
            className="object-cover"
          />
        </div>
      ) : null}

      <form action={action}>
        <input type="hidden" name="slug" value={slug} />
        <input type="hidden" name="lang" value={locale} />

        {/* The ticket. `overflow-hidden` is deliberately absent: the tear line's
            two notches have to bleed past both edges to read as punched out of
            the panel rather than drawn on it. */}
        <motion.div
          {...ticket}
          transition={stage(1)}
          className={`${HOST_PANEL} relative px-6 pt-7`}
        >
          <p className={HOST_KICKER}>
            {en ? 'OurFilm · Disposable camera' : 'OurFilm · Eldobható kamera'}
          </p>

          <h1 className={`mt-3.5 ${HOST_TITLE}`}>{eventName}</h1>
          <p className="mt-2 text-[14px] leading-[1.5] text-white/65">
            {byline}
          </p>

          <div className="mt-6 flex items-end justify-between gap-4">
            <div>
              <p className={HOST_KICKER}>{en ? 'Your roll' : 'A tekercsed'}</p>
              <p className="host-figure mt-1 text-[44px] leading-[0.9] text-white tabular-nums">
                {shotsPerParticipant}
              </p>
            </div>
            <div className="text-right">
              <p className={HOST_KICKER}>
                {revealed
                  ? en
                    ? 'Photos'
                    : 'A képek'
                  : en
                    ? 'Developing'
                    : 'Előhívás'}
              </p>
              <p className="mt-1.5 text-[14px] leading-[1.4] font-medium text-white">
                {revealed
                  ? en
                    ? 'Developed'
                    : 'Előhívva'
                  : revealSummary(revealMode, locale)}
              </p>
            </div>
          </div>

          {/* The tear line. The only ornament in the design, and it earns its
              place: it says "stub" before a single word does. The two circles
              are the page ground punched through the panel, so they have to be
              `bg-landing` rather than a shade of the panel. */}
          <div
            aria-hidden="true"
            className="relative top-[9px] mt-6 flex items-center gap-2"
          >
            <span className="-ml-8 size-4 shrink-0 rounded-full bg-landing" />
            <span className="h-px flex-1 bg-[repeating-linear-gradient(to_right,rgba(255,255,255,.18)_0_5px,transparent_5px_11px)]" />
            <span className="-mr-8 size-4 shrink-0 rounded-full bg-landing" />
          </div>

          <div className="pt-7 pb-6">
            <label htmlFor="join-name" className={`block ${HOST_KICKER}`}>
              {en ? 'Your name' : 'A neved'}
            </label>
            <input
              id="join-name"
              name="name"
              required
              maxLength={NAME_MAX_LENGTH}
              autoComplete="name"
              autoFocus
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={en ? 'Enter your name' : 'Írd be a neved'}
              className={`mt-3 ${HOST_FIELD}`}
            />
          </div>
        </motion.div>

        {state.error ? (
          <p className="mt-4 text-center text-[14px] leading-[1.5] text-host-danger">
            {state.error}
          </p>
        ) : null}

        {/* When the camera is not open there is something the ticket cannot
            say — the day shooting *starts*. The open state's version of this
            line only repeats the roll size printed above, so it is not shown. */}
        {!canCapture ? (
          <p className="mt-4 text-center text-[13px] leading-[1.5] text-pretty text-white/65">
            {stateLabel}
          </p>
        ) : null}

        {/* Outside the card: the one white primary on the screen, on the one
            action that starts the film. */}
        <button
          type="submit"
          disabled={pending || !name.trim()}
          className={`mt-4 w-full gap-2.5 disabled:pointer-events-none ${HOST_PRIMARY}`}
        >
          {pending ? (
            <Loader2 className="size-5 animate-spin" aria-hidden="true" />
          ) : null}
          {canCapture
            ? en
              ? 'Open camera'
              : 'Kamera megnyitása'
            : en
              ? 'Join event'
              : 'Csatlakozom'}
          {pending ? null : (
            <ArrowRight
              className="size-[18px]"
              strokeWidth={2}
              aria-hidden="true"
            />
          )}
        </button>

        <p
          className={`mt-4 text-center leading-[1.8] text-white/55 ${HOST_KICKER_BASE}`}
        >
          {en ? 'No app · No sign-up' : 'Nincs app · Nincs regisztráció'}
          <br />
          {en
            ? 'No preview · No retakes'
            : 'Nincs előnézet · Nincs újrapróbálás'}
        </p>

        <p className="mt-5 text-center text-[12px] leading-[1.6] text-pretty text-white/55">
          {en ? 'By joining you accept the ' : 'A csatlakozással elfogadod az '}
          <Link href={en ? '/en/terms' : '/hu/aszf'} className={HOST_LINK}>
            {en
              ? 'guest rules in the Terms of service'
              : 'ÁSZF vendégekre vonatkozó szabályait'}
          </Link>
          {en ? ' and acknowledge the ' : ', és tudomásul veszed az '}
          <Link
            href={en ? '/en/privacy' : '/hu/adatvedelem'}
            className={HOST_LINK}
          >
            {en ? 'Privacy notice' : 'adatkezelési tájékoztatót'}
          </Link>
          .
        </p>
      </form>
    </main>
  )
}

/**
 * The free tier's edge, seen from the guest's side (7l).
 *
 * No checkout, no price, no button. A wedding guest holding a phone is not the
 * person who can fix this, and asking them to pay for the couple's album is the
 * wrong sentence to put in front of them. The upgrade lives on the host's
 * dashboard, where the person who can act on it is already standing. The copy
 * is `capReachedNotice`, shared with the action's own refusal.
 *
 * It is a plain panel rather than the ticket: the ticket is a stub issued to
 * you, and this guest was not issued one.
 */
function ParticipantCapReached({
  eventName,
  locale,
}: {
  eventName: string
  locale: Locale
}) {
  const { title, body } = capReachedNotice(FREE_PARTICIPANT_LIMIT, locale)
  return (
    <main
      className="mx-auto flex min-h-dvh w-full max-w-md flex-col justify-center px-4 py-11"
      lang={localeTag[locale]}
    >
      <section className={`${HOST_PANEL} px-6 py-8`}>
        <p className="text-[14px] leading-[1.4] font-medium [overflow-wrap:anywhere] text-host-warn">
          {eventName}
        </p>
        <h1 className="landing-serif mt-3 font-landing-display text-[28px] leading-[1.2] text-balance text-white">
          {title}
        </h1>
        <p className="mt-3 text-[15px] leading-[1.6] text-pretty text-white/65">
          {body}
        </p>
      </section>
    </main>
  )
}
