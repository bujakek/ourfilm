'use client'

import { Check } from 'lucide-react'
import { useOptimistic, useState, useTransition } from 'react'

import { setShotsPerParticipant } from '@/app/admin/events/[slug]/actions'
import { DEFAULT_SHOTS, SHOT_OPTIONS, type ShotOption } from '@/lib/camera'

/**
 * How many frames each guest gets.
 *
 * Optimistic, unlike the two date cards: this is a five-way choice where the
 * selected value is visible at a glance, so showing it immediately cannot
 * mislead the way a half-saved timestamp would. It falls back on its own if the
 * action throws.
 *
 * Lowering it deletes nothing. A guest who already shot more than the new limit
 * keeps every photo and simply cannot take another — the copy says so, because
 * "will this delete my guests' photos?" is the obvious fear when dragging a
 * number down mid-event.
 */
export function ShotsCard({
  slug,
  shots,
}: {
  slug: string
  shots: ShotOption
}) {
  const [pending, startTransition] = useTransition()
  const [error, setError] = useState(false)
  const [optimisticShots, setOptimisticShots] = useOptimistic(shots)

  return (
    <div className="glass rounded-2xl px-5 py-4">
      <p className="font-medium">Képek vendégenként</p>
      <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
        A limit minden vendégnél külön számít. A csökkentés nem töröl képeket —
        aki már többet készített, megtartja őket, de újat nem tud.
      </p>

      <fieldset className="mt-4">
        <legend className="sr-only">Képek száma vendégenként</legend>
        <div className="grid grid-cols-5 gap-2">
          {SHOT_OPTIONS.map((option) => {
            const active = option === optimisticShots
            return (
              <label
                key={option}
                className={`glass flex min-h-16 cursor-pointer flex-col items-center justify-center rounded-xl ${
                  active ? 'border-accent' : ''
                } ${pending ? 'opacity-70' : ''}`}
              >
                <input
                  type="radio"
                  name="shots_setting"
                  value={option}
                  checked={active}
                  disabled={pending}
                  onChange={() =>
                    startTransition(async () => {
                      setError(false)
                      setOptimisticShots(option)
                      try {
                        await setShotsPerParticipant(slug, option)
                      } catch {
                        setError(true)
                      }
                    })
                  }
                  className="sr-only"
                />
                {/* The check mark carries the selection alongside the border,
                    so the choice is not signalled by colour alone. */}
                <span className="flex items-center gap-1 text-base font-semibold">
                  {active ? (
                    <Check className="size-3.5 text-accent" strokeWidth={2.4} />
                  ) : null}
                  {option}
                </span>
                {option === DEFAULT_SHOTS ? (
                  <span className="mt-0.5 text-[10px] text-accent">
                    Ajánlott
                  </span>
                ) : null}
              </label>
            )
          })}
        </div>
      </fieldset>

      {error ? (
        <p className="mt-2 text-xs text-destructive">
          Nem sikerült módosítani.
        </p>
      ) : null}
    </div>
  )
}
