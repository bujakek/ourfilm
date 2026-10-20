'use client'

import { ChevronLeft, ChevronRight } from 'lucide-react'
import { useState } from 'react'

import { HOST_FOCUS } from '@/components/host/ui/classes'
import type { Locale } from '@/lib/i18n'

import {
  formatHuCalendarDay,
  formatHuMonthYear,
  HU_WEEKDAYS_SHORT,
} from '@/lib/format'

/** A `YYYY-MM-DD` day, built from a UTC instant. The grid is a calendar rather
 *  than a clock: every date in it is a bare day with no zone to get wrong, so
 *  the arithmetic runs in UTC and the zone question is settled once, by whoever
 *  hands in `earliest`. */
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
  earliest,
  onChange,
  label,
  locale = 'hu',
}: {
  /** The selected day, `YYYY-MM-DD`. */
  value: string
  /** The earliest selectable day, `YYYY-MM-DD`. Not always today: the create
   *  flow's floor is the host's today, and the settings card's is the day the
   *  event started, because moving the end into the past is how a host closes a
   *  camera early. */
  earliest: string
  onChange: (day: string) => void
  /** Names the region for a screen reader. Two callers ask the same question in
   *  different words. */
  label: string
  locale?: Locale
}) {
  const [visible, setVisible] = useState(() => monthOf(value))

  const cells = monthGrid(visible.year, visible.month)
  const heading =
    locale === 'en'
      ? new Intl.DateTimeFormat('en-GB', {
          month: 'long',
          year: 'numeric',
          timeZone: 'UTC',
        }).format(new Date(Date.UTC(visible.year, visible.month, 1)))
      : formatHuMonthYear(visible.year, visible.month)
  const weekdays =
    locale === 'en' ? ['M', 'T', 'W', 'T', 'F', 'S', 'S'] : HU_WEEKDAYS_SHORT

  // Nothing before `earliest` can be chosen, so a month entirely before it
  // holds nothing to go back to. Day 0 of the visible month is the last day of
  // the one before it — the only day that decides this.
  const canGoBack =
    toDay(new Date(Date.UTC(visible.year, visible.month, 0))) >= earliest

  // The day a panel opening this calendar focuses (`FloatingPanel`): the
  // selected one, or the first that can be chosen when it cannot.
  const focusDay =
    value >= earliest && cells.some((date) => toDay(date) === value)
      ? value
      : cells.map(toDay).find((day) => day >= earliest)

  const step = (delta: number) =>
    setVisible(({ year, month }) => {
      const moved = new Date(Date.UTC(year, month + delta, 1))
      return { year: moved.getUTCFullYear(), month: moved.getUTCMonth() }
    })

  return (
    <section aria-label={label}>
      <header className="flex items-center justify-between">
        <button
          type="button"
          onClick={() => step(-1)}
          disabled={!canGoBack}
          aria-label={locale === 'en' ? 'Previous month' : 'Előző hónap'}
          className={`flex size-11 items-center justify-center rounded-[12px] text-white/65 transition-colors hover:text-white disabled:opacity-40 ${HOST_FOCUS}`}
        >
          <ChevronLeft className="size-5" aria-hidden="true" />
        </button>
        {/* aria-live so a screen reader hears the month change: the arrows move
            focus nowhere, so nothing else would announce it. */}
        <h2
          aria-live="polite"
          className="text-[13px] font-medium text-white/65"
        >
          {heading}
        </h2>
        <button
          type="button"
          onClick={() => step(1)}
          aria-label={locale === 'en' ? 'Next month' : 'Következő hónap'}
          className={`flex size-11 items-center justify-center rounded-[12px] text-white/65 transition-colors hover:text-white ${HOST_FOCUS}`}
        >
          <ChevronRight className="size-5" aria-hidden="true" />
        </button>
      </header>

      <div
        aria-hidden="true"
        className="mt-1 grid grid-cols-7 text-center text-[11px] font-medium tracking-[0.1em] text-white/55"
      >
        {weekdays.map((weekday, index) => (
          <span
            key={`${weekday}-${index}`}
            className="flex h-7 items-center justify-center"
          >
            {weekday}
          </span>
        ))}
      </div>

      <ul className="grid grid-cols-7">
        {cells.map((date) => {
          const day = toDay(date)
          const outside = date.getUTCMonth() !== visible.month
          const past = day < earliest
          const selected = day === value

          return (
            <li key={day} className="flex min-w-0 justify-center">
              <button
                type="button"
                disabled={past}
                aria-pressed={selected}
                data-initial-focus={day === focusDay ? '' : undefined}
                aria-label={
                  locale === 'en'
                    ? new Intl.DateTimeFormat('en-GB', {
                        dateStyle: 'full',
                        timeZone: 'UTC',
                      }).format(new Date(`${day}T00:00:00Z`))
                    : formatHuCalendarDay(day)
                }
                onClick={() => {
                  onChange(day)
                  // Tapping into a neighbouring month brings the month with it,
                  // so the selection stays on screen instead of vanishing into
                  // a grid the host still has to scroll to.
                  if (outside) setVisible(monthOf(day))
                }}
                className={[
                  // Fluid width, so seven of them fit a phone-width panel at
                  // 130% text; the height keeps the 44px tap target.
                  `flex h-11 w-full max-w-11 items-center justify-center rounded-[12px] text-[14px] font-medium transition-colors ${HOST_FOCUS}`,
                  // Two signals, not one: the selected day is the only white
                  // cell, and the only one in ink.
                  selected
                    ? 'bg-white text-landing-ink'
                    : past
                      ? 'text-white/25'
                      : outside
                        ? 'text-white/55 hover:bg-white/8'
                        : 'text-white hover:bg-white/8',
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
