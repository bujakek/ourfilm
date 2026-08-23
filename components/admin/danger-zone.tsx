'use client'

import { deleteEvent } from '@/app/admin/events/[slug]/actions'
import { Loader2, Trash2, TriangleAlert } from 'lucide-react'
import { useEffect, useRef, useState, useTransition } from 'react'

/**
 * Permanent deletion, behind a confirmation dialog.
 *
 * A native `<dialog>` opened with `showModal()` rather than a hand-rolled
 * overlay: it supplies the focus trap, the inert background and
 * Escape-to-close, which is where custom modals usually get accessibility
 * wrong. Same reasoning as the guest lightbox.
 *
 * The dialog states what is about to go — the event name and the photo count —
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
  const dialogRef = useRef<HTMLDialogElement>(null)
  const [open, setOpen] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()

  useEffect(() => {
    const dialog = dialogRef.current
    if (!dialog) return
    if (open && !dialog.open) dialog.showModal()
    if (!open && dialog.open) dialog.close()
  }, [open])

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
    <section className="print-hidden border-destructive/30 mt-12 rounded-2xl border px-5 py-4">
      <h2 className="text-destructive font-semibold">Esemény törlése</h2>
      <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
        {photoCount > 0
          ? `Véglegesen törli az eseményt és mind a ${photoCount} feltöltött képet. Ez a művelet nem vonható vissza.`
          : 'Véglegesen törli az eseményt és az összes feltöltött képet. Ez a művelet nem vonható vissza.'}
      </p>

      {error ? <p className="text-destructive mt-3 text-sm">{error}</p> : null}

      <button
        type="button"
        onClick={() => setOpen(true)}
        className="border-destructive/40 text-destructive mt-4 inline-flex min-h-11 items-center gap-2 rounded-full border px-5 text-sm font-semibold"
      >
        <Trash2 className="size-4" />
        Esemény végleges törlése
      </button>

      <dialog
        ref={dialogRef}
        aria-labelledby="delete-title"
        onCancel={(e) => {
          e.preventDefault()
          if (!pending) setOpen(false)
        }}
        // A native dialog does not dismiss on a backdrop click; clicks out
        // there land on the dialog element itself, so this is the check.
        // Dismissing is the safe outcome for a destructive prompt.
        onClick={(e) => {
          if (e.target === dialogRef.current && !pending) setOpen(false)
        }}
        onClose={() => setOpen(false)}
        className="glass-strong m-auto w-[calc(100%-2rem)] max-w-sm rounded-3xl p-6 text-foreground backdrop:bg-black/80 backdrop:backdrop-blur-sm"
      >
        <div className="flex flex-col items-center gap-3 text-center">
          <span className="bg-destructive/15 flex size-14 items-center justify-center rounded-full">
            <TriangleAlert
              className="text-destructive size-7"
              strokeWidth={2}
            />
          </span>
          <h3 id="delete-title" className="text-lg font-semibold text-balance">
            Biztosan törlöd az eseményt?
          </h3>
          <p className="text-sm leading-relaxed text-pretty text-muted-foreground">
            {photoCount > 0
              ? `Az „${eventName}” esemény és mind a ${photoCount} feltöltött kép véglegesen törlődik. Ezt később nem lehet visszavonni.`
              : `Az „${eventName}” esemény véglegesen törlődik. Ezt később nem lehet visszavonni.`}
          </p>

          <div className="mt-3 flex w-full flex-col gap-2">
            <button
              type="button"
              disabled={pending}
              onClick={confirmDelete}
              className="bg-destructive/90 inline-flex min-h-12 items-center justify-center gap-2 rounded-full px-5 text-sm font-semibold text-white disabled:opacity-60"
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
              // Cancel holds focus on open, so Enter dismisses rather than
              // deletes. Escape and a backdrop click reach the same place.
              autoFocus
              onClick={() => setOpen(false)}
              className="glass glass-hover inline-flex min-h-12 items-center justify-center rounded-full px-5 text-sm font-medium"
            >
              Mégse
            </button>
          </div>
        </div>
      </dialog>
    </section>
  )
}
