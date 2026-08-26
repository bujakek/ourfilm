'use client'

import { deleteEvent } from '@/app/host/events/[slug]/actions'
import { HOST_DELETE_COPY } from '@/lib/legal/copy/forms'
import { Loader2, Trash2, TriangleAlert } from 'lucide-react'
import { useEffect, useRef, useState, useTransition } from 'react'

/**
 * Permanent deletion, behind a typed confirmation.
 *
 * A native `<dialog>` opened with `showModal()` rather than a hand-rolled
 * overlay: it supplies the focus trap, the inert background and
 * Escape-to-close, which is where custom modals usually get accessibility
 * wrong. Same reasoning as the guest lightbox.
 *
 * **The word has to be typed.** "Are you sure?" with a red button is a reflex
 * test, and this is the one action in the product that destroys other people's
 * photographs — a roomful of guests' evening, not the host's own file. Typing
 * TÖRLÉS is three seconds that cannot be spent by muscle memory.
 *
 * The dialog also states what is about to go: the event name and the photo
 * count. "Are you sure?" on its own tells you nothing about the scale of what
 * you are agreeing to.
 *
 * This deletes. It is not the moderation control — hiding a photo lives in the
 * moderation grid, says "rejtve", and leaves the file in place. Nothing in
 * this component describes hidden content as deleted, or the reverse.
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
  const [confirmation, setConfirmation] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()

  useEffect(() => {
    const dialog = dialogRef.current
    if (!dialog) return
    if (open && !dialog.open) dialog.showModal()
    if (!open && dialog.open) dialog.close()
  }, [open])

  // Case-sensitive and exact. A lowercase "törlés" is a different string, and
  // accepting it would quietly turn the typed confirmation back into a reflex.
  const confirmed = confirmation.trim() === HOST_DELETE_COPY.confirmWord

  const close = () => {
    setOpen(false)
    setConfirmation('')
  }

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
          close()
        }
      }
    })

  return (
    <section className="print-hidden mt-12 rounded-2xl border border-destructive/30 px-5 py-4">
      <h2 className="font-semibold text-destructive">
        {HOST_DELETE_COPY.heading}
      </h2>
      <p className="mt-2 text-sm leading-relaxed text-pretty text-muted-foreground">
        {HOST_DELETE_COPY.body}
      </p>

      {error ? <p className="mt-3 text-sm text-destructive">{error}</p> : null}

      <button
        type="button"
        onClick={() => setOpen(true)}
        className="mt-4 inline-flex min-h-11 items-center gap-2 rounded-full border border-destructive/40 px-5 text-sm font-semibold text-destructive"
      >
        <Trash2 className="size-4" />
        {HOST_DELETE_COPY.submit}
      </button>

      <dialog
        ref={dialogRef}
        aria-labelledby="delete-title"
        onCancel={(e) => {
          e.preventDefault()
          if (!pending) close()
        }}
        // A native dialog does not dismiss on a backdrop click; clicks out
        // there land on the dialog element itself, so this is the check.
        // Dismissing is the safe outcome for a destructive prompt.
        onClick={(e) => {
          if (e.target === dialogRef.current && !pending) close()
        }}
        onClose={close}
        className="glass-strong m-auto w-[calc(100%-2rem)] max-w-sm rounded-3xl p-6 text-foreground backdrop:bg-black/80 backdrop:backdrop-blur-sm"
      >
        <div className="flex flex-col items-center gap-3 text-center">
          <span className="flex size-14 items-center justify-center rounded-full bg-destructive/15">
            <TriangleAlert
              className="size-7 text-destructive"
              strokeWidth={2}
            />
          </span>
          <h3 id="delete-title" className="text-lg font-semibold text-balance">
            {HOST_DELETE_COPY.heading}
          </h3>
          <p className="text-sm leading-relaxed text-pretty text-muted-foreground">
            {photoCount > 0
              ? `Az „${eventName}” esemény és mind a ${photoCount} feltöltött kép véglegesen törlődik.`
              : `Az „${eventName}” esemény véglegesen törlődik.`}{' '}
            {HOST_DELETE_COPY.body}
          </p>

          <label className="mt-2 flex w-full flex-col gap-2 text-left">
            <span className="text-sm font-medium">
              {HOST_DELETE_COPY.confirmLabel}
            </span>
            <input
              value={confirmation}
              onChange={(e) => setConfirmation(e.target.value)}
              disabled={pending}
              // Autocorrect and autocapitalise both fight a typed confirmation
              // word on a phone, which is where a host will be standing.
              autoCapitalize="characters"
              autoCorrect="off"
              spellCheck={false}
              aria-label={HOST_DELETE_COPY.confirmLabel}
              className="glass min-h-12 w-full rounded-2xl px-4 text-base outline-none focus:border-destructive"
            />
          </label>

          <div className="mt-3 flex w-full flex-col gap-2">
            <button
              type="button"
              disabled={pending || !confirmed}
              onClick={confirmDelete}
              className="inline-flex min-h-12 items-center justify-center gap-2 rounded-full bg-destructive/90 px-5 text-sm font-semibold text-white disabled:opacity-40"
            >
              {pending ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <Trash2 className="size-4" />
              )}
              {HOST_DELETE_COPY.submit}
            </button>
            <button
              type="button"
              disabled={pending}
              // Cancel holds focus on open, so Enter dismisses rather than
              // deletes. Escape and a backdrop click reach the same place.
              autoFocus
              onClick={close}
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
