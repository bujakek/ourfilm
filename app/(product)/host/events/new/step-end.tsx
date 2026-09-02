'use client'

import { useState } from 'react'

import { EventEndFields } from '@/components/host/event-end-fields'
import { MonthCalendar } from '@/components/host/month-calendar'
import { Sheet } from '@/components/host/sheet'
import {
  OnboardingShell,
  type OnboardingNav,
} from '@/components/host/onboarding/onboarding-shell'
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
        eyebrow={en ? 'SHOOTING ENDS' : 'A FOTÓZÁS VÉGE'}
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
        <EventEndFields
          day={day}
          time={time}
          onChooseDay={() => setCalendarOpen(true)}
          onTimeChange={setTime}
          locale={locale}
          timeLabel={en ? 'Event end time' : 'Az esemény végének időpontja'}
        />
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
