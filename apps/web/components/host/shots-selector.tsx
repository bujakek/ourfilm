'use client'

import { HOST_TILE } from '@/components/host/ui/classes'
import { SHOT_OPTIONS, type ShotOption } from '@/lib/camera'
import type { Locale } from '@/lib/i18n'

/**
 * The roll length, as a row of chips.
 *
 * Five tiles sharing the width, the numerals in the figure face. The selected
 * one is white: a current choice among equals, which white carries on host
 * screens, while sky is kept for payment and live state.
 */
export function ShotsSelector({
  value,
  onChange,
  name,
  locale,
  disabled = false,
}: {
  value: ShotOption
  onChange: (value: ShotOption) => void
  name: string
  locale: Locale
  disabled?: boolean
}) {
  return (
    <div
      role="radiogroup"
      aria-label={locale === 'en' ? 'Shots per guest' : 'Képek vendégenként'}
      className={`flex gap-2 ${disabled ? 'cursor-not-allowed opacity-60' : ''}`}
    >
      {SHOT_OPTIONS.map((option) => {
        const active = option === value
        return (
          <label
            key={option}
            className={`flex min-h-12 min-w-0 flex-1 cursor-pointer items-center justify-center transition-colors has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-white/60 ${
              active
                ? 'rounded-[20px] bg-white text-landing-ink'
                : `${HOST_TILE} text-white hover:bg-white/8`
            } ${disabled ? 'cursor-not-allowed' : ''}`}
          >
            <input
              type="radio"
              name={name}
              value={option}
              checked={active}
              disabled={disabled}
              onChange={() => onChange(option)}
              className="sr-only"
            />
            <span className="host-figure text-[24px] leading-none">
              {option}
            </span>
          </label>
        )
      })}
    </div>
  )
}
