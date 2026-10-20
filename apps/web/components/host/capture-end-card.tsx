'use client'

import { useRef, useState, useTransition } from 'react'

import { setCaptureEnd } from '@/app/(product)/host/events/[slug]/actions'
import { EventEndFields } from '@/components/host/event-end-fields'
import { MonthCalendar } from '@/components/host/month-calendar'
import { useSettingsSave } from '@/components/host/settings-save'
import {
  HOST_PANEL,
  HOST_ROW_DETAIL,
  HOST_ROW_QUESTION,
} from '@/components/host/ui/classes'
import { FloatingPanel } from '@/components/host/ui/floating-panel'
import { eventLocalToIso, formatRevealBadge } from '@/lib/format'
import { captureEndDisplay } from '@/lib/host-ui'

/**
 * Moves the moment the camera closes.
 *
 * **Only the end.** The camera opens when the event is created, which is not a
 * decision anybody makes — the create flow does not ask for it and this does not
 * offer to change it. Reopening a camera is what moving the *end* forwards does.
 *
 * **No `<input type="datetime-local">`.** iOS Safari lays a native date control
 * out from its own shadow tree and draws the control around that intrinsic
 * width, so the field ran off the side of the phone; `min-width`, `max-width`
 * and `box-sizing` all failed because they act on a box the shadow tree never
 * consulted. The visible day is ours, `MonthCalendar` is ours, and the only
 * native control left is `type="time"`, which is a fixed-width `HH:mm`.
 *
 * The calendar is a `FloatingPanel` under the card rather than a sheet: it
 * overlays the cards below without moving them, and the day it is changing
 * stays in view above it.
 *
 * It saves when a day is picked, and when the time field is blurred or Enter
 * is pressed — never on the native `change`, which desktop Chrome fires per
 * segment, so an in-between past value would close the camera. Only a value
 * that differs from the stored one is sent, and only the latest of
 * overlapping saves may touch the fields. Deliberately
 * **not optimistic**, unlike the toggles: a field that showed a value the
 * server had refused would be lying about the one value guests are held to.
 * While a save is in flight the fields read as busy, and a failure puts the
 * stored value back. When the refusal is the end falling before the event
 * began (7e), the fields are outlined and the line underneath names the value
 * that stayed; any other failure is the header's "Újra" toast.
 *
 * Setting the end in the past is allowed and is the fastest way to stop a
 * camera early. That is why the calendar's floor is the day the event
 * *started* rather than today — the server refuses only `end <= start`, and
 * the picker refuses exactly what the server does.
 */
export function CaptureEndCard({
  slug,
  endValue,
  startValue,
  zone,
  state,
  locale,
}: {
  slug: string
  /** The saved end, as a `datetime-local` value in the event's own zone. */
  endValue: string
  /** When the camera opened, as a `datetime-local` value in the same zone. */
  startValue: string
  /** The event's IANA zone, to name a kept value in 7e. */
  zone: string
  state: 'before' | 'open' | 'after'
  locale: 'en' | 'hu'
}) {
  const en = locale === 'en'
  const { report } = useSettingsSave()
  // The last end the server confirmed. Both strings are the event's own wall
  // clock, already formatted by the server, so nothing here reparses a zone.
  const [stored, setStored] = useState(endValue)
  // The same value for callbacks that outlive a render: a retry tapped in the
  // toast must restore whatever is stored then, not when it failed.
  const storedRef = useRef(endValue)
  // Saves can overlap — a day picked while a time is still saving — and
  // resolve out of order. Only the latest one may touch the fields or report.
  const latest = useRef(0)
  // The newest save the server has accepted. An overtaken save that landed
  // still moved the stored end, so a later failure reverts to it rather than
  // to the value before it; an older one landing late does not undo a newer.
  const confirmed = useRef(0)
  const inFlight = useRef<string | null>(null)
  // What the two fields show. The time is its own string because a native
  // time field passes through '' while a segment is being retyped.
  const [day, setDay] = useState(() => endValue.slice(0, 10))
  const [time, setTime] = useState(() => endValue.slice(11, 16))
  const [refused, setRefused] = useState(false)
  const [calendarOpen, setCalendarOpen] = useState(false)
  const [pending, startTransition] = useTransition()

  const show = (value: string) => {
    setDay(value.slice(0, 10))
    setTime(value.slice(11, 16))
  }

  const save = (next: string) => {
    show(next)
    setRefused(false)
    const seq = ++latest.current
    inFlight.current = next
    startTransition(async () => {
      try {
        await setCaptureEnd(slug, next)
        if (seq > confirmed.current) {
          confirmed.current = seq
          storedRef.current = next
          setStored(next)
        }
        if (seq !== latest.current) return
        inFlight.current = null
        report('ok', () => save(next))
      } catch {
        if (seq !== latest.current) return
        inFlight.current = null
        // A server error's message does not survive a production build, so
        // the refusal is recognised by the same rule the action applies.
        // Both strings are wall clock in the same zone, so they compare as
        // text.
        const display = captureEndDisplay(storedRef.current, next <= startValue)
        show(display.value)
        setRefused(display.error)
        if (!display.error) report('error', () => save(next))
      }
    })
  }

  const commit = (next: string) => {
    if (next === inFlight.current) return
    if (next === storedRef.current && inFlight.current === null) {
      show(next)
      setRefused(false)
      return
    }
    save(next)
  }

  const keptIso = eventLocalToIso(stored, zone)
  const kept = keptIso ? formatRevealBadge(keptIso, zone, locale) : stored

  return (
    <section className={`relative ${HOST_PANEL} p-5`}>
      <p className={HOST_ROW_QUESTION}>
        {en ? 'Shooting ends' : 'Fotózás vége'}
      </p>
      <p className={HOST_ROW_DETAIL}>
        {state === 'before'
          ? en
            ? 'The camera is not open yet.'
            : 'A kamera még nem nyílt meg.'
          : state === 'open'
            ? en
              ? 'Guests can take photos now.'
              : 'A vendégek most fotózhatnak.'
            : en
              ? 'Shooting has ended. Choose a later time to reopen it.'
              : 'A fotózás véget ért. Egy későbbi időpontot megadva újra megnyithatod.'}
      </p>

      <div
        className={`mt-3 transition-opacity ${pending ? 'opacity-60' : ''}`}
        aria-busy={pending}
      >
        <EventEndFields
          day={day}
          time={time}
          onChooseDay={() => setCalendarOpen((open) => !open)}
          dayExpanded={calendarOpen}
          onTimeChange={setTime}
          onTimeCommit={(value) => commit(`${day}T${value}`)}
          timeStep={900}
          error={refused}
          locale={locale}
          timeLabel={en ? 'Shooting end time' : 'A fotózás végének időpontja'}
        />
      </div>

      {refused ? (
        <p
          role="alert"
          className="mt-3 text-[14px] leading-[1.5] text-pretty text-host-danger"
        >
          {en
            ? `That time has already passed. Choose a later one; the earlier value (${kept}) has been kept.`
            : `Ez az időpont már elmúlt. Válassz későbbi időpontot, a korábbi érték (${kept}) megmaradt.`}
        </p>
      ) : null}

      <FloatingPanel
        open={calendarOpen}
        onClose={() => setCalendarOpen(false)}
        anchorClassName="inset-x-2 top-[calc(100%-8px)]"
      >
        <MonthCalendar
          value={day}
          earliest={startValue.slice(0, 10)}
          label={en ? 'Shooting ends' : 'A fotózás vége'}
          locale={locale}
          onChange={(value) => {
            setCalendarOpen(false)
            // A time field caught mid-edit is empty; the day still saves
            // against the stored time rather than sending half a value.
            commit(`${value}T${time || storedRef.current.slice(11, 16)}`)
          }}
        />
      </FloatingPanel>
    </section>
  )
}
