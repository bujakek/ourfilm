'use client'

import { CalendarDays, ChevronRight, Clock3 } from 'lucide-react'
import { useEffect, useRef } from 'react'

import { formatEventDate } from '@/lib/format'
import type { Locale } from '@/lib/i18n'

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
}: {
  day: string
  time: string
  onChooseDay: () => void
  onTimeChange: (time: string) => void
  locale: Locale
  timeLabel: string
  /**
   * The native `change` event: the picker was dismissed, or a whole value was
   * typed. React's `onChange` is the per-keystroke `input` event, which on a
   * desktop time field fires once per segment — far too often to autosave on.
   */
  onTimeCommit?: (time: string) => void
  /** Seconds. Settings asks for 900, a quarter-hour. */
  timeStep?: number
  /** Set when the day button opens a panel rather than a dialog. */
  dayExpanded?: boolean
  /** 7e: the server refused the value; both fields are outlined. */
  error?: boolean
}) {
  const en = locale === 'en'
  const timeInput = useRef<HTMLInputElement>(null)
  const commit = useRef(onTimeCommit)
  useEffect(() => {
    commit.current = onTimeCommit
  })
  useEffect(() => {
    const input = timeInput.current
    if (!input) return
    const onChange = () => {
      if (input.value) commit.current?.(input.value)
    }
    input.addEventListener('change', onChange)
    return () => input.removeEventListener('change', onChange)
  }, [])

  return (
    <div className="space-y-2.5">
      <button
        type="button"
        onClick={onChooseDay}
        aria-expanded={dayExpanded}
        className="hover:border-strong flex min-h-16 w-full items-center gap-4 rounded-lg border border-border px-4 text-left transition-colors"
      >
        <CalendarDays
          className="size-5 shrink-0 text-muted-foreground"
          strokeWidth={1.8}
          aria-hidden="true"
        />
        <span className="min-w-0 flex-1">
          <span className="block font-mono text-[9px] font-medium tracking-[0.16em] text-muted-foreground/70">
            {en ? 'DATE' : 'DÁTUM'}
          </span>
          <span className="mt-1 block font-mono text-[13px] font-medium">
            {formatEventDate(day, locale)}
          </span>
        </span>
        <ChevronRight
          className="size-5 shrink-0 text-muted-foreground"
          aria-hidden="true"
        />
      </button>

      <label className="hover:border-strong relative flex min-h-16 w-full cursor-pointer items-center gap-4 overflow-hidden rounded-lg border border-border px-4 text-left transition-colors has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-accent">
        <Clock3
          className="size-5 shrink-0 text-muted-foreground"
          strokeWidth={1.8}
          aria-hidden="true"
        />
        <span className="min-w-0 flex-1">
          <span className="block font-mono text-[9px] font-medium tracking-[0.16em] text-muted-foreground/70">
            {en ? 'TIME' : 'IDŐPONT'}
          </span>
          {/* `tabular-nums` is gone with the proportional face: a mono already
              holds its columns, which is the whole reason a clock reads in one. */}
          <span className="mt-1 block font-mono text-[13px] font-medium">
            {time}
          </span>
        </span>
        <ChevronRight
          className="size-5 shrink-0 text-muted-foreground"
          aria-hidden="true"
        />
        <input
          ref={timeInput}
          type="time"
          step={timeStep}
          required
          aria-invalid={error || undefined}
          aria-label={timeLabel}
          value={time}
          onChange={(event) => onTimeChange(event.target.value)}
          className="absolute inset-0 size-full cursor-pointer opacity-0"
        />
      </label>
    </div>
  )
}
