'use client'

import { deleteEvent } from '@/app/(product)/host/events/[slug]/actions'
import { Sheet } from '@/components/host/sheet'
import { Loader2, Trash2, TriangleAlert } from 'lucide-react'
import { useState, useTransition } from 'react'
import { Button } from '@/components/ui/button'

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

  return (
    <section className="print-hidden mt-12 rounded-2xl border border-destructive/30 px-5 py-4">
      <h2 className="font-semibold text-destructive">
        {en ? 'Delete event' : 'Esemény törlése'}
      </h2>
      <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
        {photoCount > 0
          ? en
            ? `Permanently deletes the event and all ${photoCount} uploaded photos. This cannot be undone.`
            : `Véglegesen törli az eseményt és mind a ${photoCount} feltöltött képet. Ez a művelet nem vonható vissza.`
          : en
            ? 'Permanently deletes the event and all uploaded photos. This cannot be undone.'
            : 'Véglegesen törli az eseményt és az összes feltöltött képet. Ez a művelet nem vonható vissza.'}
      </p>

      {error ? <p className="mt-3 text-sm text-destructive">{error}</p> : null}

      <Button
        type="button"
        onClick={() => setOpen(true)}
        variant="destructive-outline"
        size="sm"
        className="mt-4"
      >
        <Trash2 className="size-4" />
        {en ? 'Permanently delete event' : 'Esemény végleges törlése'}
      </Button>

      <Sheet
        open={open}
        onClose={() => setOpen(false)}
        closeLabel={en ? 'Cancel' : 'Mégse'}
        busy={pending}
        title={en ? 'Delete this event?' : 'Biztosan törlöd az eseményt?'}
        detail={
          photoCount > 0
            ? en
              ? `“${eventName}” and all ${photoCount} uploaded photos will be permanently deleted.`
              : `Az „${eventName}” esemény és mind a ${photoCount} feltöltött kép véglegesen törlődik. Ezt később nem lehet visszavonni.`
            : en
              ? `“${eventName}” will be permanently deleted.`
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
          <Button
            type="button"
            disabled={pending}
            onClick={confirmDelete}
            variant="destructive"
            className="w-full"
          >
            {pending ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <Trash2 className="size-4" />
            )}
            {en ? 'Yes, delete permanently' : 'Igen, végleg törlöm'}
          </Button>
          <Button
            type="button"
            disabled={pending}
            // Enter must never be the delete. `autoFocus` asks for this
            // button, and the sheet's own close button is first in the DOM
            // either way — so both candidates for initial focus dismiss, and
            // neither of them is "Igen, végleg törlöm".
            autoFocus
            onClick={() => setOpen(false)}
            variant="secondary"
            className="w-full"
          >
            {en ? 'Cancel' : 'Mégse'}
          </Button>
        </div>
      </Sheet>
    </section>
  )
}
