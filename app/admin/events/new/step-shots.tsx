'use client'

import { Check } from 'lucide-react'

import {
  OnboardingShell,
  type OnboardingNav,
} from '@/components/admin/onboarding/onboarding-shell'
import { DEFAULT_SHOTS, SHOT_OPTIONS, type ShotOption } from '@/lib/camera'

/**
 * Question four: how long is everybody's roll?
 *
 * The five values and their meaning are unchanged — this step was already
 * settled, and only its frame moved into the shared shell. There is
 * deliberately no unlimited option: the scarcity is the product.
 */
export function StepShots({
  nav,
  shots,
  setShots,
  pending,
}: {
  nav: OnboardingNav
  shots: ShotOption
  setShots: (value: ShotOption) => void
  pending: boolean
}) {
  return (
    <OnboardingShell
      {...nav}
      title="Hány képet készíthet egy vendég?"
      detail="Minden résztvevő ugyanennyi felvételt kap, és nincs újrafotózás."
      // Short on purpose: the progress dots are centred on the screen behind
      // this button, and a wide label sits on top of the last one.
      cta="Kész"
      ctaPending={pending}
      submit
    >
      {/* The centring lives on a plain div, not on the fieldset: a fieldset's
          intrinsic sizing ignores `flex-1`, so the tiles pinned to the top of a
          full-height box with the whole screen empty below them. */}
      <div className="flex flex-1 flex-col justify-center">
        <fieldset>
          <legend className="sr-only">Képek száma vendégenként</legend>
          {/* Five tiles in a three-wide grid leaves a hole; wrapping and centring
            puts three over two, which reads as a deliberate shape. */}
          <div className="flex flex-wrap justify-center gap-3">
            {SHOT_OPTIONS.map((option) => {
              const active = option === shots
              return (
                <label
                  key={option}
                  // Same as the reveal cards: the radio is sr-only, so the
                  // focus ring is moved out onto the tile with `has-`.
                  className={`glass flex min-h-24 w-[calc(33.333%-0.5rem)] cursor-pointer flex-col items-center justify-center gap-1 rounded-[1.25rem] transition-colors has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-accent ${
                    active ? 'bg-accent/10 text-accent ring-2 ring-accent' : ''
                  }`}
                >
                  <input
                    type="radio"
                    name="shots_choice"
                    value={option}
                    checked={active}
                    onChange={() => setShots(option)}
                    className="sr-only"
                  />
                  {/* The check mark carries the selection alongside the ring, so
                    the choice is not signalled by colour alone. */}
                  <span className="flex items-center gap-1.5 text-2xl font-semibold">
                    {active ? (
                      <Check
                        className="size-5"
                        strokeWidth={2.4}
                        aria-hidden="true"
                      />
                    ) : null}
                    {option}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {option === DEFAULT_SHOTS ? 'ajánlott' : 'kép'}
                  </span>
                </label>
              )
            })}
          </div>
        </fieldset>
      </div>
    </OnboardingShell>
  )
}
