'use client'

import { useOptimistic, useRef, useState, useTransition } from 'react'

import { setReveal } from '@/app/(product)/host/events/[slug]/actions'
import { RevealSelector } from '@/components/host/reveal-selector'
import { useSettingsSave } from '@/components/host/settings-save'
import {
  HOST_PANEL,
  HOST_PRIMARY,
  HOST_ROW_QUESTION,
  HOST_SECONDARY,
} from '@/components/host/ui/classes'
import type { RevealChoice } from '@/lib/camera'
import { revealChoiceCommit } from '@/lib/host-ui'

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
 *
 * **Except the one pick that cannot be taken back.** "Azonnal" while the album
 * is still closed opens it to every guest the moment it lands, and a native
 * radio changes on an arrow key. So that pick asks first, inline
 * (`revealChoiceCommit`): the row shows as chosen, nothing is sent, and
 * "Mégsem" puts the selection back. Moving to the event end, or to "Azonnal"
 * once the album is open anyway, saves at once.
 */
export function RevealCard({
  slug,
  mode,
  eventEndRevealAt,
  locale,
}: {
  slug: string
  mode: RevealChoice
  /** When the album opens if it is not "instant", as an ISO instant. */
  eventEndRevealAt: string
  locale: 'en' | 'hu'
}) {
  const en = locale === 'en'
  const [pending, startTransition] = useTransition()
  const { report } = useSettingsSave()
  const [optimisticMode, setOptimisticMode] = useOptimistic(mode)
  const [confirming, setConfirming] = useState(false)
  const section = useRef<HTMLElement>(null)
  const legend = useRef<HTMLLegendElement>(null)
  // The confirm's buttons leave the page when either is pressed, so focus
  // has to land somewhere. Cancel puts it back on the radio that holds the
  // choice; "Megnyitás most" cannot, because the radios disable while the
  // save is pending and a disabled control drops focus, so it goes to the
  // question instead.
  const focusChoice = (choice: RevealChoice) =>
    section.current
      ?.querySelector<HTMLInputElement>(`input[value="${choice}"]`)
      ?.focus()

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
    <section ref={section} className={`${HOST_PANEL} p-5`}>
      <fieldset>
        <legend
          ref={legend}
          tabIndex={-1}
          className={`${HOST_ROW_QUESTION} outline-none`}
        >
          {en ? 'When should photos appear?' : 'Mikor jelenjenek meg a képek?'}
        </legend>
        <div className="mt-3">
          <RevealSelector
            value={confirming ? 'instant' : optimisticMode}
            onChange={(value) => {
              const decision = revealChoiceCommit({
                from: optimisticMode,
                to: value,
                revealAt: new Date(eventEndRevealAt),
                now: new Date(),
              })
              setConfirming(decision === 'confirm')
              if (decision === 'save') apply(value)
            }}
            name="reveal_mode_setting"
            locale={locale}
            disabled={pending}
          />
        </div>
      </fieldset>

      {/* Always mounted, so the question is announced when it appears. */}
      <div aria-live="polite">
        {confirming ? (
          <div className="mt-4">
            <p className="text-[15px] leading-[1.5] text-pretty text-white">
              {en
                ? 'Every guest will see the photos right away. Open the album?'
                : 'Most rögtön látható lesz minden vendégnek. Megnyitod?'}
            </p>
            <div className="mt-3 flex flex-col gap-2 sm:flex-row">
              <button
                type="button"
                onClick={() => {
                  setConfirming(false)
                  apply('instant')
                  legend.current?.focus()
                }}
                className={`${HOST_PRIMARY} w-full sm:flex-1`}
              >
                {en ? 'Open now' : 'Megnyitás most'}
              </button>
              <button
                type="button"
                onClick={() => {
                  setConfirming(false)
                  focusChoice(optimisticMode)
                }}
                className={`${HOST_SECONDARY} w-full sm:flex-1`}
              >
                {en ? 'Cancel' : 'Mégsem'}
              </button>
            </div>
          </div>
        ) : null}
      </div>
    </section>
  )
}
