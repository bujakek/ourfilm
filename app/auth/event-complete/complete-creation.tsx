'use client'

import { useEffect, useState, useSyncExternalStore } from 'react'

import { LegalConsent } from '@/components/host/legal-consent'
import { useStoredDraft } from '@/components/host/onboarding/use-stored-draft'
import { LoadingStatus } from '@/components/loading-status'
import { CHECKOUT_COPY } from '@/lib/legal/copy/forms'
import { clearDraft, saveDraft, type EventDraft } from '@/lib/event-draft'
import { createEventFromDraft } from '@/app/host/events/new/actions'

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
 * Finishes a creation that was interrupted by signing up.
 *
 * The host pressed the CTA, was asked for an account, read a mail and came back
 * — as a fresh page load carrying nothing but the draft in this browser's
 * `localStorage`. Every answer is still there and none of them is asked again.
 *
 * **The two declarations are.** They are deliberately not carried in the draft:
 * a consent stored in `localStorage` and replayed later is a consent nobody
 * made at the moment the contract formed, and a draft resumed a week later
 * would arrive with the ÁSZF box already ticked. So this screen shows the same
 * two boxes as the last onboarding step, unticked, next to the same button —
 * which is also the honest moment, because the account now exists and this
 * press is what creates the event.
 */
export function CompleteCreation() {
  // `useSyncExternalStore` rather than an effect, the same way the create flow
  // reads it: `localStorage` is client-only, so the server snapshot is null and
  // React re-renders with the real value after hydration. Reading it in an
  // effect and calling setState is the same result with an extra render and a
  // lint rule against it; reading it during render is a hydration mismatch.
  const draft = useStoredDraft()
  const hydrated = useHydrated()
  const [outcome, setOutcome] = useState<Outcome | null>(null)

  // A host who signed in from somewhere else and happens to have an unfinished
  // form. Nothing was asked for, so nothing is created — back to the flow,
  // where the restore prompt will offer it.
  useEffect(() => {
    if (hydrated && draft && !draft.pendingCreate) {
      window.location.replace('/host/events/new')
    }
  }, [hydrated, draft])

  if (!hydrated) return <Working />
  if (!outcome && draft?.pendingCreate) {
    return <ConfirmCreate draft={draft} onOutcome={setOutcome} />
  }
  if (!outcome && !draft) {
    return (
      <Outcome
        title="Nem találtuk az esemény piszkozatát"
        detail="A piszkozat csak abban a böngészőben érhető el, ahol elkezdted az eseményt."
        href="/host/events/new"
        cta="Új esemény létrehozása"
      />
    )
  }
  if (!outcome) return <Working />

  switch (outcome.kind) {
    case 'no-draft':
      return (
        <Outcome
          title="Nem találtuk az esemény piszkozatát"
          detail="A piszkozat csak abban a böngészőben érhető el, ahol elkezdted az eseményt."
          href="/host/events/new"
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
          href="/host/events/new?resume=end"
          cta="Időpont választása"
        />
      )
    case 'error':
      return (
        <Outcome
          title="Nem sikerült létrehozni"
          detail={outcome.message}
          href="/host/events/new"
          cta="Vissza a beállításokhoz"
        />
      )
    default:
      return <Working />
  }
}

/**
 * Whether this render is the client's, one render after the server's.
 *
 * `useStoredDraft()` returns null in the server snapshot whether or not a
 * draft exists, so "null" alone cannot be read as "no draft" — doing that
 * would flash "we could not find your draft" at every host who followed a
 * magic link. This distinguishes the two.
 *
 * `useSyncExternalStore` with an empty subscribe rather than a `setState` in
 * an effect: same one-render delay, no cascading render, and it is the pattern
 * the rest of the flow already uses for client-only values.
 */
const noSubscribe = () => () => {}

function useHydrated(): boolean {
  return useSyncExternalStore(
    noSubscribe,
    () => true,
    () => false,
  )
}

function Working() {
  return (
    <div className="flex min-h-[100dvh] items-center justify-center px-5">
      <LoadingStatus
        title="Esemény létrehozása…"
        description="Egy pillanat, mentjük a beállításaidat."
      />
    </div>
  )
}

function ConfirmCreate({
  draft,
  onOutcome,
}: {
  draft: EventDraft
  onOutcome: (outcome: Outcome) => void
}) {
  const [acceptedTerms, setAcceptedTerms] = useState(false)
  const [acceptedEarlyPerformance, setAcceptedEarlyPerformance] =
    useState(false)
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function create() {
    setPending(true)
    setError(null)

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
        acceptedTerms,
        acceptedEarlyPerformance,
      })
    } catch {
      setPending(false)
      onOutcome({ kind: 'error', message: GENERIC_ERROR })
      return
    }

    if (result.ok) {
      // Only now, and only here. Until this line the draft is the one copy of
      // these answers.
      clearDraft()
      // A full navigation rather than a client push: the session is new, and
      // every server component downstream should be rendered against it. It
      // also covers the Stripe case, which is a different origin entirely.
      window.location.replace(result.destination)
      return
    }

    setPending(false)

    // Everything below leaves the draft in place, so the host can try again
    // without re-answering anything.
    if (result.reason === 'end') {
      // The intent is cleared but the answers are not: the flow reopens on the
      // date screen rather than trying to create again the moment it loads.
      saveDraft({ ...draft, pendingCreate: false }, new Date())
      onOutcome({ kind: 'stale-end' })
      return
    }

    if (result.reason === 'auth') {
      // The session did not survive the round trip. The flow asks again, with
      // the draft intact.
      window.location.replace('/host/events/new')
      return
    }

    setError(result.error)
  }

  return (
    <main className="mx-auto flex min-h-[100dvh] max-w-md flex-col justify-center px-5 py-10">
      <h1 className="font-display text-2xl font-semibold tracking-tight text-balance">
        Már csak egy lépés
      </h1>
      <p className="mt-3 text-sm leading-relaxed text-pretty text-muted-foreground">
        {draft.name.trim()
          ? `Az „${draft.name.trim()}” esemény beállításai megvannak.`
          : 'Az esemény beállításai megvannak.'}
      </p>

      <div className="mt-7">
        <LegalConsent
          acceptedTerms={acceptedTerms}
          setAcceptedTerms={setAcceptedTerms}
          acceptedEarlyPerformance={acceptedEarlyPerformance}
          setAcceptedEarlyPerformance={setAcceptedEarlyPerformance}
          disabled={pending}
        />
      </div>

      {error ? (
        <p role="alert" className="mt-4 text-sm text-destructive">
          {error}
        </p>
      ) : null}

      <button
        type="button"
        disabled={!acceptedTerms || !acceptedEarlyPerformance || pending}
        aria-busy={pending}
        onClick={() => void create()}
        className="btn-shine mt-7 inline-flex min-h-14 w-full items-center justify-center rounded-2xl bg-primary px-6 text-base font-semibold text-primary-foreground disabled:opacity-40"
      >
        {draft.plan === 'full' ? CHECKOUT_COPY.paidSubmit : 'Létrehozás'}
      </button>
    </main>
  )
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
