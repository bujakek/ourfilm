'use client'

import { CalendarDays, ChevronRight, Clock3 } from 'lucide-react'
import { useState, useTransition } from 'react'

import { setCaptureEnd } from '@/app/(product)/host/events/[slug]/actions'
import { MonthCalendar } from '@/components/host/month-calendar'
import { Sheet } from '@/components/host/sheet'
import { formatEventDate } from '@/lib/format'

/**
 * Moves the moment the camera closes.
 *
 * **Only the end.** The camera opens when the event is created, which is not a
 * decision anybody makes — the create flow does not ask for it and this does not
 * offer to change it. A start field here would have been a second date to keep
 * straight for a value that is always "when I pressed the button", and its one
 * real use — reopening a camera by moving the start backwards — is already what
 * moving the *end* forwards does.
 *
 * **No `<input type="datetime-local">`, and that is the whole reason this card
 * looks like the create flow's second screen.** iOS Safari lays a native date
 * control out from its own shadow tree (`::-webkit-datetime-edit`, which
 * Tailwind's preflight sets to `inline-flex` to fix a *macOS* height bug) and
 * draws the control around that intrinsic width — so the field rendered wider
 * than its card and ran off the side of the phone. `min-width`, `max-width` and
 * `box-sizing` were all tried and all failed, which is the signature: they act
 * on the CSS box, and the overflow was coming from a shadow tree that never
 * consulted it. The fix is to stop asking the browser to draw a date. The
 * visible text is ours, `MonthCalendar` is ours, and the only native control
 * left is `type="time"`, which is a fixed-width `HH:mm` and lies flat.
 *
 * It reads in Hungarian now too. The native field showed whatever the device
 * locale produced — "2026. Aug 29. at 0:00" on a Hungarian phone with an
 * English system language.
 *
 * Deliberately **no optimistic state**, unlike the toggles beside it. A field
 * that shows the typed text while the saved answer is an hour off would be lying
 * about the one value guests are held to — and unlike a boolean, there is no way
 * to glance at it and notice.
 *
 * Setting the end in the past is allowed and is the fastest way to stop a camera
 * early: a host standing in the room at the end of the night should not have to
 * compute a future timestamp to close it now. That is why the calendar's floor
 * is the day the event *started* rather than today — the server refuses only
 * `end <= start`, and the picker should refuse exactly what the server does.
 */
export function CaptureEndCard({
  slug,
  endValue,
  startDay,
  state,
  locale,
}: {
  /** The saved end, as a `datetime-local` value in the event's own zone. */
  endValue: string
  slug: string
  /** The day the camera opened, `YYYY-MM-DD` in the event's zone. */
  startDay: string
  state: 'before' | 'open' | 'after'
  locale: 'en' | 'hu'
}) {
  const en = locale === 'en'
  // Split once, on the string the server already formatted in the event's zone.
  // Reparsing it into a Date here would reintroduce exactly the zone question
  // `formatEventLocalInput` settled on the server.
  const [day, setDay] = useState(() => endValue.slice(0, 10))
  const [time, setTime] = useState(() => endValue.slice(11, 16))
  const [calendarOpen, setCalendarOpen] = useState(false)
  const [pending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const [saved, setSaved] = useState(false)

  const end = `${day}T${time}`

  return (
    <>
      <div className="glass rounded-2xl px-5 py-4">
        <p className="font-medium">{en ? 'Shooting ends' : 'A fotózás vége'}</p>
        <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
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

        <div className="mt-4 space-y-2">
          {/* The same two cards and the same sheet as the create flow's second
            screen. Editing an event and creating one are the same question,
            and a host who has just answered it once should not have to learn a
            second control to change the answer.

            It also has to be a sheet. `MonthCalendar` is seven 44px cells, so
            it needs 308px; expanded inside this card at 390px it gets about
            302 and the grid is squeezed. */}
          <button
            type="button"
            onClick={() => setCalendarOpen(true)}
            className="glass flex min-h-16 w-full items-center gap-4 rounded-xl px-4 text-left"
          >
            <CalendarDays
              className="size-5 shrink-0 text-accent"
              strokeWidth={1.8}
              aria-hidden="true"
            />
            <span className="min-w-0 flex-1">
              <span className="block text-[0.6875rem] tracking-[0.2em] text-muted-foreground/70">
                {en ? 'DATE' : 'DÁTUM'}
              </span>
              <span className="mt-0.5 block text-sm font-medium">
                {formatEventDate(day)}
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
          <label className="glass relative flex min-h-16 w-full cursor-pointer items-center gap-4 overflow-hidden rounded-xl px-4 text-left has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-accent">
            <Clock3
              className="size-5 shrink-0 text-accent"
              strokeWidth={1.8}
              aria-hidden="true"
            />
            <span className="min-w-0 flex-1">
              <span className="block text-[0.6875rem] tracking-[0.2em] text-muted-foreground/70">
                {en ? 'TIME' : 'IDŐPONT'}
              </span>
              <span className="mt-0.5 block text-sm font-medium tabular-nums">
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
                en ? 'Shooting end time' : 'A fotózás végének időpontja'
              }
              value={time}
              onChange={(event) => {
                setTime(event.target.value)
                setSaved(false)
              }}
              className="absolute inset-0 size-full cursor-pointer opacity-0"
            />
          </label>
        </div>

        <button
          type="button"
          disabled={pending || end === endValue}
          onClick={() =>
            startTransition(async () => {
              setError(null)
              try {
                await setCaptureEnd(slug, end)
                setSaved(true)
              } catch (e) {
                setError(
                  e instanceof Error
                    ? e.message
                    : en
                      ? 'Could not save changes.'
                      : 'Nem sikerült módosítani.',
                )
              }
            })
          }
          className="mt-4 inline-flex min-h-12 w-full items-center justify-center rounded-full bg-primary px-6 text-sm font-semibold text-primary-foreground disabled:opacity-60"
        >
          {pending
            ? en
              ? 'Saving…'
              : 'Mentés…'
            : en
              ? 'Save changes'
              : 'Változtatások mentése'}
        </button>

        {error ? (
          <p className="mt-2 text-xs text-destructive">{error}</p>
        ) : saved ? (
          <p className="mt-2 text-xs text-accent">
            {en ? 'Saved.' : 'Elmentettük.'}
          </p>
        ) : null}
      </div>

      <Sheet
        open={calendarOpen}
        onClose={() => setCalendarOpen(false)}
        closeLabel={en ? 'Close date picker' : 'Dátumválasztó bezárása'}
        title={en ? 'Choose a date' : 'Válassz dátumot'}
        detail={
          en
            ? 'Guests can take photos until this time.'
            : 'Eddig az időpontig készíthetnek képeket a vendégeid.'
        }
      >
        <MonthCalendar
          value={day}
          earliest={startDay}
          label={en ? 'Shooting ends' : 'A fotózás vége'}
          locale={locale}
          onChange={(value) => {
            setDay(value)
            setSaved(false)
            setCalendarOpen(false)
          }}
        />
      </Sheet>
    </>
  )
}
