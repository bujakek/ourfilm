'use client'

import { useRef, useState, useTransition } from 'react'

import { renameEvent } from '@/app/(product)/host/events/[slug]/actions'
import { useSettingsSave } from '@/components/host/settings-save'
import {
  HOST_FIELD,
  HOST_PANEL,
  HOST_ROW_DETAIL,
  HOST_ROW_QUESTION,
} from '@/components/host/ui/classes'
import { EVENT_NAME_MAX_LENGTH, eventNameProblem } from '@/lib/camera'
import {
  saveLedger,
  saveLedgerCommit,
  saveLedgerIssue,
  saveLedgerSettle,
} from '@/lib/host-ui'

/**
 * Rename the event.
 *
 * **The card has to say the link does not change.** `renameEvent` writes one
 * column and leaves the slug alone, which is what keeps a printed QR code
 * working — but a host reading only "Event name" would reasonably assume the
 * address follows the label, and the moment to learn otherwise is not after the
 * cards are on the tables. Hence the line under the field, in both languages.
 *
 * It saves on blur and on Enter, and only when the trimmed value differs from
 * the stored one — there is no Save button on this screen. Deliberately **not
 * optimistic**: the input already shows the new name, so there is nothing to
 * be optimistic about. On a failure the field goes back to the stored name and
 * the header's toast offers to send the same name again.
 *
 * The refusals are `eventNameProblem`'s, the same function the server action
 * consults. An empty field is never sent; leaving it restores the stored name.
 * `maxLength` means `too_long` is unreachable by typing; it is here for a
 * paste, which the browser truncates silently.
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
  const [, startTransition] = useTransition()
  const { report } = useSettingsSave()
  // The last name the server confirmed, and the saves still in flight. Saves
  // can overlap — the stored name typed back while another is still sending —
  // and an older one answering late must not overwrite a newer; the ledger
  // (`lib/host-ui.ts`) decides that. The prop catches up after the action's
  // revalidation; this does not have to wait for it.
  const ledger = useRef(saveLedger(name))

  const problem = eventNameProblem(value.trim())

  const save = (next: string) => {
    const issued = saveLedgerIssue(ledger.current, next)
    ledger.current = issued.ledger
    const { seq } = issued
    startTransition(async () => {
      let ok = true
      try {
        await renameEvent(slug, next)
      } catch {
        ok = false
      }
      const settled = saveLedgerSettle(ledger.current, seq, next, ok)
      ledger.current = settled.ledger
      // An overtaken save neither reports nor touches the field: the newer
      // one will.
      if (!settled.latest) return
      if (ok) {
        // Text typed while the save was in flight stays where it is.
        setValue((current) => (current.trim() === next ? next : current))
        report('ok', () => save(next))
        return
      }
      // Restore only if the field still shows the name that failed; a host
      // who has typed on since then keeps what they typed.
      const stored = settled.ledger.stored
      setValue((current) => (current.trim() === next ? stored : current))
      report('error', () => save(next))
    })
  }

  const commit = () => {
    const trimmed = value.trim()
    if (eventNameProblem(trimmed) !== null) {
      setValue(ledger.current.stored)
      return
    }
    const decision = saveLedgerCommit(ledger.current, trimmed)
    if (decision === 'skip') return
    if (decision === 'unchanged') {
      if (trimmed !== value) setValue(trimmed)
      return
    }
    // The action trims too, so this is the string that will be stored.
    setValue(trimmed)
    save(trimmed)
  }

  return (
    <section className={`${HOST_PANEL} p-5`}>
      <label htmlFor="event-name" className={`block ${HOST_ROW_QUESTION}`}>
        {en ? 'Event name' : 'Az esemény neve'}
      </label>
      <p id="event-name-detail" className={HOST_ROW_DETAIL}>
        {en
          ? 'What your guests see on the camera and in the gallery. The link and the QR code stay the same, so anything already printed keeps working.'
          : 'Ezt látják a vendégeid a kamerán és a galériában. A link és a QR-kód nem változik, így a már kinyomtatott kódok továbbra is működnek.'}
      </p>

      <input
        id="event-name"
        type="text"
        value={value}
        maxLength={EVENT_NAME_MAX_LENGTH}
        autoCapitalize="sentences"
        enterKeyHint="done"
        aria-describedby="event-name-detail"
        onChange={(event) => setValue(event.target.value)}
        onBlur={commit}
        onKeyDown={(event) => {
          // Enter commits through blur, so a save is sent once whichever way
          // the host leaves the field.
          if (event.key === 'Enter') {
            event.preventDefault()
            event.currentTarget.blur()
          }
        }}
        className={`mt-3 ${HOST_FIELD}`}
      />

      {problem === 'required' ? (
        <p className="mt-2 text-[13px] text-white/65">
          {en ? 'Give your event a name.' : 'Adj nevet az eseménynek.'}
        </p>
      ) : null}
    </section>
  )
}
