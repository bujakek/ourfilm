'use client'

import { useOptimistic, useTransition } from 'react'

import { setReveal } from '@/app/(product)/host/events/[slug]/actions'
import { RevealSelector } from '@/components/host/reveal-selector'
import { useSettingsSave } from '@/components/host/settings-save'
import { HOST_PANEL, HOST_ROW_QUESTION } from '@/components/host/ui/classes'
import type { RevealChoice } from '@/lib/camera'

/**
 * When the album develops.
 *
 * Both choices are pinned to the capture window, and the database trigger
 * recomputes the instant whenever that window moves.
 *
 * Optimistic, like the roll length. It used to sit with the date cards, but
 * there is no date in it any more: two named choices, the selected one visible
 * at a glance, so showing the pick immediately cannot mislead. It saves on the
 * pick and falls back on its own if the action throws.
 */
export function RevealCard({
  slug,
  mode,
  locale,
}: {
  slug: string
  mode: RevealChoice
  locale: 'en' | 'hu'
}) {
  const en = locale === 'en'
  const [pending, startTransition] = useTransition()
  const { report } = useSettingsSave()
  const [optimisticMode, setOptimisticMode] = useOptimistic(mode)

  const apply = (next: RevealChoice) =>
    startTransition(async () => {
      setOptimisticMode(next)
      try {
        await setReveal(slug, next)
        report('ok', () => apply(next))
      } catch {
        report('error', () => apply(next))
      }
    })

  return (
    <section className={`${HOST_PANEL} p-5`}>
      <fieldset>
        <legend className={HOST_ROW_QUESTION}>
          {en ? 'When should photos appear?' : 'Mikor jelenjenek meg a képek?'}
        </legend>
        <div className="mt-3">
          <RevealSelector
            value={optimisticMode}
            onChange={(value) => {
              if (value !== optimisticMode) apply(value)
            }}
            name="reveal_mode_setting"
            locale={locale}
            disabled={pending}
          />
        </div>
      </fieldset>
    </section>
  )
}
