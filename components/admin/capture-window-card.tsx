'use client'

import { useState, useTransition } from 'react'

import { setCaptureWindow } from '@/app/admin/events/[slug]/actions'
import { eventTimeZoneLabel } from '@/lib/format'

/**
 * Moves the capture window.
 *
 * Deliberately **no optimistic state**, unlike the toggles beside it. A field
 * that shows the typed text while the saved answer is an hour off would be
 * lying about the one value guests are held to — and unlike a boolean, there is
 * no way to glance at it and notice.
 *
 * Setting the end in the past is allowed and is the fastest way to stop a
 * camera early: a host standing in the room at the end of the night should not
 * have to compute a future timestamp to close it now.
 */
export function CaptureWindowCard({
  slug,
  startValue,
  endValue,
  timeZone,
  state,
}: {
  slug: string
  startValue: string
  endValue: string
  timeZone: string
  state: 'before' | 'open' | 'after'
}) {
  const [start, setStart] = useState(startValue)
  const [end, setEnd] = useState(endValue)
  const [pending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const [saved, setSaved] = useState(false)

  const dirty = start !== startValue || end !== endValue

  return (
    <div className="glass rounded-2xl px-5 py-4">
      <p className="font-medium">Fotózás időablaka</p>
      <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
        {state === 'before'
          ? 'A kamera még nem nyílt meg.'
          : state === 'open'
            ? 'A vendégek most fotózhatnak.'
            : 'A fotózás véget ért. A befejezés módosításával újra megnyithatod.'}{' '}
        Időzóna: {eventTimeZoneLabel(timeZone)}.
      </p>

      <div className="mt-4 flex flex-col gap-3">
        <div>
          <label
            htmlFor="capture_start"
            className="mb-1.5 block text-xs text-muted-foreground"
          >
            Kezdés
          </label>
          <input
            id="capture_start"
            type="datetime-local"
            value={start}
            onChange={(e) => {
              setStart(e.target.value)
              setSaved(false)
            }}
            className="glass min-h-12 w-full rounded-xl px-4 text-sm outline-none focus:border-accent"
          />
        </div>

        <div>
          <label
            htmlFor="capture_end"
            className="mb-1.5 block text-xs text-muted-foreground"
          >
            Befejezés
          </label>
          <input
            id="capture_end"
            type="datetime-local"
            value={end}
            min={start}
            onChange={(e) => {
              setEnd(e.target.value)
              setSaved(false)
            }}
            className="glass min-h-12 w-full rounded-xl px-4 text-sm outline-none focus:border-accent"
          />
        </div>
      </div>

      <button
        type="button"
        disabled={pending || !dirty}
        onClick={() =>
          startTransition(async () => {
            setError(null)
            try {
              await setCaptureWindow(slug, start, end)
              setSaved(true)
            } catch (e) {
              setError(
                e instanceof Error ? e.message : 'Nem sikerült módosítani.',
              )
            }
          })
        }
        className="mt-4 inline-flex min-h-12 w-full items-center justify-center rounded-full bg-primary px-6 text-sm font-semibold text-primary-foreground disabled:opacity-60"
      >
        {pending ? 'Mentés…' : 'Változtatások mentése'}
      </button>

      {error ? (
        <p className="mt-2 text-xs text-destructive">{error}</p>
      ) : saved ? (
        <p className="mt-2 text-xs text-accent">Elmentettük.</p>
      ) : null}
    </div>
  )
}
