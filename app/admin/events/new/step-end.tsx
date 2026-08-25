'use client'

import { MonthCalendar } from '@/components/admin/onboarding/month-calendar'
import {
  OnboardingShell,
  type OnboardingNav,
} from '@/components/admin/onboarding/onboarding-shell'

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
}) {
  return (
    <OnboardingShell
      {...nav}
      title="Mikor érjen véget az esemény?"
      detail="A film most indul, a vendégek pedig a megadott időpontig készíthetnek képeket."
      cta="Tovább"
      ctaDisabled={!canAdvance}
    >
      <MonthCalendar value={day} today={today} onChange={setDay} />

      <div className="mt-6 border-t border-dashed border-border pt-5">
        <div className="flex items-center justify-between gap-4">
          <span
            id="end-time-label"
            className="text-xs tracking-[0.2em] text-muted-foreground/70"
          >
            IDŐPONT
          </span>
          {/* A native time input rather than a custom wheel: on a phone this is
              the OS picker, which is the one control every guest-facing rule in
              this product is eventually measured against. `step` pins it to
              whole minutes so no seconds field appears next to it. */}
          <input
            type="time"
            step={60}
            required
            aria-labelledby="end-time-label"
            value={time}
            onChange={(event) => setTime(event.target.value)}
            className="glass min-h-12 cursor-pointer rounded-full px-5 text-lg font-medium tabular-nums outline-none [&::-webkit-calendar-picker-indicator]:hidden [&::-webkit-date-and-time-value]:text-center"
          />
        </div>
      </div>
    </OnboardingShell>
  )
}
