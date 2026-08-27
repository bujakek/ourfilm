'use client'

import { X } from 'lucide-react'
import { useEffect, useRef, type ReactNode } from 'react'

/**
 * The sheet every host-area interruption is drawn in.
 *
 * A real `<dialog>` rather than a div with a high z-index: the browser gives
 * modality, focus trapping, Escape, and inertness of everything behind it for
 * free, and every hand-rolled version of that list is missing at least one of
 * them. `showModal()` is called from an effect because the element has to exist
 * before it can be opened.
 *
 * Anchored to the bottom on a phone and centred from `sm:` up — these arrive
 * under a thumb that is already at the bottom of the screen, reaching for a
 * button.
 *
 * It is also the only container wide enough for `MonthCalendar`. That grid is
 * seven 44px cells, so it needs 308px; a settings card at 390px has about 302
 * after the page and card padding, and squeezes it. `max-w-md` with `p-6`
 * gives it 342 — which is why the settings date picker opens a sheet rather
 * than expanding in place.
 */
export function Sheet({
  open,
  onClose,
  title,
  detail,
  children,
  /** Omitted for a sheet that must be answered — the restore prompt has two
   *  buttons and no third "neither" option. */
  closeLabel,
}: {
  open: boolean
  onClose?: () => void
  title: string
  detail: string
  children: ReactNode
  closeLabel?: string
}) {
  const ref = useRef<HTMLDialogElement>(null)

  useEffect(() => {
    const el = ref.current
    if (!el) return
    if (open && !el.open) el.showModal()
    if (!open && el.open) el.close()
  }, [open])

  return (
    <dialog
      ref={ref}
      // Escape closes a <dialog> natively and does not run onClose, which would
      // leave the caller thinking the sheet is still open.
      onCancel={(event) => {
        event.preventDefault()
        if (closeLabel) onClose?.()
      }}
      className="glass-overlay mx-auto mt-auto mb-0 w-full max-w-md rounded-t-3xl p-6 pb-[calc(1.5rem+env(safe-area-inset-bottom))] text-foreground backdrop:bg-black/70 sm:my-auto sm:rounded-3xl sm:pb-6"
    >
      <div className="flex items-start gap-4">
        <div className="min-w-0 flex-1">
          <h2 className="font-display text-xl font-semibold tracking-tight text-balance">
            {title}
          </h2>
          <p className="mt-2 text-sm leading-relaxed text-pretty text-muted-foreground">
            {detail}
          </p>
        </div>
        {closeLabel ? (
          <button
            type="button"
            onClick={onClose}
            aria-label={closeLabel}
            className="glass -mt-1 flex size-10 shrink-0 items-center justify-center rounded-[0.875rem]"
          >
            <X className="size-4" aria-hidden="true" />
          </button>
        ) : null}
      </div>

      <div className="mt-5">{children}</div>
    </dialog>
  )
}
