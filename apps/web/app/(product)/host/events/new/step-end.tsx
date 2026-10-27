'use client'

import { useState } from 'react'

import { EventEndFields } from '@/components/host/event-end-fields'
import type { StepScreen } from '@/components/host/onboarding/onboarding-shell'
import type { Locale } from '@/lib/i18n'
import { endAfterTimeEdit, type EndDaySource } from '@/lib/onboarding'

/** What a picked day lands on while the time field is mid-edit and empty. */
const FALLBACK_TIME = '23:00'

/**
 * Question two: when does the party end? (6b)
 *
 * Only the end. The camera opens the moment the event is created, so a start
 * field would be a question with one possible answer.
 *
 * There is no timezone control either. The host is picking a wall clock and
 * means the one on the phone in their hand; the flow reads that zone off the
 * browser and stores it with the event, so the guests, the badge and the
 * settings page all agree without anyone being asked.
 */
export function endScreen({
  endLocal,
  setEndLocal,
  now,
  timeZone,
  today,
  canAdvance,
  locale,
}: {
  /** `YYYY-MM-DDTHH:mm` in `timeZone`. The day tile and the time tile both
   *  read and write this one value. */
  endLocal: string
  setEndLocal: (value: string) => void
  /** The server's instant, so a render reads no clock. */
  now: Date
  timeZone: string
  /** The host's today, `YYYY-MM-DD`. Nothing before it is selectable. */
  today: string
  canAdvance: boolean
  locale: Locale
}): StepScreen {
  const en = locale === 'en'
  return {
    eyebrow: en ? 'Shooting ends' : 'A fotózás vége',
    title: en ? 'When should the event end?' : 'Mikor érjen véget az esemény?',
    detail: en
      ? 'The camera opens now. Guests can take photos until this time.'
      : 'A kamera most nyílik. A vendégek eddig az időpontig fotózhatnak.',
    cta: en ? 'Continue' : 'Tovább',
    ctaDisabled: !canAdvance,
    content: (
      <EndFields
        endLocal={endLocal}
        setEndLocal={setEndLocal}
        now={now}
        timeZone={timeZone}
        today={today}
        locale={locale}
      />
    ),
  }
}

function EndFields({
  endLocal,
  setEndLocal,
  now,
  timeZone,
  today,
  locale,
}: {
  endLocal: string
  setEndLocal: (value: string) => void
  now: Date
  timeZone: string
  today: string
  locale: Locale
}) {
  // Until the host picks a day, the draft's day follows the time: an end
  // at 02:00 is after tonight's midnight, not this morning. A picked day
  // stays put. Not stored with the draft, so coming back starts over.
  const [source, setSource] = useState<EndDaySource>('suggested')
  const en = locale === 'en'

  const day = endLocal.slice(0, 10)
  const time = endLocal.slice(11)

  return (
    <EventEndFields
      day={day}
      time={time}
      minDay={today}
      onDayChange={(value) => {
        setSource('picked')
        setEndLocal(`${value}T${time || FALLBACK_TIME}`)
      }}
      onTimeChange={(value) => {
        if (!value) {
          setEndLocal(`${day}T`)
          return
        }
        setEndLocal(endAfterTimeEdit(endLocal, value, source, now, timeZone))
      }}
      timeStep={900}
      locale={locale}
      timeLabel={en ? 'Event end time' : 'Az esemény végének időpontja'}
      labels={en ? { day: 'Day', time: 'Time' } : { day: 'Nap', time: 'Idő' }}
    />
  )
}
