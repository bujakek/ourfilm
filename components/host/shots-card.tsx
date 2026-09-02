'use client'

import { useOptimistic, useState, useTransition } from 'react'

import { setShotsPerParticipant } from '@/app/(product)/host/events/[slug]/actions'
import { ShotsSelector } from '@/components/host/shots-selector'
import type { ShotOption } from '@/lib/camera'

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
  locale,
}: {
  slug: string
  shots: ShotOption
  locale: 'en' | 'hu'
}) {
  const en = locale === 'en'
  const [pending, startTransition] = useTransition()
  const [error, setError] = useState(false)
  const [optimisticShots, setOptimisticShots] = useOptimistic(shots)

  return (
    <div className="glass rounded-2xl px-5 py-4">
      <p className="font-medium">
        {en ? 'Photos per guest' : 'Képek vendégenként'}
      </p>
      <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
        {en
          ? 'The limit applies separately to each guest. Lowering it never deletes existing photos.'
          : 'A limit minden vendégnél külön számít. A csökkentés nem töröl képeket — aki már többet készített, megtartja őket, de újat nem tud.'}
      </p>

      <fieldset className="mt-4">
        <legend className="sr-only">
          {en ? 'Photos per guest' : 'Képek száma vendégenként'}
        </legend>
        <ShotsSelector
          value={optimisticShots}
          onChange={(option) =>
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
          name="shots_setting"
          locale={locale}
          disabled={pending}
        />
      </fieldset>

      {error ? (
        <p className="mt-2 text-xs text-destructive">
          {en ? 'Could not save changes.' : 'Nem sikerült módosítani.'}
        </p>
      ) : null}
    </div>
  )
}
