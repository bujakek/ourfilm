'use client'

import { deleteEvent } from '@/app/host/events/[slug]/actions'
import { Sheet } from '@/components/host/sheet'
import { Loader2, Trash2, TriangleAlert } from 'lucide-react'
import { useState, useTransition } from 'react'

/**
 * Permanent deletion, behind a confirmation sheet.
 *
 * The shared `Sheet` rather than its own `<dialog>`, like every other host-area
 * interruption. It keeps what a native dialog gives — focus trap, inert
 * background, Escape — and stops maintaining a fourth copy of the open/close
 * effect and the backdrop-click check.
 *
 * Two things it needed from `Sheet` and got: the warning triangle above the
 * heading, and `busy`, which closes every way out while the delete is in
 * flight. Half-cancelling an irreversible action is the one interaction here
 * that must not be possible.
 *
 * The sheet states what is about to go — the event name and the photo count —
 * because "are you sure?" on its own tells you nothing about the scale of what
 * you are agreeing to. This is the only irreversible action in the product.
 */
export function DangerZone({
  slug,
  eventName,
  photoCount,
}: {
  slug: string
  eventName: string
  photoCount: number
}) {
  const [open, setOpen] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()

  const confirmDelete = () =>
    startTransition(async () => {
      setError(null)
      try {
        await deleteEvent(slug)
      } catch (e) {
        // redirect() signals by throwing, so only a real failure carries a
        // message worth showing.
        const message = e instanceof Error ? e.message : ''
        if (message) {
          setError(message)
          setOpen(false)
        }
      }
    })

  return (
    <section className="print-hidden mt-12 rounded-2xl border border-destructive/30 px-5 py-4">
      <h2 className="font-semibold text-destructive">Esemény törlése</h2>
      <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
        {photoCount > 0
          ? `Véglegesen törli az eseményt és mind a ${photoCount} feltöltött képet. Ez a művelet nem vonható vissza.`
          : 'Véglegesen törli az eseményt és az összes feltöltött képet. Ez a művelet nem vonható vissza.'}
      </p>

      {error ? <p className="mt-3 text-sm text-destructive">{error}</p> : null}

      <button
        type="button"
        onClick={() => setOpen(true)}
        className="mt-4 inline-flex min-h-11 items-center gap-2 rounded-full border border-destructive/40 px-5 text-sm font-semibold text-destructive"
      >
        <Trash2 className="size-4" />
        Esemény végleges törlése
      </button>

      <Sheet
        open={open}
        onClose={() => setOpen(false)}
        closeLabel="Mégse"
        busy={pending}
        title="Biztosan törlöd az eseményt?"
        detail={
          photoCount > 0
            ? `Az „${eventName}” esemény és mind a ${photoCount} feltöltött kép véglegesen törlődik. Ezt később nem lehet visszavonni.`
            : `Az „${eventName}” esemény véglegesen törlődik. Ezt később nem lehet visszavonni.`
        }
        icon={
          <span className="flex size-12 items-center justify-center rounded-full bg-destructive/15">
            <TriangleAlert
              className="size-6 text-destructive"
              strokeWidth={2}
            />
          </span>
        }
      >
        <div className="flex flex-col gap-2">
          <button
            type="button"
            disabled={pending}
            onClick={confirmDelete}
            className="inline-flex min-h-12 items-center justify-center gap-2 rounded-full bg-destructive/90 px-5 text-sm font-semibold text-white disabled:opacity-60"
          >
            {pending ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <Trash2 className="size-4" />
            )}
            Igen, végleg törlöm
          </button>
          <button
            type="button"
            disabled={pending}
            // Enter must never be the delete. `autoFocus` asks for this
            // button, and the sheet's own close button is first in the DOM
            // either way — so both candidates for initial focus dismiss, and
            // neither of them is "Igen, végleg törlöm".
            autoFocus
            onClick={() => setOpen(false)}
            className="glass glass-hover inline-flex min-h-12 items-center justify-center rounded-full px-5 text-sm font-medium disabled:opacity-60"
          >
            Mégse
          </button>
        </div>
      </Sheet>
    </section>
  )
}
