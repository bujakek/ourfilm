'use client'

import { ChevronDown } from 'lucide-react'

import { HOST_KICKER_BASE } from '@/components/host/ui/classes'
import { formatEventDate } from '@/lib/format'
import type { Locale } from '@/lib/i18n'

/**
 * The end of the event as two tiles: a day button and a native time field.
 *
 * The day is ours, because iOS draws a native date control from a shadow tree
 * that ignores the box it sits in. The time is the browser's own
 * `type="time"` — a fixed-width `HH:mm` that lies flat — with no custom
 * stepper beside it.
 */
export function EventEndFields({
  day,
  time,
  onChooseDay,
  onTimeChange,
  locale,
  timeLabel,
  onTimeCommit,
  timeStep = 60,
  dayExpanded,
  error = false,
  labels,
}: {
  day: string
  time: string
  onChooseDay: () => void
  onTimeChange: (time: string) => void
  locale: Locale
  timeLabel: string
  /**
   * The host is done with the time: the field lost focus, or Enter was
   * pressed. Not the native `change` event, which desktop Chrome fires as each
   * segment completes — and an in-between value in the past would close the
   * camera early, since a past end after the start is allowed on purpose.
   */
  onTimeCommit?: (time: string) => void
  /** Seconds. Settings asks for 900, a quarter-hour. */
  timeStep?: number
  /** Set when the day button opens a panel rather than a dialog. */
  dayExpanded?: boolean
  /** 7e: the server refused the value; both tiles are outlined. */
  error?: boolean
  /** Small labels over the two values. Onboarding (6b) names them "Nap" and
   *  "Idő"; settings sits under its own question and leaves them out. */
  labels?: { day: string; time: string }
}) {
  const en = locale === 'en'

  const outline = error ? 'ring-[1.5px] ring-host-danger ring-inset' : ''
  const label = `${HOST_KICKER_BASE} block text-white/65`

  return (
    <div className="flex gap-2">
      <button
        type="button"
        onClick={onChooseDay}
        aria-expanded={dayExpanded}
        aria-label={`${en ? 'Date' : 'Dátum'}: ${formatEventDate(day, locale)}`}
        className={`flex min-h-[52px] min-w-0 flex-[1.5] items-center justify-between gap-2 rounded-[14px] bg-host-tile px-4 py-2 text-left text-[15px] font-medium text-white transition-colors hover:bg-white/8 focus-visible:ring-2 focus-visible:ring-white/60 focus-visible:outline-none ${outline}`}
      >
        <span className="min-w-0 text-balance">
          {labels ? (
            <span aria-hidden="true" className={`${label} mb-1`}>
              {labels.day}
            </span>
          ) : null}
          {formatEventDate(day, locale)}
        </span>
        <ChevronDown
          className={`size-4 shrink-0 text-white/65 transition-transform ${
            dayExpanded ? 'rotate-180' : ''
          }`}
          aria-hidden="true"
        />
      </button>

      <label
        className={`flex min-h-[52px] min-w-0 flex-1 cursor-pointer rounded-[14px] bg-host-tile px-4 has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-white/60 ${
          labels ? 'flex-col justify-center py-2' : 'items-center'
        } ${outline}`}
      >
        {labels ? (
          <span aria-hidden="true" className={label}>
            {labels.time}
          </span>
        ) : null}
        <input
          type="time"
          step={timeStep}
          required
          aria-label={timeLabel}
          aria-invalid={error || undefined}
          value={time}
          onChange={(event) => onTimeChange(event.target.value)}
          onBlur={(event) => {
            if (event.target.value) onTimeCommit?.(event.target.value)
          }}
          onKeyDown={(event) => {
            // Enter commits through blur, so one save goes out either way.
            if (event.key === 'Enter' && onTimeCommit) {
              event.preventDefault()
              event.currentTarget.blur()
            }
          }}
          className="min-h-11 w-full min-w-0 bg-transparent text-[15px] font-medium text-white [color-scheme:dark] outline-none"
        />
      </label>
    </div>
  )
}
