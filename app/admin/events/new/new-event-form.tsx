'use client'

import { useActionState, useMemo, useState } from 'react'

import type { OnboardingNav } from '@/components/admin/onboarding/onboarding-shell'
import { useBrowserTimeZone } from '@/components/admin/onboarding/use-browser-time-zone'
import { DEFAULT_SHOTS, type RevealMode, type ShotOption } from '@/lib/camera'
import { eventLocalToIso, formatEventLocalInput } from '@/lib/format'
import {
  DEFAULT_REVEAL_DELAY_DAYS,
  clampRevealDelayDays,
  revealAfterDelay,
  type EventPlan,
} from '@/lib/onboarding'
import { createEvent, type CreateEventState } from './actions'
import { StepEnd } from './step-end'
import { StepGuests } from './step-guests'
import { StepName } from './step-name'
import { StepReveal } from './step-reveal'

const initial: CreateEventState = { error: null }

/** Four questions: name, end, reveal, and the party's size — guests, roll
 *  length and who may look, which share the last screen. The dots at the bottom
 *  count these, so anything added here is a dot a host sees. */
const STEP_COUNT = 4
const LAST_STEP = STEP_COUNT - 1

/**
 * One disposable camera, asked for four screens at a time.
 *
 * The whole draft lives in this component's state and posts once, on the last
 * screen. Nothing is written per step, so backing up is free and abandoning the
 * flow leaves nothing behind — a half-configured camera row would be a state
 * the dashboard, the QR code and the participant cap would all have to
 * understand.
 *
 * Two things the host is never asked, because there is only one sane answer:
 * **when the camera opens** (now — the server stamps it, so no clock skew
 * between the phone that filled the form and the machine that inserts the row)
 * and **which timezone** (the one the browser is in).
 */
export function NewEventForm({
  nowIso,
  defaultEndIso,
  suggestions,
  paymentsEnabled,
}: {
  nowIso: string
  defaultEndIso: string
  /** The five ÖTLETEK titles, resolved on the server because two of them are
   *  personalised with the host's own name. */
  suggestions: string[]
  /** Whether Stripe is switched on here, read on the server. Deployed
   *  environments have no `STRIPE_*` variables, so the paid tier is not offered
   *  there. */
  paymentsEnabled: boolean
}) {
  const [state, action, pending] = useActionState(createEvent, initial)
  const [step, setStep] = useState(0)

  const [name, setName] = useState('')
  const [revealMode, setRevealMode] = useState<RevealMode>('event_end')
  const [delayDays, setDelayDays] = useState(DEFAULT_REVEAL_DELAY_DAYS)
  const [shots, setShots] = useState<ShotOption>(DEFAULT_SHOTS)
  const [plan, setPlan] = useState<EventPlan>('free')
  const [guestsCanView, setGuestsCanView] = useState(true)

  const timeZone = useBrowserTimeZone()

  // `YYYY-MM-DDTHH:mm` — the exact shape the action parses, held as one string
  // so the day and the time cannot drift apart between the calendar and the
  // time pill.
  //
  // Null until the host touches it, and the suggested end is re-derived from
  // the server's instant in whatever zone this browser turns out to be in. That
  // is what lets the timezone arrive one render late without moving a value the
  // host has already chosen: after the first tap the wall clock is theirs, and
  // the zone stops being an input to it.
  const [chosenEnd, setChosenEnd] = useState<string | null>(null)
  const endLocal =
    chosenEnd ?? formatEventLocalInput(new Date(defaultEndIso), timeZone)

  const day = endLocal.slice(0, 10)
  const time = endLocal.slice(11)

  const endIso = eventLocalToIso(endLocal, timeZone)
  const today = formatEventLocalInput(new Date(nowIso), timeZone).slice(0, 10)

  const revealIso = useMemo(() => {
    if (!endIso || revealMode === 'instant') return null
    if (revealMode === 'event_end') return endIso
    return revealAfterDelay(new Date(endIso), delayDays).toISOString()
  }, [endIso, revealMode, delayDays])

  // The one thing that can be answered wrongly on the date screen: a window
  // that closes before it opens. Measured against the server's `nowIso` rather
  // than a live clock — a render must not read one — which leaves the case of a
  // host sitting on the page past their own chosen end. The action re-derives
  // `now` at insert time and refuses that with a message naming it.
  const endIsFuture = endIso ? endIso > nowIso : false

  const nav = (extra?: Partial<OnboardingNav>): OnboardingNav => ({
    step,
    stepCount: STEP_COUNT,
    backHref: step === 0 ? '/admin' : undefined,
    onBack: step === 0 ? undefined : () => setStep((s) => s - 1),
    onNext: () => setStep((s) => Math.min(LAST_STEP, s + 1)),
    error: state.error,
    ...extra,
  })

  return (
    <form
      action={action}
      onSubmit={(event) => {
        // Belt and braces for the implicit submission a text field triggers on
        // Enter: only the last screen may post, whatever else asks.
        if (step !== LAST_STEP) event.preventDefault()
      }}
    >
      {/* Every answer travels with the form, whichever screen is mounted — a
          hidden input per field rather than relying on the visible ones, so
          moving between questions cannot drop one. */}
      <input type="hidden" name="event_name" value={name} />
      <input type="hidden" name="time_zone" value={timeZone} />
      <input type="hidden" name="capture_end_at" value={endLocal} />
      <input type="hidden" name="reveal_mode" value={revealMode} />
      <input type="hidden" name="reveal_delay_days" value={delayDays} />
      <input type="hidden" name="shots_per_participant" value={shots} />
      <input type="hidden" name="plan" value={plan} />
      {guestsCanView ? (
        <input type="hidden" name="guests_can_view" value="on" />
      ) : null}

      {step === 0 ? (
        <StepName
          nav={nav()}
          name={name}
          setName={setName}
          suggestions={suggestions}
          canAdvance={name.trim().length > 0}
        />
      ) : null}

      {step === 1 ? (
        <StepEnd
          nav={nav()}
          day={day}
          setDay={(value) => setChosenEnd(`${value}T${time}`)}
          time={time}
          setTime={(value) => setChosenEnd(`${day}T${value}`)}
          today={today}
          canAdvance={endIsFuture}
        />
      ) : null}

      {step === 2 ? (
        <StepReveal
          nav={nav()}
          mode={revealMode}
          setMode={setRevealMode}
          delayDays={delayDays}
          setDelayDays={(value) => setDelayDays(clampRevealDelayDays(value))}
          revealIso={revealIso}
          timeZone={timeZone}
        />
      ) : null}

      {step === LAST_STEP ? (
        <StepGuests
          nav={nav({ onNext: undefined })}
          plan={plan}
          setPlan={setPlan}
          shots={shots}
          setShots={setShots}
          guestsCanView={guestsCanView}
          setGuestsCanView={setGuestsCanView}
          paymentsEnabled={paymentsEnabled}
          pending={pending}
        />
      ) : null}
    </form>
  )
}
