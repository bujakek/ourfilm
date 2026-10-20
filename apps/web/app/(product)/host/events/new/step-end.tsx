'use client'

import { motion, useReducedMotion } from 'motion/react'
import { useState } from 'react'

import { EventEndFields } from '@/components/host/event-end-fields'
import { MonthCalendar } from '@/components/host/month-calendar'
import type { StepScreen } from '@/components/host/onboarding/onboarding-shell'
import { FloatingPanel } from '@/components/host/ui/floating-panel'
import type { Locale } from '@/lib/i18n'
import { T, still } from '@/lib/motion'
import {
  activeQuickPick,
  endQuickPick,
  type EndQuickPick,
} from '@/lib/onboarding'

/** What a quick pick lands on while the time field is mid-edit and empty. */
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
  /** `YYYY-MM-DDTHH:mm` in `timeZone`. The quick picks, the day tile and the
   *  time tile all read and write this one value. */
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
  const [calendarOpen, setCalendarOpen] = useState(false)
  const reduceMotion = useReducedMotion()
  const en = locale === 'en'

  const day = endLocal.slice(0, 10)
  const time = endLocal.slice(11)
  const picked = activeQuickPick(endLocal, now, timeZone)
  // An open month is "another day" being chosen, whatever the value says yet.
  const active = calendarOpen ? 'other' : picked

  const pick = (kind: EndQuickPick, at: string) =>
    setEndLocal(endQuickPick(kind, at || FALLBACK_TIME, now, timeZone))

  const chips: { key: EndQuickPick | 'other'; label: string }[] = [
    { key: 'tonight', label: en ? 'Tonight' : 'Ma éjjel' },
    { key: 'tomorrow', label: en ? 'Tomorrow' : 'Holnap' },
    { key: 'other', label: en ? 'Another day' : 'Másik nap' },
  ]

  return (
    <>
      <ul
        aria-label={en ? 'Quick picks' : 'Gyors választás'}
        className="flex flex-wrap gap-2"
      >
        {chips.map(({ key, label }) => {
          const on = active === key
          return (
            <li key={key}>
              <motion.button
                type="button"
                aria-pressed={key === 'other' ? undefined : on}
                aria-expanded={key === 'other' ? calendarOpen : undefined}
                whileTap={reduceMotion ? undefined : { scale: 0.96 }}
                transition={reduceMotion ? still : T.snap}
                onClick={() => {
                  if (key === 'other') {
                    setCalendarOpen((open) => !open)
                    return
                  }
                  setCalendarOpen(false)
                  pick(key, time)
                }}
                className={`inline-flex min-h-11 items-center rounded-[14px] px-[18px] py-2 text-[14px] transition-colors ${
                  on
                    ? 'bg-white text-landing-ink'
                    : 'bg-host-tile text-white/80 hover:bg-white/10 hover:text-white'
                }`}
              >
                {label}
              </motion.button>
            </li>
          )
        })}
      </ul>

      {/* The anchor for the month: absolute under the tiles, over whatever
          is below, so opening it moves nothing. */}
      <div className="relative mt-3">
        <EventEndFields
          day={day}
          time={time}
          onChooseDay={() => setCalendarOpen((open) => !open)}
          dayExpanded={calendarOpen}
          onTimeChange={(value) => {
            if (!value) {
              setEndLocal(`${day}T`)
              return
            }
            // "Ma éjjel" at 02:00 is after midnight. While a quick pick is
            // what the host chose, a new time keeps meaning that pick, so the
            // day follows it; a day from the month stays put.
            if (picked !== 'other' && !calendarOpen) pick(picked, value)
            else setEndLocal(`${day}T${value}`)
          }}
          timeStep={900}
          locale={locale}
          timeLabel={en ? 'Event end time' : 'Az esemény végének időpontja'}
          labels={
            en ? { day: 'Day', time: 'Time' } : { day: 'Nap', time: 'Idő' }
          }
        />

        <FloatingPanel
          open={calendarOpen}
          onClose={() => setCalendarOpen(false)}
          anchorClassName="inset-x-0 top-[calc(100%+8px)]"
        >
          <MonthCalendar
            value={day}
            earliest={today}
            label={en ? 'Event end' : 'Az esemény vége'}
            locale={locale}
            onChange={(value) => {
              setCalendarOpen(false)
              setEndLocal(`${value}T${time || FALLBACK_TIME}`)
            }}
          />
        </FloatingPanel>
      </div>
    </>
  )
}
