'use client'

import { useRouter, useSearchParams } from 'next/navigation'
import { useEffect, useMemo, useRef, useState, useTransition } from 'react'

import { AuthDialog } from '@/components/host/onboarding/auth-dialog'
import { DraftRestoreDialog } from '@/components/host/onboarding/draft-restore-dialog'
import { OnboardingShell } from '@/components/host/onboarding/onboarding-shell'
import { useBrowserTimeZone } from '@/components/host/onboarding/use-browser-time-zone'
import {
  invalidateStoredDraft,
  useStoredDraft,
} from '@/components/host/onboarding/use-stored-draft'
import type { RevealChoice, ShotOption } from '@/lib/camera'
import {
  clearDraft,
  draftHasAnswers,
  emptyDraft,
  saveDraft,
  type EventDraft,
} from '@/lib/event-draft'
import { eventLocalToIso, formatEventLocalInput } from '@/lib/format'
import type { EventPlan } from '@/lib/onboarding'
import { type Locale, resolveLocale } from '@/lib/i18n'
import { createEventFromDraft } from './actions'
import { endScreen } from './step-end'
import { guestsScreen } from './step-guests'
import { nameScreen } from './step-name'
import { revealScreen } from './step-reveal'

/** Four questions: name, end, reveal, and the party's size — guests, roll
 *  length and who may look, which share the last screen. The dots at the bottom
 *  count these, so anything added here is a dot a host sees. */
const STEP_COUNT = 4
const LAST_STEP = STEP_COUNT - 1
const END_STEP = 1

type Props = {
  nowIso: string
  defaultEndIso: string
  /** The five ÖTLETEK titles, resolved on the server. */
  suggestions: string[]
  /** Whether Stripe is switched on here. Deployed environments have no
   *  `STRIPE_*` variables, so the paid tier is not offered there. */
  paymentsEnabled: boolean
  /** Minted server-side so the first render matches on both sides — a
   *  `crypto.randomUUID()` in a state initializer would differ between the
   *  server's HTML and the client's, and this value is rendered into the
   *  draft. A restored draft brings its own and replaces it. */
  initialCreationKey: string
}

/**
 * Decides which draft the flow starts from, then gets out of the way.
 *
 * The stored draft cannot be read during render (it is client-only) and must
 * not be set from an effect, so the choice is made here and applied by
 * remounting `OnboardingFlow` with a different `key`. Every piece of state
 * below the key is then plain initialisation from props — no effect ever moves
 * an answer the host has already given.
 */
export function NewEventForm(props: Props) {
  const stored = useStoredDraft()
  const params = useSearchParams()
  const timeZone = useBrowserTimeZone()
  const locale: Locale = resolveLocale(params.get('lang'))

  // Set by the resume route when a draft's end date has gone by: reopen the
  // flow on the date screen with everything else intact, rather than asking
  // whether to restore something the host has just been told is stale.
  const forceEndStep = params.get('resume') === 'end' && stored !== null

  const [choice, setChoice] = useState<'undecided' | 'fresh' | 'stored'>(
    'undecided',
  )

  const useStored = stored !== null && (choice === 'stored' || forceEndStep)
  const askRestore =
    choice === 'undecided' &&
    !forceEndStep &&
    stored !== null &&
    draftHasAnswers(stored)

  const fresh = useMemo(
    () =>
      emptyDraft(
        new Date(props.nowIso),
        timeZone,
        props.initialCreationKey,
        locale,
      ),
    [props.nowIso, timeZone, props.initialCreationKey, locale],
  )

  const initial = useStored && stored ? stored : fresh

  return (
    <>
      <OnboardingFlow
        key={useStored && stored ? stored.creationKey : 'fresh'}
        {...props}
        initial={initial}
        initialCreationKey={
          useStored && stored ? stored.creationKey : props.initialCreationKey
        }
        startStep={forceEndStep ? END_STEP : initial.step}
        timeZone={timeZone}
        locale={locale}
      />

      <DraftRestoreDialog
        open={askRestore}
        locale={locale}
        onResume={() => setChoice('stored')}
        onDiscard={() => {
          clearDraft()
          invalidateStoredDraft()
          setChoice('fresh')
        }}
      />
    </>
  )
}

/**
 * One disposable camera, asked for four screens at a time.
 *
 * Nothing is written to the database until the last screen, and nothing is
 * written *at all* until there is an account: a visitor can fill the whole
 * thing in signed out, and the answers live in `localStorage` until they are
 * worth a row. That is the trade — no anonymous events in the database, no lost
 * answers in the browser.
 *
 * Two things the host is never asked, because there is only one sane answer:
 * **when the camera opens** (now — the server stamps it, so no clock skew
 * between the phone that filled the form and the machine that inserts the row)
 * and **which timezone** (the one the browser is in).
 */
function OnboardingFlow({
  nowIso,
  defaultEndIso,
  suggestions,
  paymentsEnabled,
  initial,
  initialCreationKey,
  startStep,
  timeZone,
  locale,
}: Props & {
  initial: EventDraft
  startStep: number
  timeZone: string
  locale: Locale
}) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const [authOpen, setAuthOpen] = useState(false)

  const [step, setStep] = useState(Math.min(LAST_STEP, Math.max(0, startStep)))
  const [name, setName] = useState(initial.name)
  const [revealMode, setRevealMode] = useState<RevealChoice>(initial.revealMode)
  const [shots, setShots] = useState<ShotOption>(initial.shots)
  const [plan, setPlan] = useState<EventPlan>(initial.plan)
  const [guestsCanView, setGuestsCanView] = useState(initial.guestsCanView)
  const [legalAccepted, setLegalAccepted] = useState(initial.legalAccepted)

  // `YYYY-MM-DDTHH:mm`, held as one string so the day and the time cannot drift
  // apart between the calendar and the time pill. Null means "not chosen yet",
  // and the suggested end is re-derived from the server's instant in whatever
  // zone this browser turns out to be in — which is what lets the timezone
  // arrive one render late without moving a value the host has already picked.
  const [chosenEnd, setChosenEnd] = useState<string | null>(
    initial.endLocal || null,
  )
  const endLocal =
    chosenEnd ?? formatEventLocalInput(new Date(defaultEndIso), timeZone)

  const day = endLocal.slice(0, 10)
  const time = endLocal.slice(11)

  const endIso = eventLocalToIso(endLocal, timeZone)
  const today = formatEventLocalInput(new Date(nowIso), timeZone).slice(0, 10)

  const draft: EventDraft = useMemo(
    () => ({
      locale,
      name,
      endLocal,
      timeZone,
      revealMode,
      shots,
      plan,
      guestsCanView,
      legalAccepted,
      step,
      creationKey: initialCreationKey,
      pendingCreate: false,
      createdAt: initial.createdAt,
      updatedAt: initial.updatedAt,
    }),
    [
      locale,
      name,
      endLocal,
      timeZone,
      revealMode,
      shots,
      plan,
      guestsCanView,
      legalAccepted,
      step,
      initialCreationKey,
      initial.createdAt,
      initial.updatedAt,
    ],
  )

  // Every meaningful change, straight to the store. No debounce: this is one
  // small JSON write against a synchronous API, and the case it exists for is a
  // browser closing without warning.
  //
  // The first pass is deliberately skipped. Mounting is not a change, and
  // writing the untouched defaults on mount would overwrite the very draft this
  // page exists to offer back — which is exactly what it did until a reload
  // stopped showing the restore prompt.
  const savedSignature = useRef<string | null>(null)
  const signature = JSON.stringify(draft)
  useEffect(() => {
    if (savedSignature.current === null) {
      savedSignature.current = signature
      return
    }
    if (savedSignature.current === signature) return
    savedSignature.current = signature
    saveDraft(draft, new Date())
  }, [signature, draft])

  const revealIso = revealMode === 'event_end' ? endIso : null

  // The one thing that can be answered wrongly on the date screen: a window
  // that closes before it opens. Measured against the server's `nowIso` rather
  // than a live clock — a render must not read one — which leaves the case of a
  // host sitting on the page past their own chosen end. The action re-derives
  // `now` at insert time and refuses that with a message naming it.
  const endIsFuture = endIso ? endIso > nowIso : false

  function create() {
    setError(null)
    startTransition(async () => {
      const result = await createEventFromDraft({
        locale,
        name,
        endLocal,
        timeZone,
        revealMode,
        shots,
        plan,
        guestsCanView,
        legalAccepted,
        creationKey: initialCreationKey,
      })

      if (result.ok) {
        // Only now. The draft is the only copy of these answers until the row
        // exists, so it outlives every failure between here and there.
        clearDraft()
        invalidateStoredDraft()
        leave(result.destination)
        return
      }

      if (result.reason === 'auth') {
        // Remembered across the round trip: the mail client is a different app,
        // and what comes back is a fresh page load with nothing but this.
        saveDraft({ ...draft, pendingCreate: true }, new Date())
        setAuthOpen(true)
        return
      }

      if (result.reason === 'end') setStep(END_STEP)
      setError(result.error)
    })
  }

  /** An app route goes through the router; a Stripe URL is a different origin
   *  and has to be a real navigation. `assign` rather than setting `.href`,
   *  which is the same navigation written as a mutation. */
  function leave(destination: string) {
    if (destination.startsWith('/')) router.replace(destination)
    else window.location.assign(destination)
  }

  const advance = () => setStep((s) => Math.min(LAST_STEP, s + 1))

  // One shell, four questions. Each step file returns its own copy, its own
  // CTA and its fields; the shell above them is the same element on every
  // step, which is the only way the step counter can roll and the progress
  // rule can grow rather than being cut and redrawn. See `StepScreen`.
  const { content, ...screen } =
    step === 0
      ? nameScreen({
          locale,
          name,
          setName,
          onAdvance: advance,
          suggestions:
            locale === 'en'
              ? [
                  'Our wedding',
                  'The big day',
                  'Birthday party',
                  'Anniversary',
                  'One unforgettable night',
                ]
              : suggestions,
          canAdvance: name.trim().length > 0,
        })
      : step === END_STEP
        ? endScreen({
            locale,
            day,
            setDay: (value) => setChosenEnd(`${value}T${time}`),
            time,
            setTime: (value) => setChosenEnd(`${day}T${value}`),
            today,
            canAdvance: endIsFuture,
          })
        : step === 2
          ? revealScreen({
              locale,
              mode: revealMode,
              setMode: setRevealMode,
              revealIso,
              timeZone,
            })
          : guestsScreen({
              locale,
              plan,
              setPlan: (value) => {
                setPlan(value)
                // The paid wording also contains the early-performance
                // request, so changing plan requires a fresh, explicit choice.
                setLegalAccepted(false)
              },
              shots,
              setShots,
              guestsCanView,
              setGuestsCanView,
              legalAccepted,
              setLegalAccepted,
              paymentsEnabled,
              pending,
            })

  return (
    <>
      <OnboardingShell
        {...screen}
        locale={locale}
        step={step}
        stepCount={STEP_COUNT}
        backHref={step === 0 ? '/host' : undefined}
        onBack={step === 0 ? undefined : () => setStep((s) => s - 1)}
        onNext={step === LAST_STEP ? create : advance}
        error={error}
      >
        {content}
      </OnboardingShell>

      <AuthDialog
        locale={locale}
        open={authOpen}
        onClose={() => setAuthOpen(false)}
        returnTo="/auth/event-complete"
      />
    </>
  )
}
