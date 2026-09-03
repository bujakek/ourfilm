'use client'

import { motion, useReducedMotion } from 'motion/react'

import { SHOT_OPTIONS, type ShotOption } from '@/lib/camera'
import type { Locale } from '@/lib/i18n'
import { T, still } from '@/lib/motion'

/**
 * The roll length, as one control.
 *
 * It was five separate 64px tiles, each with its own border, fill and tick —
 * four borders too many for a five-way choice whose values are single numbers.
 * One segmented row divided by hairlines says the same thing and says it as a
 * scale, which is what a roll length is.
 *
 * The active cell is a solid lilac fill: this is a current selection, which is
 * one of the four things lilac is still allowed to mean. Numerals are in the
 * counting face.
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
  const reduceMotion = useReducedMotion()

  return (
    <div
      role="radiogroup"
      aria-label={locale === 'en' ? 'Shots per guest' : 'Képek vendégenként'}
      className={`flex overflow-hidden rounded-md border border-white/13 ${
        disabled ? 'cursor-not-allowed opacity-50' : ''
      }`}
    >
      {SHOT_OPTIONS.map((option, i) => {
        const active = option === value
        return (
          <label
            key={option}
            className={`relative flex min-h-11 flex-1 cursor-pointer items-center justify-center py-3.5 has-[:focus-visible]:outline-2 has-[:focus-visible]:-outline-offset-2 has-[:focus-visible]:outline-accent ${
              i < SHOT_OPTIONS.length - 1 ? 'border-r border-white/10' : ''
            } ${disabled ? 'cursor-not-allowed' : ''}`}
          >
            {active ? (
              // The fill slides between cells rather than blinking on, which is
              // what makes the row read as one control instead of five.
              <motion.span
                layoutId={`${name}-selection`}
                aria-hidden="true"
                className="absolute inset-0 bg-accent"
                transition={reduceMotion ? still : T.snap}
              />
            ) : null}
            <input
              type="radio"
              name={name}
              value={option}
              checked={active}
              disabled={disabled}
              onChange={() => onChange(option)}
              className="sr-only"
            />
            <span
              className={`relative z-10 font-mono text-[14px] ${
                active
                  ? 'font-medium text-accent-foreground'
                  : 'text-foreground/60'
              }`}
            >
              {option}
            </span>
          </label>
        )
      })}
    </div>
  )
}
