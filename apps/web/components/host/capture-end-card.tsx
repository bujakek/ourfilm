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
import {
  eventLocalToIso,
  formatEventLocalInput,
  formatRevealBadge,
} from '@/lib/format'
import {
  captureEndCommit,
  captureEndDisplay,
  saveLedger,
  saveLedgerCommit,
  saveLedgerIssue,
  saveLedgerSettle,
} from '@/lib/host-ui'

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
 * segment, so an in-between past value would close the camera. A picked day
 * that, with the time already in the field, would close a camera that is
 * still open is *held*: shown, marked "Nincs mentve", and sent only once a
 * time is committed (`captureEndCommit`). Only a value that differs from the
 * stored one is sent, and only the latest of overlapping saves may touch the
 * fields (`saveLedger*`). Deliberately
 * **not optimistic**, unlike the toggles: a field that showed a value the
 * server had refused would be lying about the one value guests are held to.
 * While a save is in flight the fields read as busy, and a failure puts the
 * stored value back. An end at or before the start (7e) is refused before
 * the round trip, by the server's own rule: the fields are outlined and the
 * line underneath names the value that stayed. Any other failure is the
 * header's "Újra" toast. A deliberate close lands like any other save, and the
 * revalidated page's state line then reads "A fotózás véget ért".
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
  // Saves can overlap — a day picked while a time is still saving — and
  // resolve out of order. The ledger (`lib/host-ui.ts`) decides which save may
  // touch the fields and what is stored; it lives in a ref because a retry
  // tapped in the toast must see whatever is stored then, not when it failed.
  const ledger = useRef(saveLedger(endValue))
  // What the two fields show. The time is its own string because a native
  // time field passes through '' while a segment is being retyped.
  const [day, setDay] = useState(() => endValue.slice(0, 10))
  const [time, setTime] = useState(() => endValue.slice(11, 16))
  const [refused, setRefused] = useState(false)
  // A picked day that would close a running camera: shown, not sent.
  const [held, setHeld] = useState(false)
  const [calendarOpen, setCalendarOpen] = useState(false)
  const [pending, startTransition] = useTransition()

  const show = (value: string) => {
    setDay(value.slice(0, 10))
    setTime(value.slice(11, 16))
  }

  const save = (next: string) => {
    show(next)
    setRefused(false)
    setHeld(false)
    const issued = saveLedgerIssue(ledger.current, next)
    ledger.current = issued.ledger
    const { seq } = issued
    startTransition(async () => {
      let ok = true
      try {
        await setCaptureEnd(slug, next)
      } catch {
        ok = false
      }
      const settled = saveLedgerSettle(ledger.current, seq, next, ok)
      ledger.current = settled.ledger
      if (ok) setStored(settled.ledger.stored)
      if (!settled.latest) return
      if (ok) {
        report('ok', () => save(next))
        return
      }
      // Not the end-before-start refusal: `commit` catches that before the
      // round trip, so this is a failure worth "Újra".
      const display = captureEndDisplay(settled.ledger.stored, false)
      show(display.value)
      setRefused(display.error)
      setHeld(false)
      report('error', () => save(next))
    })
  }

  const commit = (next: string, source: 'day' | 'time') => {
    const decision = saveLedgerCommit(ledger.current, next)
    if (decision === 'skip') return
    if (decision === 'unchanged') {
      show(next)
      setRefused(false)
      setHeld(false)
      return
    }
    // Both strings are wall clock in the event's zone, so they compare as
    // text; `now` is read here, at the moment of the commit.
    const verdict = captureEndCommit({
      stored: ledger.current.inFlight ?? ledger.current.stored,
      next,
      start: startValue,
      now: formatEventLocalInput(new Date(), zone),
      source,
    })
    if (verdict === 'refuse') {
      // 7e: the stored value stays, outlined, and the line names it.
      const display = captureEndDisplay(ledger.current.stored, true)
      show(display.value)
      setRefused(display.error)
      setHeld(false)
      return
    }
    if (verdict === 'hold') {
      show(next)
      setRefused(false)
      setHeld(true)
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
          onTimeCommit={(value) => commit(`${day}T${value}`, 'time')}
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
      {/* Always mounted, so the hold is announced when it appears. */}
      <div aria-live="polite">
        {held && !refused ? (
          <p className="mt-3 text-[14px] leading-[1.5] text-pretty text-white/65">
            {en
              ? 'Not saved – pick a time'
              : 'Nincs mentve – válassz időpontot'}
          </p>
        ) : null}
      </div>

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
            // A time field caught mid-edit is empty; the day still commits
            // against the stored time rather than sending half a value.
            commit(
              `${value}T${time || ledger.current.stored.slice(11, 16)}`,
              'day',
            )
          }}
        />
      </FloatingPanel>
    </section>
  )
}
