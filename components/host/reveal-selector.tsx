'use client'

import { Clock, Hourglass } from 'lucide-react'
import { motion, useReducedMotion } from 'motion/react'

import type { RevealChoice } from '@/lib/camera'
import type { Locale } from '@/lib/i18n'

export function RevealSelector({
  value,
  onChange,
  name,
  locale,
  disabled = false,
}: {
  value: RevealChoice
  onChange: (value: RevealChoice) => void
  name: string
  locale: Locale
  disabled?: boolean
}) {
  const reduceMotion = useReducedMotion()
  const en = locale === 'en'
  const choices = [
    {
      value: 'instant' as const,
      label: en ? 'Right away' : 'Azonnal',
      detail: en
        ? 'Photos appear while the event is happening.'
        : 'A képek már az esemény alatt megjelennek.',
      Icon: Hourglass,
    },
    {
      value: 'event_end' as const,
      label: en ? 'When the event ends' : 'Az esemény végén',
      detail: en
        ? 'The gallery opens when shooting ends.'
        : 'A galéria a fotózás végén nyílik meg.',
      Icon: Clock,
    },
  ]

  return (
    <div className="grid grid-cols-2 gap-2.5">
      {choices.map(({ value: choice, label, detail, Icon }) => {
        const active = choice === value
        return (
          <label
            key={choice}
            className={`glass relative flex min-h-28 cursor-pointer flex-col justify-between overflow-hidden rounded-control-lg p-3.5 has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-accent ${
              active ? 'text-accent' : ''
            } ${disabled ? 'cursor-not-allowed opacity-50' : ''}`}
          >
            {active ? (
              <motion.span
                layoutId={`${name}-selection`}
                aria-hidden="true"
                className="absolute inset-0 rounded-control-lg bg-accent/10 ring-2 ring-accent ring-inset"
                transition={
                  reduceMotion
                    ? { duration: 0 }
                    : { type: 'spring', stiffness: 480, damping: 38 }
                }
              />
            ) : null}
            <input
              type="radio"
              name={name}
              value={choice}
              checked={active}
              disabled={disabled}
              onChange={() => onChange(choice)}
              className="sr-only"
            />
            <Icon
              className="relative z-10 size-5"
              strokeWidth={active ? 2 : 1.6}
              aria-hidden="true"
            />
            <span className="relative z-10">
              <span className="block text-sm leading-snug font-semibold text-balance">
                {label}
              </span>
              <span
                className={`mt-1 block text-[0.6875rem] leading-relaxed ${
                  active ? 'text-accent/80' : 'text-muted-foreground'
                }`}
              >
                {detail}
              </span>
            </span>
          </label>
        )
      })}
    </div>
  )
}
