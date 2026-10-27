'use client'

import { ChevronDown } from 'lucide-react'
import { useRef } from 'react'

import { HOST_KICKER_BASE } from '@/components/host/ui/classes'
import { formatEventDate } from '@/lib/format'
import type { Locale } from '@/lib/i18n'

/**
 * The end of the event as two tiles, both opening the phone's own picker.
 *
 * The time is the browser's `type="time"` as it stands — a fixed-width `HH:mm`
 * that lies flat. The day is a native `type="date"` too, but laid invisibly
 * over a tile that draws the date itself. A visible one cannot be used: iOS
 * draws a native date control from a shadow tree that ignores the box it sits
 * in, so it ran off the side of the phone, and `min-width`, `max-width` and
 * `box-sizing` all act on a box that tree never consults. Transparent,
 * absolutely placed and clipped by the tile, its width no longer matters; a
 * tap on the tile is a tap on the input, which is what opens the picker on a
 * phone. Desktop browsers open theirs from a click only on their own icon, so
 * the click also asks for `showPicker()`.
 */

/** A typed key this recently means the date is being typed, segment by
 *  segment, rather than picked: wait for the blur. */
const TYPING_MS = 1000
export function EventEndFields({
  day,
  time,
  minDay,
  onDayChange,
  onTimeChange,
  locale,
  timeLabel,
  onTimeCommit,
  timeStep = 60,
  error = false,
  labels,
}: {
  day: string
  time: string
  /** The earliest day the picker offers, `YYYY-MM-DD`. Anything earlier that
   *  arrives anyway (an old iOS ignores `min`) is dropped here. */
  minDay: string
  /**
   * A whole day was chosen. Called at once for a pick from the picker; for a
   * day typed in on a keyboard, only when the field is left or Enter is
   * pressed, because desktop Chrome reports a complete date after every
   * segment — `0002-…`, `0020-…` — on the way to the one being typed.
   */
  onDayChange: (day: string) => void
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
  /** 7e: the server refused the value; both tiles are outlined. */
  error?: boolean
  /** Small labels over the two values. Onboarding (6b) names them "Nap" and
   *  "Idő"; settings sits under its own question and leaves them out. */
  labels?: { day: string; time: string }
}) {
  const en = locale === 'en'

  const outline = error ? 'ring-[1.5px] ring-host-danger ring-inset' : ''
  const label = `${HOST_KICKER_BASE} block text-white/65`
  const typedAt = useRef(0)

  // A day the picker should not have offered, or the iOS "Clear" button's
  // empty value, is not an answer; the tile keeps showing the last one.
  const accept = (value: string) => {
    if (value && value >= minDay && value !== day) onDayChange(value)
  }

  return (
    <div className="flex gap-2">
      <label
        className={`relative flex min-h-[52px] min-w-0 flex-[1.5] cursor-pointer items-center justify-between gap-2 overflow-hidden rounded-[14px] bg-host-tile px-4 py-2 text-[15px] font-medium text-white transition-colors hover:bg-white/8 has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-white/60 ${outline}`}
      >
        <span aria-hidden="true" className="min-w-0 text-balance">
          {labels ? (
            <span className={`${label} mb-1`}>{labels.day}</span>
          ) : null}
          {formatEventDate(day, locale)}
        </span>
        <ChevronDown
          className="size-4 shrink-0 text-white/65"
          aria-hidden="true"
        />
        <input
          type="date"
          required
          min={minDay}
          value={day}
          aria-label={`${en ? 'Date' : 'Dátum'}: ${formatEventDate(day, locale)}`}
          aria-invalid={error || undefined}
          onClick={(event) => {
            try {
              event.currentTarget.showPicker()
            } catch {
              // Not offered here, or already open; the tap still focused it.
            }
          }}
          onKeyDown={(event) => {
            if (event.key === 'Enter') {
              event.preventDefault()
              accept(event.currentTarget.value)
              return
            }
            typedAt.current = Date.now()
          }}
          onChange={(event) => {
            if (Date.now() - typedAt.current < TYPING_MS) return
            accept(event.target.value)
          }}
          onBlur={(event) => accept(event.target.value)}
          // Covers the tile and is drawn by nothing: the text above is what
          // shows, and the tile draws the focus ring (`has-[:focus-visible]`).
          className="absolute inset-0 size-full cursor-pointer appearance-none [color-scheme:dark] opacity-0"
        />
      </label>

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
          // The tile around it draws the white ring (`has-[:focus-visible]`), so
          // the field itself shows no outline of its own.
          className="min-h-11 w-full min-w-0 bg-transparent text-[15px] font-medium text-white [color-scheme:dark] outline-none focus-visible:outline-none"
        />
      </label>
    </div>
  )
}
