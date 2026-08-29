'use client'

import { CalendarDays, ChevronRight, Clock3 } from 'lucide-react'
import { useState } from 'react'

import { MonthCalendar } from '@/components/host/month-calendar'
import { Sheet } from '@/components/host/sheet'
import {
  OnboardingShell,
  type OnboardingNav,
} from '@/components/host/onboarding/onboarding-shell'
import { formatEventDate } from '@/lib/format'
import type { Locale } from '@/lib/i18n'

/**
 * Question two: when does the party end?
 *
 * Only the end. The camera opens the moment the event is created, so a start
 * field would be a question with one possible answer — and the screen it would
 * have shared with this one is the screen this flow exists to avoid.
 *
 * There is no timezone control either. The host is picking a wall clock and
 * means the one on the phone in their hand; the flow reads that zone off the
 * browser and stores it with the event, so the guests, the badge and the
 * settings page all agree without anyone being asked.
 */
export function StepEnd({
  nav,
  day,
  setDay,
  time,
  setTime,
  today,
  canAdvance,
  locale,
}: {
  nav: OnboardingNav
  /** `YYYY-MM-DD` */
  day: string
  setDay: (value: string) => void
  /** `HH:mm`, 24-hour */
  time: string
  setTime: (value: string) => void
  /** The host's today, `YYYY-MM-DD`. Nothing before it is selectable. */
  today: string
  canAdvance: boolean
  locale: Locale
}) {
  const [calendarOpen, setCalendarOpen] = useState(false)
  const en = locale === 'en'

  return (
    <>
      <OnboardingShell
        {...nav}
        locale={locale}
        title={
          en ? 'When should the camera close?' : 'Mikor érjen véget az esemény?'
        }
        detail={
          en
            ? 'The camera opens now. Guests can keep shooting until this time.'
            : 'A film most indul, a vendégek pedig a megadott időpontig készíthetnek képeket.'
        }
        cta={en ? 'Continue' : 'Tovább'}
        ctaDisabled={!canAdvance}
      >
        <div className="space-y-3">
          <button
            type="button"
            onClick={() => setCalendarOpen(true)}
            className="glass flex min-h-20 w-full items-center gap-4 rounded-2xl px-5 text-left"
          >
            <CalendarDays
              className="size-5 shrink-0 text-accent"
              strokeWidth={1.8}
              aria-hidden="true"
            />
            <span className="min-w-0 flex-1">
              <span className="block text-xs tracking-[0.2em] text-muted-foreground/70">
                {en ? 'DATE' : 'DÁTUM'}
              </span>
              <span className="mt-1 block text-base font-medium">
                {formatEventDate(day, locale)}
              </span>
            </span>
            <ChevronRight
              className="size-5 shrink-0 text-muted-foreground"
              aria-hidden="true"
            />
          </button>

          {/* The card is ours, the picker is the phone's. Keeping the native
              input over the whole surface gives iOS and Android a direct tap
              target without exposing their differently styled text fields. */}
          <label className="glass relative flex min-h-20 w-full cursor-pointer items-center gap-4 overflow-hidden rounded-2xl px-5 text-left has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-accent">
            <Clock3
              className="size-5 shrink-0 text-accent"
              strokeWidth={1.8}
              aria-hidden="true"
            />
            <span className="min-w-0 flex-1">
              <span className="block text-xs tracking-[0.2em] text-muted-foreground/70">
                {en ? 'TIME' : 'IDŐPONT'}
              </span>
              <span className="mt-1 block text-base font-medium tabular-nums">
                {time}
              </span>
            </span>
            <ChevronRight
              className="size-5 shrink-0 text-muted-foreground"
              aria-hidden="true"
            />
            <input
              type="time"
              step={60}
              required
              aria-label={
                en ? 'Event end time' : 'Az esemény végének időpontja'
              }
              value={time}
              onChange={(event) => setTime(event.target.value)}
              className="absolute inset-0 size-full cursor-pointer opacity-0"
            />
          </label>
        </div>
      </OnboardingShell>

      <Sheet
        open={calendarOpen}
        onClose={() => setCalendarOpen(false)}
        closeLabel={en ? 'Close date picker' : 'Dátumválasztó bezárása'}
        title={en ? 'Choose a date' : 'Válassz dátumot'}
        detail={
          en
            ? 'Guests can shoot until this date and time.'
            : 'Eddig az időpontig készíthetnek képeket a vendégeid.'
        }
      >
        <MonthCalendar
          value={day}
          earliest={today}
          label="Az esemény vége"
          locale={locale}
          onChange={(value) => {
            setDay(value)
            setCalendarOpen(false)
          }}
        />
      </Sheet>
    </>
  )
}
