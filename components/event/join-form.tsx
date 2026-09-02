'use client'

import { ArrowRight, Loader2 } from 'lucide-react'
import Image from 'next/image'
import Link from 'next/link'
import { useActionState, useState } from 'react'

import {
  joinEventAction,
  type JoinState,
} from '@/app/(product)/e/[slug]/actions'
import { type Locale, localeTag } from '@/lib/i18n'

const initial: JoinState = { error: null }

const NAME_MAX_LENGTH = 40

/**
 * The guest's front door.
 *
 * Replaces the old join gate, which wrote a readable cookie from client
 * JavaScript and was documented as UX rather than access control. This one
 * posts to a server action that creates the participant row and sets an
 * httpOnly cookie the page can never read — because the cookie now decides how
 * many photos someone gets, and a value the page can read is a value the page
 * can forge.
 *
 * Still one screen and one field. Joining is the only thing standing between a
 * guest and the camera, and every extra question costs participation, which is
 * the number the pilot exists to measure.
 */
export function JoinForm({
  slug,
  eventName,
  hostName,
  coverUrl,
  shotsPerParticipant,
  stateLabel,
  canCapture,
  locale,
}: {
  slug: string
  eventName: string
  hostName: string | null
  coverUrl: string | null
  shotsPerParticipant: number
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

  return (
    <main
      className="mx-auto flex min-h-dvh w-full max-w-md flex-col justify-center px-4 py-10"
      // `/e/` sits outside the locale tree, so the product root layout can only
      // set the document to the site default. This subtree is in the event's
      // own language, and marking it is what a screen reader actually reads.
      lang={localeTag[locale]}
    >
      {coverUrl ? (
        <div className="relative mb-8 aspect-[4/3] w-full overflow-hidden rounded-3xl">
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

      <h1 className="text-3xl font-semibold tracking-tight text-balance">
        {eventName}
      </h1>
      {hostName ? (
        <p className="mt-1.5 text-sm text-muted-foreground">
          {en ? `Hosted by ${hostName}` : `${hostName} eseménye`}
        </p>
      ) : null}

      <p className="mt-4 text-sm leading-relaxed text-pretty text-muted-foreground">
        {stateLabel}
      </p>

      <form action={action} className="mt-8 flex flex-col gap-4">
        <input type="hidden" name="slug" value={slug} />
        <input type="hidden" name="lang" value={locale} />

        <div>
          <label
            htmlFor="join-name"
            className="mb-2 block text-sm text-muted-foreground"
          >
            {en ? 'What is your name?' : 'Mi a neved?'}
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
            className="glass min-h-14 w-full rounded-2xl px-5 text-base outline-none placeholder:text-muted-foreground/60 focus:border-accent"
          />
        </div>

        {state.error ? (
          <p className="text-sm text-destructive">{state.error}</p>
        ) : null}

        <button
          type="submit"
          disabled={pending || !name.trim()}
          className="btn-shine inline-flex min-h-14 items-center justify-center gap-2 rounded-full bg-primary px-7 text-base font-semibold text-primary-foreground disabled:opacity-60"
        >
          {pending ? (
            <Loader2 className="size-5 animate-spin" />
          ) : (
            <ArrowRight className="size-5" strokeWidth={2} />
          )}
          {canCapture
            ? en
              ? 'Open camera'
              : 'Kamera megnyitása'
            : en
              ? 'Join event'
              : 'Csatlakozom'}
        </button>

        <p className="text-center text-xs leading-relaxed text-muted-foreground">
          {en
            ? `You have ${shotsPerParticipant} shots for this event.`
            : `${shotsPerParticipant} képet készíthetsz ezen az eseményen.`}
        </p>
        <p className="text-center text-[0.7rem] leading-relaxed text-muted-foreground">
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
 */
function ParticipantCapReached({ locale }: { locale: Locale }) {
  const en = locale === 'en'
  return (
    <main
      className="mx-auto flex min-h-dvh w-full max-w-md flex-col justify-center px-4 py-10 text-center"
      lang={localeTag[locale]}
    >
      <h1 className="text-2xl font-semibold tracking-tight text-balance">
        {en
          ? 'This event has reached its guest limit'
          : 'Az esemény elérte a résztvevői keretet'}
      </h1>
      <p className="mt-4 text-sm leading-relaxed text-pretty text-muted-foreground">
        {en
          ? 'The free event supports up to 5 guests. Ask the host to unlock the full event.'
          : 'Ez az ingyenes esemény legfeljebb 5 résztvevővel használható. Kérd meg a szervezőt, hogy oldja fel a teljes eseményt.'}
      </p>
    </main>
  )
}
