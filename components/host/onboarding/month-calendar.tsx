'use client'

import { ChevronLeft, ChevronRight } from 'lucide-react'
import { useState } from 'react'

import {
  formatHuCalendarDay,
  formatHuMonthYear,
  HU_WEEKDAYS_SHORT,
} from '@/lib/format'

/** A `YYYY-MM-DD` day, built from a UTC instant. The grid is a calendar rather
 *  than a clock: every date in it is a bare day with no zone to get wrong, so
 *  the arithmetic runs in UTC and the zone question is settled once, by whoever
 *  hands in `today`. */
function toDay(date: Date): string {
  return date.toISOString().slice(0, 10)
}

function monthOf(day: string): { year: number; month: number } {
  const [year, month] = day.split('-').map(Number)
  return { year, month: month - 1 }
}

/** The 42 cells of a month grid, Monday-first, including the neighbouring
 *  month's days that pad the first and last rows. Always six rows: a grid that
 *  changes height between months makes everything under it jump. */
function monthGrid(year: number, month: number): Date[] {
  const first = new Date(Date.UTC(year, month, 1))
  // getUTCDay is Sunday-first; Hungarian weeks start on Monday.
  const lead = (first.getUTCDay() + 6) % 7
  return Array.from(
    { length: 42 },
    (_, i) => new Date(Date.UTC(year, month, 1 - lead + i)),
  )
}

/**
 * The whole month, as the screen's one interactive element.
 *
 * Two `datetime-local` inputs would have been a quarter of this code and a
 * worse question: the host is picking the evening their party ends, and a
 * calendar shows them which day of the week that is without a second tap.
 *
 * No library. A month grid is date arithmetic and a `<table>`-shaped list, and
 * the smallest React date picker on npm is larger than this file.
 */
export function MonthCalendar({
  value,
  today,
  onChange,
}: {
  /** The selected day, `YYYY-MM-DD`. */
  value: string
  /** The earliest selectable day, `YYYY-MM-DD` — the host's today. */
  today: string
  onChange: (day: string) => void
}) {
  const [visible, setVisible] = useState(() => monthOf(value))

  const cells = monthGrid(visible.year, visible.month)
  const heading = formatHuMonthYear(visible.year, visible.month)

  // Nothing before today can be chosen, so a month entirely in the past holds
  // nothing to go back to. Day 0 of the visible month is the last day of the
  // one before it — the only day that decides this.
  const canGoBack =
    toDay(new Date(Date.UTC(visible.year, visible.month, 0))) >= today

  const step = (delta: number) =>
    setVisible(({ year, month }) => {
      const moved = new Date(Date.UTC(year, month + delta, 1))
      return { year: moved.getUTCFullYear(), month: moved.getUTCMonth() }
    })

  return (
    <section aria-label="Az esemény vége">
      <header className="flex items-center justify-between">
        <button
          type="button"
          onClick={() => step(-1)}
          disabled={!canGoBack}
          aria-label="Előző hónap"
          className="flex size-11 items-center justify-center rounded-[0.85rem] text-muted-foreground transition-colors hover:text-foreground disabled:opacity-25"
        >
          <ChevronLeft className="size-5" aria-hidden="true" />
        </button>
        {/* aria-live so a screen reader hears the month change: the arrows move
            focus nowhere, so nothing else would announce it. */}
        <h2 aria-live="polite" className="font-display text-lg font-medium">
          {heading}
        </h2>
        <button
          type="button"
          onClick={() => step(1)}
          aria-label="Következő hónap"
          className="flex size-11 items-center justify-center rounded-[0.85rem] text-muted-foreground transition-colors hover:text-foreground"
        >
          <ChevronRight className="size-5" aria-hidden="true" />
        </button>
      </header>

      <div
        aria-hidden="true"
        className="mt-3 grid grid-cols-7 text-center text-xs text-muted-foreground/70"
      >
        {HU_WEEKDAYS_SHORT.map((label) => (
          <span key={label}>{label}</span>
        ))}
      </div>

      <ul className="mt-1 grid grid-cols-7">
        {cells.map((date) => {
          const day = toDay(date)
          const outside = date.getUTCMonth() !== visible.month
          const past = day < today
          const selected = day === value

          return (
            <li key={day} className="flex justify-center py-0.5">
              <button
                type="button"
                disabled={past}
                aria-pressed={selected}
                aria-label={formatHuCalendarDay(day)}
                onClick={() => {
                  onChange(day)
                  // Tapping into a neighbouring month brings the month with it,
                  // so the selection stays on screen instead of vanishing into
                  // a grid the host still has to scroll to.
                  if (outside) setVisible(monthOf(day))
                }}
                className={[
                  // An explicit radius, not `rounded-xl`: this project rebinds
                  // the whole scale (`--radius-xl` is 1.5rem), which on a 44px
                  // cell rounds it into a circle. The selected day is a
                  // squircle, and that shape is one of the two signals.
                  'flex size-11 items-center justify-center rounded-[0.85rem] text-base transition-colors',
                  // Two signals, not one: the selected day is the only cell
                  // wearing a ring, so the choice survives a colourblind reader
                  // and a phone in bright sun.
                  selected
                    ? 'bg-accent/10 font-semibold text-accent ring-2 ring-accent'
                    : past
                      ? 'text-muted-foreground/25'
                      : outside
                        ? 'text-muted-foreground/40'
                        : 'text-foreground',
                ].join(' ')}
              >
                {date.getUTCDate()}
              </button>
            </li>
          )
        })}
      </ul>
    </section>
  )
}
