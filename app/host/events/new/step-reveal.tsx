'use client'

import { CalendarClock, Clock, Hourglass } from 'lucide-react'

import { DelayStepper } from '@/components/host/onboarding/delay-stepper'
import {
  OnboardingShell,
  type OnboardingNav,
} from '@/components/host/onboarding/onboarding-shell'
import { RevealPreview } from '@/components/host/onboarding/reveal-preview'
import type { RevealMode } from '@/lib/camera'
import { formatRevealBadge } from '@/lib/format'

/**
 * Three answers to one question, and the same three the schema already knows:
 * `instant` opens the gallery while the party is still running, `event_end`
 * pins it to the moment the camera closes, `custom` puts whole days between the
 * two. Nothing new is being modelled here — the labels are the host-facing
 * spelling of `events.reveal_mode`.
 */
const CHOICES: { mode: RevealMode; label: string; Icon: typeof Clock }[] = [
  { mode: 'instant', label: 'Az esemény alatt', Icon: Hourglass },
  { mode: 'event_end', label: 'Az esemény után', Icon: Clock },
  { mode: 'custom', label: 'Késleltetve', Icon: CalendarClock },
]

/**
 * Question three: when does the album develop?
 *
 * The two photos above the choices are the answer rather than a decoration.
 * Sharp means a guest can open the gallery mid-party; blurred means they
 * cannot, and the badge says exactly when that changes. A radio list can
 * describe a delayed reveal; only this can show one, and this is the setting
 * hosts have the least intuition about.
 */
export function StepReveal({
  nav,
  mode,
  setMode,
  delayDays,
  setDelayDays,
  revealIso,
  timeZone,
}: {
  nav: OnboardingNav
  mode: RevealMode
  setMode: (value: RevealMode) => void
  delayDays: number
  setDelayDays: (value: number) => void
  /** The resolved reveal instant for the current answer, or null while the
   *  window is not yet a valid pair of dates. */
  revealIso: string | null
  timeZone: string
}) {
  const badge =
    mode === 'instant'
      ? 'A képek azonnal láthatók'
      : revealIso
        ? `Megjelenik: ${formatRevealBadge(revealIso, timeZone)}`
        : 'Az esemény után jelenik meg'

  return (
    <OnboardingShell
      {...nav}
      title="Mikor jelenjenek meg a képek?"
      detail="A képek alapból rejtve maradnak az esemény alatt. Te döntöd el, mikor nyíljon meg a galéria."
      cta="Tovább"
    >
      <RevealPreview blurred={mode !== 'instant'} badge={badge} />

      {/* mt-auto rather than a fixed gap: the free space collects between the
          preview and the choices, which is where the reference puts it, and the
          choices stay a thumb's reach from the CTA on every screen height. */}
      <fieldset className="mt-auto pt-6">
        <legend className="sr-only">A galéria megnyílásának időpontja</legend>
        <div className="grid grid-cols-3 gap-2.5">
          {CHOICES.map(({ mode: choice, label, Icon }) => {
            const active = choice === mode
            return (
              <label
                key={choice}
                // The radio itself is sr-only, so the global :focus-visible
                // ring has nothing visible to draw on — `has-` moves it out to
                // the card a keyboard user is actually looking at.
                className={`glass flex min-h-28 cursor-pointer flex-col justify-between rounded-2xl p-3.5 transition-colors has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-accent ${
                  active
                    ? 'bg-accent/10 font-semibold text-accent ring-2 ring-accent'
                    : ''
                }`}
              >
                <input
                  type="radio"
                  name="reveal_mode_choice"
                  value={choice}
                  checked={active}
                  onChange={() => setMode(choice)}
                  className="sr-only"
                />
                {/* A distinct icon per choice, and the ring and weight change
                    with the selection — three signals, none of them colour
                    alone. */}
                <Icon
                  className="size-5"
                  strokeWidth={active ? 2 : 1.6}
                  aria-hidden="true"
                />
                <span className="text-sm leading-snug text-balance">
                  {label}
                </span>
              </label>
            )
          })}
        </div>
      </fieldset>

      {mode === 'custom' ? (
        <div className="mt-5 border-t border-border pt-5">
          <DelayStepper days={delayDays} onChange={setDelayDays} />
        </div>
      ) : null}
    </OnboardingShell>
  )
}
