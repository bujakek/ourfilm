'use client'

import { useOptimistic, useTransition } from 'react'

import { setShotsPerParticipant } from '@/app/(product)/host/events/[slug]/actions'
import { useSettingsSave } from '@/components/host/settings-save'
import { ShotsSelector } from '@/components/host/shots-selector'
import {
  HOST_PANEL,
  HOST_ROW_DETAIL,
  HOST_ROW_QUESTION,
} from '@/components/host/ui/classes'
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
    <section className={`${HOST_PANEL} p-5`}>
      <fieldset>
        <legend className={HOST_ROW_QUESTION}>
          {en ? 'Photos per guest' : 'Képek vendégenként'}
        </legend>
        <p className={HOST_ROW_DETAIL}>
          {en
            ? 'Lowering it never deletes photos already taken.'
            : 'A csökkentés nem töröl képeket: aki már többet készített, megtartja őket.'}
        </p>
        <div className="mt-3">
          <ShotsSelector
            value={optimisticShots}
            onChange={apply}
            name="shots_setting"
            locale={locale}
            disabled={pending}
          />
        </div>
      </fieldset>
    </section>
  )
}
