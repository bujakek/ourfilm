'use client'

import { setUploadDeadline } from '@/app/admin/events/[slug]/actions'
import { Loader2 } from 'lucide-react'
import { useState, useTransition } from 'react'

/**
 * Moves the upload deadline after the fact.
 *
 * This is the other half of making the deadline required at creation: a host
 * who picks a time a week out and then watches the party run past it needs a
 * way out that is not "create the event again and reprint the QR-kód". Setting
 * a time in the past is the deliberate way to close an album early.
 *
 * No optimistic state here, unlike the toggle next to it. The value only means
 * anything once the server has read it in the event's zone, and a field that
 * shows the typed text while the saved answer is an hour off would be lying
 * about the one thing it exists to display.
 */
export function DeadlineCard({
  slug,
  value,
  state,
}: {
  slug: string
  value: string
  /** `none` is only reachable for events created before the deadline was
   *  required — those really do accept uploads forever, and saying so is the
   *  point of the third state. */
  state: 'open' | 'closed' | 'none'
}) {
  const [pending, startTransition] = useTransition()
  const [local, setLocal] = useState(value)
  const [error, setError] = useState(false)
  const [saved, setSaved] = useState(false)

  // An event with no deadline yet is pre-filled with a suggestion, so the
  // field differs from the saved answer (there isn't one) from the first
  // render — the button has to be live before anything is typed.
  const dirty = state === 'none' || local !== value

  return (
    <div className="glass rounded-2xl px-5 py-4">
      <p className="font-medium">Feltöltési határidő</p>
      <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
        {state === 'closed'
          ? 'A feltöltési határidő lejárt. A vendégek látják a közös albumot, de már nem tölthetnek fel — állíts be későbbi időpontot, ha újra megnyitnád.'
          : state === 'none'
            ? 'Nincs feltöltési határidő: a vendégek bármeddig tölthetnek fel. Adj meg egy időpontot, ha le szeretnéd zárni.'
            : 'Eddig az időpontig tölthetnek fel képeket a vendégek. A közös album ezután is megmarad.'}
      </p>

      <div className="mt-3 flex flex-col gap-2 sm:flex-row">
        <label htmlFor="uploads_close_at" className="sr-only">
          Feltöltési határidő
        </label>
        <input
          id="uploads_close_at"
          type="datetime-local"
          value={local}
          onChange={(e) => {
            setLocal(e.target.value)
            setError(false)
            setSaved(false)
          }}
          className="glass min-h-12 flex-1 rounded-xl px-4 text-sm outline-none focus:border-accent"
        />
        <button
          type="button"
          disabled={pending || !dirty || !local}
          onClick={() =>
            startTransition(async () => {
              setError(false)
              try {
                await setUploadDeadline(slug, local)
                setSaved(true)
              } catch {
                setError(true)
              }
            })
          }
          className="glass glass-hover inline-flex min-h-12 items-center justify-center gap-2 rounded-xl px-5 text-sm font-semibold disabled:opacity-40"
        >
          {pending ? <Loader2 className="size-4 animate-spin" /> : null}
          Változtatások mentése
        </button>
      </div>

      {error ? (
        <p className="text-destructive mt-2 text-xs">
          Nem sikerült módosítani.
        </p>
      ) : null}
      {saved && local === value ? (
        <p className="mt-2 text-xs text-muted-foreground">
          A beállításokat elmentettük.
        </p>
      ) : null}
    </div>
  )
}
