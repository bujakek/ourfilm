'use client'

import { ArrowRight, Loader2 } from 'lucide-react'
import Image from 'next/image'
import Link from 'next/link'
import { useActionState, useState } from 'react'

import {
  joinEventAction,
  type JoinState,
} from '@/app/(product)/e/[slug]/actions'
import { revealSummary } from '@/lib/event-copy'
import { formatEventDay } from '@/lib/format'
import { type Locale, localeTag } from '@/lib/i18n'

const initial: JoinState = { error: null }

const NAME_MAX_LENGTH = 40

/**
 * The guest's front door, as a ticket.
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
  slug,
  eventName,
  hostName,
  coverUrl,
  shotsPerParticipant,
  revealMode,
  captureEndAt,
  timeZone,
  stateLabel,
  canCapture,
  locale,
}: {
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
  canCapture: boolean
  locale: Locale
}) {
  const en = locale === 'en'
  const [state, action, pending] = useActionState(joinEventAction, initial)
  const [name, setName] = useState('')
  // No effect watching for success, and no `router.refresh()` — the navigation
  // to the camera happens inside `joinEventAction`, which redirects. An effect
  // keyed on `useActionState`'s state has no stable resting point, since that
  // state is a fresh object on every render.
  if (state.capReached) return <ParticipantCapReached locale={locale} />

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
            the sheet rather than drawn on it. */}
        <div className="paper relative rounded-lg px-6 pt-6.5">
          <p className="paper-muted font-mono text-[9.5px] font-medium tracking-[0.2em]">
            {en ? 'OURFILM · DISPOSABLE CAMERA' : 'OURFILM · ELDOBHATÓ KAMERA'}
          </p>

          <h1 className="mt-3.5 font-display text-[38px] leading-[1.02] tracking-[-0.01em] text-balance">
            {eventName}
          </h1>
          <p className="paper-muted mt-1.5 text-[13px]">{byline}</p>

          <div className="paper-rule mt-5.5 flex items-end justify-between gap-4 border-t pt-4">
            <div>
              <p className="paper-muted font-mono text-[9px] font-medium tracking-[0.16em]">
                {en ? 'YOUR ROLL' : 'A TEKERCSED'}
              </p>
              <p className="mt-1 font-mono text-[40px] leading-[0.9] font-medium tracking-[-0.05em]">
                {shotsPerParticipant}
              </p>
            </div>
            <div className="text-right">
              <p className="paper-muted font-mono text-[9px] font-medium tracking-[0.16em]">
                {en ? 'DEVELOPING' : 'ELŐHÍVÁS'}
              </p>
              <p className="mt-1 font-mono text-[12px] leading-[1.4] font-medium">
                {revealSummary(revealMode, locale)}
              </p>
            </div>
          </div>

          {/* The tear line. The only ornament in the design, and it earns its
              place: it says "stub" before a single word does. The two circles
              are the page background punched through the sheet, so they have to
              be `bg-background` rather than a shade of paper. */}
          <div
            aria-hidden="true"
            className="relative top-[9px] mt-5 flex items-center gap-2"
          >
            <span className="-ml-8 size-4 shrink-0 rounded-full bg-background" />
            <span className="h-px flex-1 bg-[repeating-linear-gradient(to_right,rgba(20,19,18,.28)_0_5px,transparent_5px_11px)]" />
            <span className="-mr-8 size-4 shrink-0 rounded-full bg-background" />
          </div>

          <div className="pt-6.5 pb-6">
            <label
              htmlFor="join-name"
              className="paper-muted block font-mono text-[9px] font-medium tracking-[0.16em]"
            >
              {en ? 'YOUR NAME' : 'A NEVED'}
            </label>
            {/* A rule, not a filled box. On paper that is what a field looks
                like — and `.glass` is no longer what an input wears anywhere. */}
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
              className="mt-2.5 w-full border-b-[1.5px] border-[rgba(20,19,18,.22)] bg-transparent pb-2.5 text-[19px] text-[color:var(--paper-foreground)] outline-none placeholder:text-[rgba(20,19,18,.32)] focus:border-[rgba(20,19,18,.5)]"
            />
          </div>
        </div>

        {state.error ? (
          <p className="mt-4 text-center text-sm text-destructive">
            {state.error}
          </p>
        ) : null}

        {/* When the camera is not open there is something the ticket cannot
            say — the day shooting *starts*. The open state's version of this
            line only repeats the roll size printed above, so it is not shown. */}
        {!canCapture ? (
          <p className="mt-4 text-center text-[12px] leading-relaxed text-pretty text-foreground/55">
            {stateLabel}
          </p>
        ) : null}

        {/* Outside the card, and the one lilac fill in the product — on the one
            action that starts the film. */}
        <button
          type="submit"
          disabled={pending || !name.trim()}
          className="btn-shine mt-4 flex min-h-14 w-full items-center justify-center gap-2.5 rounded-xl bg-accent text-[15px] font-semibold text-accent-foreground transition-opacity disabled:pointer-events-none disabled:opacity-50"
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

        <p className="mt-3.5 text-center font-mono text-[10px] leading-[1.7] tracking-[0.05em] text-foreground/40">
          {en ? 'NO APP · NO SIGN-UP' : 'NINCS APP · NINCS REGISZTRÁCIÓ'}
          <br />
          {en
            ? 'NO PREVIEW · NO RETAKES'
            : 'NINCS ELŐNÉZET · NINCS ÚJRAPRÓBÁLÁS'}
        </p>

        <p className="mt-4.5 text-center text-[11px] leading-[1.6] text-pretty text-foreground/42">
          A csatlakozással elfogadod az{' '}
          <Link
            href="/hu/aszf"
            className="underline underline-offset-2 hover:text-foreground"
          >
            ÁSZF vendégekre vonatkozó szabályait
          </Link>
          , és tudomásul veszed az{' '}
          <Link
            href="/hu/adatvedelem"
            className="underline underline-offset-2 hover:text-foreground"
          >
            adatkezelési tájékoztatót
          </Link>
          .
        </p>
      </form>
    </main>
  )
}

/**
 * The free tier's edge, seen from the guest's side.
 *
 * No checkout, no price, no button. A wedding guest holding a phone is not the
 * person who can fix this, and asking them to pay for the couple's album is the
 * wrong sentence to put in front of them. The upgrade lives on the host's
 * dashboard, where the person who can act on it is already standing.
 *
 * It gets the paper treatment because it is still the ticket window — the guest
 * arrived at the same door, and it is the answer that is different, not the
 * place.
 */
function ParticipantCapReached({ locale }: { locale: Locale }) {
  const en = locale === 'en'
  return (
    <main
      className="mx-auto flex min-h-dvh w-full max-w-md flex-col justify-center px-5 py-11"
      lang={localeTag[locale]}
    >
      <div className="paper rounded-lg px-6 py-7 text-center">
        <p className="paper-muted font-mono text-[9.5px] font-medium tracking-[0.2em]">
          {en ? 'OURFILM · DISPOSABLE CAMERA' : 'OURFILM · ELDOBHATÓ KAMERA'}
        </p>
        <h1 className="mt-4 font-display text-[28px] leading-[1.06] text-balance">
          {en
            ? 'This event has reached its guest limit'
            : 'Az esemény elérte a résztvevői keretet'}
        </h1>
        <p className="paper-muted mt-3 text-sm leading-relaxed text-pretty">
          {en
            ? 'The free event supports up to 5 guests. Ask the host to unlock the full event.'
            : 'Ez az ingyenes esemény legfeljebb 5 résztvevővel használható. Kérd meg a szervezőt, hogy oldja fel a teljes eseményt.'}
        </p>
      </div>
    </main>
  )
}
