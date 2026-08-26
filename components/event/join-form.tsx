'use client'

import { ArrowRight, Loader2 } from 'lucide-react'
import Image from 'next/image'
import Link from 'next/link'
import { useActionState, useState } from 'react'

import { joinEventAction, type JoinState } from '@/app/e/[slug]/actions'

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
}: {
  slug: string
  eventName: string
  hostName: string | null
  coverUrl: string | null
  shotsPerParticipant: number
  /** What the event is doing right now — before, during, or after. */
  stateLabel: string
  canCapture: boolean
}) {
  const [state, action, pending] = useActionState(joinEventAction, initial)
  const [name, setName] = useState('')
  // No effect watching for success, and no `router.refresh()` — the navigation
  // to the camera happens inside `joinEventAction`, which redirects. An effect
  // keyed on `useActionState`'s state has no stable resting point, since that
  // state is a fresh object on every render.
  if (state.capReached) return <ParticipantCapReached />

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-md flex-col justify-center px-4 py-10">
      {coverUrl ? (
        <div className="relative mb-8 aspect-[4/3] w-full overflow-hidden rounded-3xl">
          <Image
            src={coverUrl}
            alt={`${eventName} borítóképe`}
            fill
            sizes="(max-width: 448px) 100vw, 448px"
            unoptimized
            priority
            className="object-cover"
          />
        </div>
      ) : (
        // No cover is the common case, so the fallback has to look intentional
        // rather than like a failed image.
        <div
          aria-hidden="true"
          className="glass-strong mb-8 flex aspect-[4/3] w-full items-center justify-center rounded-3xl"
        >
          <span className="text-gradient-accent text-5xl font-semibold tracking-tight">
            {eventName.slice(0, 1).toUpperCase()}
          </span>
        </div>
      )}

      <h1 className="text-3xl font-semibold tracking-tight text-balance">
        {eventName}
      </h1>
      {hostName ? (
        <p className="mt-1.5 text-sm text-muted-foreground">
          {hostName} eseménye
        </p>
      ) : null}

      <p className="mt-4 text-sm leading-relaxed text-pretty text-muted-foreground">
        {stateLabel}
      </p>

      <form action={action} className="mt-8 flex flex-col gap-4">
        <input type="hidden" name="slug" value={slug} />

        <div>
          <label
            htmlFor="join-name"
            className="mb-2 block text-sm text-muted-foreground"
          >
            Mi a neved?
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
            placeholder="Írd be a neved"
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
          {canCapture ? 'Kamera megnyitása' : 'Csatlakozom'}
        </button>

        <p className="text-center text-xs leading-relaxed text-muted-foreground">
          {shotsPerParticipant} képet készíthetsz ezen az eseményen.
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
function ParticipantCapReached() {
  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-md flex-col justify-center px-4 py-10 text-center">
      <h1 className="text-2xl font-semibold tracking-tight text-balance">
        Az esemény elérte a résztvevői keretet
      </h1>
      <p className="mt-4 text-sm leading-relaxed text-pretty text-muted-foreground">
        Ez az ingyenes esemény legfeljebb 5 résztvevővel használható. Kérd meg a
        szervezőt, hogy oldja fel a teljes eseményt.
      </p>
    </main>
  )
}
