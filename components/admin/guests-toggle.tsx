'use client'

import { setGuestsCanView } from '@/app/admin/events/[slug]/actions'
import { cn } from '@/lib/utils'
import { useOptimistic, useState, useTransition } from 'react'

/**
 * Whether guests may open the album once it develops.
 *
 * This is not the reveal. The reveal is a moment in time; this is a permission
 * that outlives it — switch it off and the album develops for the host alone,
 * permanently, no matter how long guests wait. The copy has to keep those two
 * apart, because "the gallery is closed" is true in both cases for very
 * different reasons.
 *
 * Capture is unaffected either way: guests keep shooting into an album they
 * cannot browse, which is a legitimate way to run a wedding.
 *
 * The switch moves on the tap rather than on the response. A toggle that sits
 * still for a round trip is one a host taps twice, and the second tap puts it
 * back where it started.
 */
export function GuestsToggle({
  slug,
  canView,
}: {
  slug: string
  canView: boolean
}) {
  const [pending, startTransition] = useTransition()
  const [error, setError] = useState(false)
  // Falls back to `canView` on its own once the action settles or throws, so
  // a failed toggle returns to the truth without any rollback code here.
  const [optimisticCanView, setOptimisticCanView] = useOptimistic(canView)

  return (
    <div className="glass rounded-2xl px-5 py-4">
      <div className="flex items-center justify-between gap-4">
        <div className="min-w-0">
          <p className="font-medium">Vendégek galéria-hozzáférése</p>
          <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
            {optimisticCanView
              ? 'A vendégek is megnyithatják a galériát a leleplezés után.'
              : 'A képeket csak te látod. A vendégek a leleplezés után sem férnek hozzá.'}
          </p>
        </div>

        <button
          type="button"
          role="switch"
          aria-checked={optimisticCanView}
          aria-label="Vendégek galéria-hozzáférése"
          disabled={pending}
          onClick={() =>
            startTransition(async () => {
              setError(false)
              setOptimisticCanView(!optimisticCanView)
              try {
                await setGuestsCanView(slug, !optimisticCanView)
              } catch {
                setError(true)
              }
            })
          }
          className={cn(
            'relative inline-flex h-8 w-14 shrink-0 items-center rounded-full transition-colors disabled:opacity-70',
            optimisticCanView ? 'bg-accent/70' : 'bg-white/10',
          )}
        >
          <span
            className={cn(
              'absolute size-6 rounded-full bg-white transition-transform',
              optimisticCanView ? 'translate-x-7' : 'translate-x-1',
            )}
          />
        </button>
      </div>

      {error ? (
        <p className="mt-2 text-xs text-destructive">
          Nem sikerült módosítani.
        </p>
      ) : null}
    </div>
  )
}
