'use client'

import { Minus, Plus } from 'lucide-react'

import {
  MAX_REVEAL_DELAY_DAYS,
  MIN_REVEAL_DELAY_DAYS,
  formatDelayDays,
} from '@/lib/onboarding'

/**
 * `−  1 nap  +`, for the delayed reveal.
 *
 * Days rather than hours: a host choosing "later" means the morning after or
 * next weekend, and an hours stepper needs eighteen taps to say either. The
 * value is announced through a real `aria-valuenow` on the group, so the same
 * number a sighted host reads between the buttons is the one a screen reader
 * hears when either is pressed.
 */
export function DelayStepper({
  days,
  onChange,
}: {
  days: number
  onChange: (days: number) => void
}) {
  return (
    <div
      role="group"
      aria-label="Késleltetés az esemény vége után"
      className="flex items-center justify-center gap-5"
    >
      <button
        type="button"
        onClick={() => onChange(days - 1)}
        disabled={days <= MIN_REVEAL_DELAY_DAYS}
        aria-label="Egy nappal kevesebb"
        className="glass flex size-12 items-center justify-center rounded-[0.875rem] disabled:opacity-30"
      >
        <Minus className="size-5" aria-hidden="true" />
      </button>

      <output className="min-w-24 text-center text-lg font-semibold tabular-nums">
        {formatDelayDays(days)}
      </output>

      <button
        type="button"
        onClick={() => onChange(days + 1)}
        disabled={days >= MAX_REVEAL_DELAY_DAYS}
        aria-label="Egy nappal több"
        className="glass flex size-12 items-center justify-center rounded-[0.875rem] disabled:opacity-30"
      >
        <Plus className="size-5" aria-hidden="true" />
      </button>
    </div>
  )
}
