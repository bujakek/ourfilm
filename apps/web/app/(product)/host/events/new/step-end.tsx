'use client'

import { useState } from 'react'

import { EventEndFields } from '@/components/host/event-end-fields'
import { MonthCalendar } from '@/components/host/month-calendar'
import { Sheet } from '@/components/host/sheet'
import type { StepScreen } from '@/components/host/onboarding/onboarding-shell'
import { SwitchTrack } from '@/components/ui/switch'
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
export function endScreen({
  day,
  setDay,
  time,
  setTime,
  today,
  afterEventUploadsEnabled,
  setAfterEventUploadsEnabled,
  canAdvance,
  locale,
}: {
  /** `YYYY-MM-DD` */
  day: string
  setDay: (value: string) => void
  /** `HH:mm`, 24-hour */
  time: string
  setTime: (value: string) => void
  /** The host's today, `YYYY-MM-DD`. Nothing before it is selectable. */
  today: string
  afterEventUploadsEnabled: boolean
  setAfterEventUploadsEnabled: (value: boolean) => void
  canAdvance: boolean
  locale: Locale
}): StepScreen {
  const en = locale === 'en'
  return {
    eyebrow: en ? 'SHOOTING ENDS' : 'A FOTÓZÁS VÉGE',
    title: en
      ? 'When should the camera close?'
      : 'Mikor érjen véget az esemény?',
    detail: en
      ? 'The camera opens now. Guests can keep shooting until this time.'
      : 'A film most indul, a vendégek pedig a megadott időpontig készíthetnek képeket.',
    cta: en ? 'Continue' : 'Tovább',
    ctaDisabled: !canAdvance,
    content: (
      <EndFields
        day={day}
        setDay={setDay}
        time={time}
        setTime={setTime}
        today={today}
        afterEventUploadsEnabled={afterEventUploadsEnabled}
        setAfterEventUploadsEnabled={setAfterEventUploadsEnabled}
        locale={locale}
      />
    ),
  }
}

function EndFields({
  day,
  setDay,
  time,
  setTime,
  today,
  afterEventUploadsEnabled,
  setAfterEventUploadsEnabled,
  locale,
}: {
  day: string
  setDay: (value: string) => void
  time: string
  setTime: (value: string) => void
  today: string
  afterEventUploadsEnabled: boolean
  setAfterEventUploadsEnabled: (value: boolean) => void
  locale: Locale
}) {
  const [calendarOpen, setCalendarOpen] = useState(false)
  const en = locale === 'en'

  return (
    <>
      <EventEndFields
        day={day}
        time={time}
        onChooseDay={() => setCalendarOpen(true)}
        onTimeChange={setTime}
        locale={locale}
        timeLabel={en ? 'Event end time' : 'Az esemény végének időpontja'}
      />

      <button
        type="button"
        role="switch"
        aria-checked={afterEventUploadsEnabled}
        onClick={() => setAfterEventUploadsEnabled(!afterEventUploadsEnabled)}
        className="mt-6 flex min-h-14 w-full items-center justify-between gap-4 border-t border-border pt-5 text-left"
      >
        <span className="min-w-0">
          <span className="block text-sm font-medium">
            {en ? 'Uploads after the event' : 'Feltöltés az esemény után'}
          </span>
          <span className="mt-1 block text-xs leading-relaxed text-pretty text-muted-foreground">
            {afterEventUploadsEnabled
              ? en
                ? 'For 24 hours, guests can use their remaining frames on photos from their library.'
                : 'A vendégek 24 órán át a megmaradt képkockáikra tölthetnek fel képeket a telefonjuk fotótárából.'
              : en
                ? 'Uploads stop when the camera closes.'
                : 'A feltöltés a kamerával együtt lezárul.'}
          </span>
        </span>
        <SwitchTrack checked={afterEventUploadsEnabled} />
      </button>

      {/* A `<dialog>` opened with `showModal()` renders in the top layer, so it
          is unaffected by the scrolling column it now sits inside. */}
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
