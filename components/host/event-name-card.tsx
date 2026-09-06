'use client'

import { useState, useTransition } from 'react'

import { renameEvent } from '@/app/(product)/host/events/[slug]/actions'
import { Button } from '@/components/ui/button'
import { inputClassName } from '@/components/ui/input'
import { EVENT_NAME_MAX_LENGTH, eventNameProblem } from '@/lib/camera'

/**
 * Rename the event.
 *
 * The first card on the page, because it is the plainest fact about the event
 * and the one a host is most likely to be here to fix — a name typed on a phone
 * at the start of a four-screen flow, with the wrong surname or a lowercase
 * first letter.
 *
 * **The card has to say the link does not change.** `renameEvent` writes one
 * column and leaves the slug alone, which is what keeps a printed QR code
 * working — but a host reading only "Event name" would reasonably assume the
 * address follows the label, and the moment to learn otherwise is not after the
 * cards are on the tables. Hence the line under the field, in both languages.
 *
 * Deliberately **not optimistic**, unlike the toggles beside it. Not for the
 * date cards' reason — a controlled field shows what you typed either way — but
 * because there is nothing to be optimistic about: the input is already the new
 * name, so an optimistic value would repaint the same string it was given and
 * the only honest signal left is whether it saved. So: a Save button that is
 * live exactly while there is a valid change to make, and a one-line answer
 * underneath.
 *
 * The refusals are `eventNameProblem`'s, the same function the server action
 * consults, so the button and the action cannot disagree about what a usable
 * name is. `maxLength` means `too_long` is unreachable by typing; it is here
 * for a paste, which the browser truncates silently and would otherwise save a
 * name the host did not read.
 */
export function EventNameCard({
  slug,
  name,
  locale,
}: {
  slug: string
  /** The saved name. */
  name: string
  locale: 'en' | 'hu'
}) {
  const en = locale === 'en'
  const [value, setValue] = useState(name)
  const [pending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const [saved, setSaved] = useState(false)

  const trimmed = value.trim()
  const problem = eventNameProblem(trimmed)
  // An unchanged name is not a failure to report, just nothing to do — so it
  // disables the button without colouring anything red.
  const unchanged = trimmed === name

  return (
    <div className="glass rounded-2xl px-5 py-4">
      <label htmlFor="event-name" className="font-medium">
        {en ? 'Event name' : 'Az esemény neve'}
      </label>
      <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
        {en
          ? 'What your guests see on the camera and in the gallery. The link and the QR code stay the same, so anything already printed keeps working.'
          : 'Ezt látják a vendégeid a kamerán és a galériában. A link és a QR-kód nem változik, így a már kinyomtatott kódok továbbra is működnek.'}
      </p>

      <input
        id="event-name"
        type="text"
        value={value}
        disabled={pending}
        maxLength={EVENT_NAME_MAX_LENGTH}
        autoCapitalize="sentences"
        enterKeyHint="done"
        onChange={(event) => {
          setValue(event.target.value)
          setSaved(false)
          setError(null)
        }}
        className={`mt-4 ${inputClassName}`}
      />

      <Button
        disabled={pending || unchanged || problem !== null}
        onClick={() =>
          startTransition(async () => {
            setError(null)
            try {
              await renameEvent(slug, trimmed)
              // The action trims, so this is the string that was stored.
              setValue(trimmed)
              setSaved(true)
            } catch {
              // The action's own sentences are Hungarian, and this card may be
              // rendering in English — so it writes its own refusal rather than
              // showing one in a language its reader may not have.
              setError(
                en ? 'Could not save changes.' : 'Nem sikerült módosítani.',
              )
            }
          })
        }
        className="mt-4 w-full"
      >
        {pending
          ? en
            ? 'Saving…'
            : 'Mentés…'
          : en
            ? 'Save changes'
            : 'Változtatások mentése'}
      </Button>

      {error ? (
        <p className="mt-2 text-xs text-destructive">{error}</p>
      ) : problem === 'required' ? (
        <p className="mt-2 text-xs text-muted-foreground">
          {en ? 'Give your event a name.' : 'Adj nevet az eseménynek.'}
        </p>
      ) : saved ? (
        <p className="mt-2 text-xs text-accent">
          {en ? 'Saved.' : 'Elmentettük.'}
        </p>
      ) : null}
    </div>
  )
}
