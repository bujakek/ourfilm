'use client'

import { Eye, Loader2 } from 'lucide-react'
import { useEffect, useRef, useState, useTransition } from 'react'

import { revealNow } from '@/app/admin/events/[slug]/actions'

/**
 * Open the gallery now, ahead of whatever the reveal was set to.
 *
 * Behind a confirmation for the same reason deletion is: it is not undoable in
 * any meaningful sense. The reveal instant can be pushed back afterwards, but
 * the guests who were watching have already seen the photos, and no database
 * write takes that back.
 *
 * A native `<dialog>` with `showModal()` rather than a hand-rolled overlay — it
 * supplies the focus trap, the inert background and Escape-to-close, which is
 * where custom modals usually get accessibility wrong. Same pattern as
 * `danger-zone.tsx`.
 *
 * The description hedges on guest visibility on purpose. This action moves the
 * reveal and nothing else; if `guests_can_view` is off, guests still see
 * nothing, and promising otherwise would be a lie the host discovers from
 * someone at the party.
 */
export function RevealNowButton({
  slug,
  guestsCanView,
}: {
  slug: string
  guestsCanView: boolean
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

  return (
    <>
      <button
        type="button"
        onClick={() => {
          setError(null)
          setOpen(true)
        }}
        className="glass glass-hover inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-full px-6 text-sm font-semibold"
      >
        <Eye className="size-4 text-accent" strokeWidth={1.8} />
        Galéria megnyitása most
      </button>

      <dialog
        ref={dialogRef}
        onClose={() => setOpen(false)}
        className="glass-strong m-auto w-[calc(100%-2rem)] max-w-sm rounded-3xl p-6 text-foreground backdrop:bg-black/70 backdrop:backdrop-blur-sm"
      >
        <h3 className="text-lg font-semibold text-balance">
          Biztosan megnyitod a galériát?
        </h3>
        <p className="mt-2 text-sm leading-relaxed text-pretty text-muted-foreground">
          Ha folytatod, a vendégek azonnal láthatják a képeket, amennyiben a
          vendéggaléria engedélyezve van.
        </p>

        {!guestsCanView ? (
          <p className="mt-3 text-xs leading-relaxed text-muted-foreground">
            Nálad most ki van kapcsolva, így egyelőre csak te fogod látni őket.
          </p>
        ) : null}

        {error ? (
          <p className="text-destructive mt-3 text-sm">{error}</p>
        ) : null}

        <div className="mt-6 flex flex-col gap-2">
          <button
            type="button"
            disabled={pending}
            onClick={() =>
              startTransition(async () => {
                setError(null)
                try {
                  await revealNow(slug)
                  setOpen(false)
                } catch (e) {
                  setError(
                    e instanceof Error ? e.message : 'Nem sikerült megnyitni.',
                  )
                }
              })
            }
            className="inline-flex min-h-12 items-center justify-center gap-2 rounded-full bg-primary px-6 text-sm font-semibold text-primary-foreground disabled:opacity-60"
          >
            {pending ? <Loader2 className="size-4 animate-spin" /> : null}
            Galéria megnyitása
          </button>
          {/* Cancel holds focus: the dialog opens on the safe answer. */}
          <button
            type="button"
            autoFocus
            disabled={pending}
            onClick={() => setOpen(false)}
            className="glass glass-hover inline-flex min-h-12 items-center justify-center rounded-full px-6 text-sm font-semibold"
          >
            Mégsem
          </button>
        </div>
      </dialog>
    </>
  )
}
