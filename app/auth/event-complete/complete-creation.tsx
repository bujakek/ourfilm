'use client'

import { useEffect, useState } from 'react'

import { LoadingStatus } from '@/components/loading-status'
import { clearDraft, loadDraft, saveDraft } from '@/lib/event-draft'
import { createEventFromDraft } from '@/app/admin/events/new/actions'

/**
 * What this screen can end up showing. Success is not among them: it navigates
 * away, and `working` is what is on screen while it does.
 */
type Outcome =
  | { kind: 'working' }
  | { kind: 'no-draft' }
  | { kind: 'stale-end' }
  | { kind: 'error'; message: string }

const GENERIC_ERROR =
  'Az eseményt most nem sikerült létrehozni. A beállításaidat elmentettük, így később újra megpróbálhatod.'

/**
 * Runs once per page load.
 *
 * The module-level guard is the same one `app/auth/callback/callback-exchange.tsx`
 * uses, for the same class of reason: React Strict Mode remounts in
 * development, and a second run is a second create. It is a courtesy though,
 * not the mechanism — the draft carries a `creationKey` and the database has a
 * unique index on `(owner_id, creation_key)`, so a reload, a second tab and the
 * same magic link opened twice all land on the event the first attempt made.
 *
 * Deliberately started from an **effect**, not from `use()` during render. The
 * work navigates, and kicking it off in the render phase had React reporting a
 * router update while this component was still rendering — which is the honest
 * description of what it was.
 */
let started = false

const dbg = (m: string) => {
  try {
    window.localStorage.setItem(
      '__dbg',
      (window.localStorage.getItem('__dbg') ?? '') + m + ' | ',
    )
  } catch {}
}

async function run(): Promise<Outcome> {
  const draft = loadDraft(new Date())
  if (!draft) return { kind: 'no-draft' }

  // A host who signed in from somewhere else and happens to have an unfinished
  // form. Nothing was asked for, so nothing is created — back to the flow,
  // where the restore prompt will offer it.
  if (!draft.pendingCreate) {
    window.location.replace('/admin/events/new')
    return { kind: 'working' }
  }

  let result
  try {
    result = await createEventFromDraft({
      name: draft.name,
      endLocal: draft.endLocal,
      timeZone: draft.timeZone,
      revealMode: draft.revealMode,
      delayDays: draft.delayDays,
      shots: draft.shots,
      plan: draft.plan,
      guestsCanView: draft.guestsCanView,
      creationKey: draft.creationKey,
    })
  } catch {
    return { kind: 'error', message: GENERIC_ERROR }
  }

  dbg('result:' + JSON.stringify(result).slice(0, 120))
  if (result.ok) {
    // Only now, and only here. Until this line the draft is the one copy of
    // these answers.
    clearDraft()
    // A full navigation rather than a client push: the session is new, and
    // every server component downstream should be rendered against it. It also
    // covers the Stripe case, which is a different origin entirely.
    window.location.replace(result.destination)
    return { kind: 'working' }
  }

  // Everything below leaves the draft in place, so the host can try again
  // without re-answering anything.
  if (result.reason === 'end') {
    // The intent is cleared but the answers are not: the flow reopens on the
    // date screen rather than trying to create again the moment it loads.
    saveDraft({ ...draft, pendingCreate: false }, new Date())
    return { kind: 'stale-end' }
  }

  if (result.reason === 'auth') {
    // The session did not survive the round trip. The flow asks again, with the
    // draft intact.
    window.location.replace('/admin/events/new')
    return { kind: 'working' }
  }

  return { kind: 'error', message: result.error }
}

/**
 * Finishes a creation that was interrupted by signing up.
 *
 * The host pressed the CTA, was asked for an account, read a mail and came back
 * — as a fresh page load carrying nothing but the draft in this browser's
 * `localStorage`. Nobody is asked to fill anything in again, or to press
 * anything again.
 */
export function CompleteCreation() {
  const [outcome, setOutcome] = useState<Outcome>({ kind: 'working' })

  useEffect(() => {
    if (started) return
    started = true
    // The state update lands in a `.then`, after the work — this is the result
    // of an async task, not state derived from props.
    void run()
      .then(setOutcome)
      .catch(() => setOutcome({ kind: 'error', message: GENERIC_ERROR }))
  }, [])

  switch (outcome.kind) {
    case 'no-draft':
      return (
        <Outcome
          title="Nem találtuk az esemény piszkozatát"
          detail="A piszkozat csak abban a böngészőben érhető el, ahol elkezdted az eseményt."
          href="/admin/events/new"
          cta="Új esemény létrehozása"
        />
      )
    case 'stale-end':
      return (
        <Outcome
          title="Frissítsd az esemény végét"
          detail="A korábban kiválasztott időpont már elmúlt. Válassz egy új befejezési időpontot."
          // `resume=end` reopens the flow on the date screen with every other
          // answer still in place, rather than starting over.
          href="/admin/events/new?resume=end"
          cta="Időpont választása"
        />
      )
    case 'error':
      return (
        <Outcome
          title="Nem sikerült létrehozni"
          detail={outcome.message}
          href="/admin/events/new"
          cta="Vissza a beállításokhoz"
        />
      )
    default:
      return (
        <div className="flex min-h-[100dvh] items-center justify-center px-5">
          <LoadingStatus
            title="Esemény létrehozása…"
            description="Egy pillanat, mentjük a beállításaidat."
          />
        </div>
      )
  }
}

function Outcome({
  title,
  detail,
  href,
  cta,
}: {
  title: string
  detail: string
  href: string
  cta: string
}) {
  return (
    <main className="mx-auto flex min-h-[100dvh] max-w-md flex-col items-center justify-center px-5 text-center">
      <h1 className="font-display text-2xl font-semibold tracking-tight text-balance">
        {title}
      </h1>
      <p className="mt-3 text-sm leading-relaxed text-pretty text-muted-foreground">
        {detail}
      </p>
      <a
        href={href}
        className="btn-shine mt-7 inline-flex min-h-14 items-center justify-center rounded-2xl bg-primary px-7 text-base font-semibold text-primary-foreground"
      >
        {cta}
      </a>
    </main>
  )
}
