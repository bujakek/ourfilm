'use client'

import { Check } from 'lucide-react'
import { motion, useReducedMotion } from 'motion/react'

import { DEFAULT_SHOTS, SHOT_OPTIONS, type ShotOption } from '@/lib/camera'
import type { Locale } from '@/lib/i18n'

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
  const en = locale === 'en'

  return (
    <div className="grid grid-cols-5 gap-2">
      {SHOT_OPTIONS.map((option) => {
        const active = option === value
        return (
          <label
            key={option}
            className={`glass relative flex min-h-16 cursor-pointer flex-col items-center justify-center overflow-hidden rounded-lg has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-accent ${pendingClass(
              disabled,
            )} ${active ? 'text-accent' : ''}`}
          >
            {active ? (
              <motion.span
                layoutId={`${name}-selection`}
                aria-hidden="true"
                className="absolute inset-0 rounded-lg bg-accent/10 ring-2 ring-accent ring-inset"
                transition={
                  reduceMotion
                    ? { duration: 0 }
                    : { type: 'spring', stiffness: 520, damping: 38 }
                }
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
            <span className="relative z-10 flex items-center gap-1 text-base font-semibold">
              {active ? (
                <Check
                  className="size-3.5"
                  strokeWidth={2.4}
                  aria-hidden="true"
                />
              ) : null}
              {option}
            </span>
            {option === DEFAULT_SHOTS ? (
              <span className="relative z-10 mt-0.5 text-[9px] leading-none text-accent">
                {en ? 'Recommended' : 'Ajánlott'}
              </span>
            ) : null}
          </label>
        )
      })}
    </div>
  )
}

function pendingClass(disabled: boolean): string {
  return disabled ? 'cursor-not-allowed opacity-50' : ''
}
