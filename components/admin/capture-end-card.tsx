'use client'

import { useState, useTransition } from 'react'

import { setCaptureEnd } from '@/app/admin/events/[slug]/actions'
import { eventTimeZoneLabel } from '@/lib/format'

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
 * Deliberately **no optimistic state**, unlike the toggles beside it. A field
 * that shows the typed text while the saved answer is an hour off would be lying
 * about the one value guests are held to — and unlike a boolean, there is no way
 * to glance at it and notice.
 *
 * Setting the end in the past is allowed and is the fastest way to stop a camera
 * early: a host standing in the room at the end of the night should not have to
 * compute a future timestamp to close it now.
 */
export function CaptureEndCard({
  slug,
  endValue,
  timeZone,
  state,
}: {
  slug: string
  endValue: string
  timeZone: string
  state: 'before' | 'open' | 'after'
}) {
  const [end, setEnd] = useState(endValue)
  const [pending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const [saved, setSaved] = useState(false)

  return (
    <div className="glass rounded-2xl px-5 py-4">
      <p className="font-medium">A fotózás vége</p>
      <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
        {state === 'before'
          ? 'A kamera még nem nyílt meg.'
          : state === 'open'
            ? 'A vendégek most fotózhatnak.'
            : 'A fotózás véget ért. Egy későbbi időpontot megadva újra megnyithatod.'}{' '}
        Időzóna: {eventTimeZoneLabel(timeZone)}.
      </p>

      {/* No visible label: the card's own heading is the question, and with one
          field left a second "Befejezés" above it would be the same words
          twice. */}
      <input
        aria-label="A fotózás vége"
        type="datetime-local"
        value={end}
        onChange={(e) => {
          setEnd(e.target.value)
          setSaved(false)
        }}
        className="glass mt-4 min-h-12 w-full rounded-xl px-4 text-sm outline-none focus:border-accent"
      />

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
