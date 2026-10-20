'use client'

import { deleteEvent } from '@/app/(product)/host/events/[slug]/actions'
import { Sheet } from '@/components/host/sheet'
import { Loader2, Trash2, TriangleAlert } from 'lucide-react'
import { useState, useTransition } from 'react'

import {
  HOST_FOCUS,
  HOST_PANEL,
  HOST_ROW_DETAIL,
  HOST_ROW_QUESTION,
  HOST_SECONDARY,
} from '@/components/host/ui/classes'

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
  locale,
}: {
  slug: string
  eventName: string
  photoCount: number
  locale: 'en' | 'hu'
}) {
  const en = locale === 'en'
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

  const danger = `inline-flex h-12 w-full items-center justify-center gap-2 rounded-[14px] bg-host-danger-fill px-6 text-[15px] font-medium text-host-danger transition-colors hover:bg-host-danger-fill/80 disabled:opacity-40 ${HOST_FOCUS}`

  return (
    <section className={`print-hidden ${HOST_PANEL} p-5`}>
      <h2 className={HOST_ROW_QUESTION}>
        {en ? 'Delete event' : 'Esemény törlése'}
      </h2>
      <p className={HOST_ROW_DETAIL}>
        {photoCount > 0 ? (
          en ? (
            <>
              The event and its{' '}
              <span className="host-figure text-[18px] text-white">
                {photoCount}
              </span>{' '}
              uploaded {photoCount === 1 ? 'photo' : 'photos'} are deleted for
              good. This cannot be undone.
            </>
          ) : (
            <>
              Az eseménnyel együtt{' '}
              <span className="host-figure text-[18px] text-white">
                {photoCount}
              </span>{' '}
              feltöltött kép is véglegesen törlődik. Nem vonható vissza.
            </>
          )
        ) : en ? (
          'The event is deleted for good. This cannot be undone.'
        ) : (
          'Az esemény véglegesen törlődik. Nem vonható vissza.'
        )}
      </p>

      {error ? (
        <p role="alert" className="mt-3 text-[14px] text-host-danger">
          {error}
        </p>
      ) : null}

      <button
        type="button"
        onClick={() => setOpen(true)}
        className={`mt-4 ${danger}`}
      >
        {en ? 'Delete event' : 'Esemény törlése'}
      </button>

      <Sheet
        open={open}
        onClose={() => setOpen(false)}
        closeLabel={en ? 'Cancel' : 'Mégse'}
        busy={pending}
        title={en ? 'Delete this event?' : 'Biztosan törlöd az eseményt?'}
        detail={
          photoCount > 0
            ? en
              ? `“${eventName}” and its ${photoCount} uploaded ${photoCount === 1 ? 'photo' : 'photos'} will be permanently deleted.`
              : `Az „${eventName}” esemény és ${photoCount} feltöltött kép véglegesen törlődik. Ezt később nem lehet visszavonni.`
            : en
              ? `“${eventName}” will be permanently deleted.`
              : `Az „${eventName}” esemény véglegesen törlődik. Ezt később nem lehet visszavonni.`
        }
        icon={
          <span className="flex size-12 items-center justify-center rounded-full bg-host-danger-fill">
            <TriangleAlert
              className="size-6 text-host-danger"
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
            className={danger}
          >
            {pending ? (
              <Loader2 className="size-4 animate-spin" aria-hidden="true" />
            ) : (
              <Trash2 className="size-4" aria-hidden="true" />
            )}
            {en ? 'Yes, delete permanently' : 'Igen, végleg törlöm'}
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
            className={`${HOST_SECONDARY} w-full`}
          >
            {en ? 'Cancel' : 'Mégse'}
          </button>
        </div>
      </Sheet>
    </section>
  )
}
