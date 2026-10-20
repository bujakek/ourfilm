'use client'

import { useOptimistic, useTransition } from 'react'

import { setShotsPerParticipant } from '@/app/(product)/host/events/[slug]/actions'
import { useSettingsSave } from '@/components/host/settings-save'
import { ShotsSelector } from '@/components/host/shots-selector'
import type { ShotOption } from '@/lib/camera'

/**
 * How many frames each guest gets.
 *
 * Optimistic, unlike the capture-end card: this is a five-way choice where the
 * selected value is visible at a glance, so showing it immediately cannot
 * mislead the way a half-saved timestamp would. It falls back on its own if the
 * action throws, and the header's toast offers to send the same choice again.
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
  const { report } = useSettingsSave()
  const [optimisticShots, setOptimisticShots] = useOptimistic(shots)

  const apply = (option: ShotOption) =>
    startTransition(async () => {
      setOptimisticShots(option)
      try {
        await setShotsPerParticipant(slug, option)
        report('ok', () => apply(option))
      } catch {
        report('error', () => apply(option))
      }
    })

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
          onChange={apply}
          name="shots_setting"
          locale={locale}
          disabled={pending}
        />
      </fieldset>
    </div>
  )
}
