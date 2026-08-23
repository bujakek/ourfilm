'use client'

import { setGalleryHidden } from '@/app/admin/events/[slug]/actions'
import { cn } from '@/lib/utils'
import { useOptimistic, useState, useTransition } from 'react'

/**
 * Opens and closes the gallery to guests. Uploads are unaffected either way,
 * which the copy has to say plainly — "hidden" reads like "closed" otherwise,
 * and a host who wants a reveal at the end of the night needs to know guests
 * can still contribute while it is off.
 *
 * The switch moves on the tap rather than on the response. A toggle that sits
 * still for a round trip is one a host taps twice, and the second tap puts the
 * gallery back where it started.
 */
export function GalleryToggle({
  slug,
  hidden,
}: {
  slug: string
  hidden: boolean
}) {
  const [pending, startTransition] = useTransition()
  const [error, setError] = useState(false)
  // Falls back to `hidden` on its own once the action settles or throws, so
  // a failed toggle returns to the truth without any rollback code here.
  const [optimisticHidden, setOptimisticHidden] = useOptimistic(hidden)

  return (
    <div className="glass rounded-2xl px-5 py-4">
      <div className="flex items-center justify-between gap-4">
        <div className="min-w-0">
          <p className="font-medium">Album megjelenítése a vendégeknek</p>
          <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
            {optimisticHidden
              ? 'A vendégek feltölthetnek képeket, de a közös albumot nem látják.'
              : 'A vendégek megnyithatják és megnézhetik a közös albumot.'}
          </p>
        </div>

        <button
          type="button"
          role="switch"
          aria-checked={!optimisticHidden}
          aria-label="Album megjelenítése a vendégeknek"
          disabled={pending}
          onClick={() =>
            startTransition(async () => {
              setError(false)
              setOptimisticHidden(!optimisticHidden)
              try {
                await setGalleryHidden(slug, !optimisticHidden)
              } catch {
                setError(true)
              }
            })
          }
          className={cn(
            'relative inline-flex h-8 w-14 shrink-0 items-center rounded-full transition-colors disabled:opacity-70',
            optimisticHidden ? 'bg-white/10' : 'bg-accent/70',
          )}
        >
          <span
            className={cn(
              'absolute size-6 rounded-full bg-white transition-transform',
              optimisticHidden ? 'translate-x-1' : 'translate-x-7',
            )}
          />
        </button>
      </div>

      {error ? (
        <p className="text-destructive mt-2 text-xs">
          Nem sikerült módosítani.
        </p>
      ) : null}
    </div>
  )
}
