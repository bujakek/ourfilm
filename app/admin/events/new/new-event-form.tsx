'use client'

import { Loader2, Plus } from 'lucide-react'
import { useActionState, useState } from 'react'
import { createEvent, type CreateEventState } from './actions'

const initial: CreateEventState = { error: null }

/** Event types rather than personalised titles: we have no host name to
 *  interpolate, and a type is a usable title on its own. The point is removing
 *  the blank-field pause, not writing the name for them. */
const SUGGESTIONS = [
  'Esküvő',
  'Születésnap',
  'Céges rendezvény',
  'Ballagás',
  'Évforduló',
]

/**
 * Two questions: what the event is called, and when it stops taking photos.
 *
 * The deadline is **required and pre-filled**, which is the whole point of the
 * field. It used to be optional alongside a separate, also optional event
 * date — and an optional deadline is one nobody sets, which left every album
 * open forever. Asking for the end instead of the start is what makes one
 * question do the job: uploads open the moment the event exists, so the start
 * is not a thing a host can tell us anything useful about.
 */
export function NewEventForm({
  suggestedCloses,
  earliestCloses,
}: {
  suggestedCloses: string
  earliestCloses: string
}) {
  const [state, action, pending] = useActionState(createEvent, initial)
  const [name, setName] = useState('')

  return (
    <form action={action} className="flex flex-col gap-5">
      <div>
        <label
          htmlFor="event_name"
          className="mb-2 block text-sm text-muted-foreground"
        >
          Az esemény neve
        </label>
        <input
          id="event_name"
          name="event_name"
          required
          maxLength={80}
          autoFocus
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Például: Anna és Péter esküvője"
          className="glass min-h-14 w-full rounded-2xl px-5 text-base outline-none placeholder:text-muted-foreground/60 focus:border-accent"
        />

        <p className="mt-4 mb-2 text-sm text-muted-foreground">
          Milyen eseményhez készül az album?
        </p>
        <ul className="flex flex-wrap gap-2">
          {SUGGESTIONS.map((suggestion) => (
            <li key={suggestion}>
              <button
                type="button"
                onClick={() => setName(suggestion)}
                className="glass glass-hover min-h-11 rounded-full px-4 text-sm text-muted-foreground transition-colors hover:text-foreground"
              >
                {suggestion}
              </button>
            </li>
          ))}
        </ul>
      </div>

      <div>
        <label
          htmlFor="uploads_close_at"
          className="mb-2 block text-sm text-muted-foreground"
        >
          Meddig tölthetnek fel a vendégek?
        </label>
        <input
          id="uploads_close_at"
          name="uploads_close_at"
          type="datetime-local"
          required
          defaultValue={suggestedCloses}
          min={earliestCloses}
          className="glass min-h-14 w-full rounded-2xl px-5 text-base outline-none focus:border-accent"
        />
        {/* Says the album stays — it does. Nothing in the product deletes an
            event when its deadline passes; only the host can. */}
        <p className="mt-2 text-xs leading-relaxed text-muted-foreground">
          A feltöltés az esemény létrehozása után azonnal elindul. A határidőt
          később is módosíthatod, és a közös album utána is megmarad.
        </p>
      </div>

      {state.error ? (
        <p className="text-destructive text-sm">{state.error}</p>
      ) : null}

      <button
        type="submit"
        disabled={pending}
        className="btn-shine inline-flex min-h-14 items-center justify-center gap-2 rounded-full bg-primary px-7 text-base font-semibold text-primary-foreground disabled:opacity-60"
      >
        {pending ? (
          <Loader2 className="size-5 animate-spin" />
        ) : (
          <Plus className="size-5" strokeWidth={2} />
        )}
        {pending ? 'Létrehozás…' : 'Esemény létrehozása'}
      </button>
    </form>
  )
}
