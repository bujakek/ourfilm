'use client'

import { useOptimistic, useTransition } from 'react'

import { setReveal } from '@/app/(product)/host/events/[slug]/actions'
import { RevealSelector } from '@/components/host/reveal-selector'
import { useSettingsSave } from '@/components/host/settings-save'
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
    <div className="glass rounded-2xl px-5 py-4">
      <p className="font-medium">{en ? 'Photo reveal' : 'Képek megjelenése'}</p>

      <fieldset className="mt-4">
        <legend className="sr-only">
          {en ? 'Photo reveal time' : 'Leleplezés időpontja'}
        </legend>
        <RevealSelector
          value={optimisticMode}
          onChange={(value) => {
            if (value !== optimisticMode) apply(value)
          }}
          name="reveal_mode_setting"
          locale={locale}
          disabled={pending}
        />
      </fieldset>
    </div>
  )
}
