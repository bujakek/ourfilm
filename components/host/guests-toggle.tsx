'use client'

import { setGuestsCanView } from '@/app/(product)/host/events/[slug]/actions'
import { Switch } from '@/components/ui/switch'
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
  locale,
}: {
  slug: string
  canView: boolean
  locale: 'en' | 'hu'
}) {
  const en = locale === 'en'
  const [pending, startTransition] = useTransition()
  const [error, setError] = useState(false)
  // Falls back to `canView` on its own once the action settles or throws, so
  // a failed toggle returns to the truth without any rollback code here.
  const [optimisticCanView, setOptimisticCanView] = useOptimistic(canView)

  return (
    <div className="glass rounded-2xl px-5 py-4">
      <div className="flex items-center justify-between gap-4">
        <div className="min-w-0">
          <p className="font-medium">
            {en ? 'Guest gallery access' : 'Vendégek galéria-hozzáférése'}
          </p>
          <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
            {optimisticCanView
              ? en
                ? 'Guests can open the gallery after the reveal.'
                : 'A vendégek is megnyithatják a galériát a leleplezés után.'
              : en
                ? 'Only you can see the photos, including after the reveal.'
                : 'A képeket csak te látod. A vendégek a leleplezés után sem férnek hozzá.'}
          </p>
        </div>

        <Switch
          checked={optimisticCanView}
          label={en ? 'Guest gallery access' : 'Vendégek galéria-hozzáférése'}
          disabled={pending}
          onCheckedChange={(checked) =>
            startTransition(async () => {
              setError(false)
              setOptimisticCanView(checked)
              try {
                await setGuestsCanView(slug, checked)
              } catch {
                setError(true)
              }
            })
          }
        />
      </div>

      {error ? (
        <p className="mt-2 text-xs text-destructive">
          {en ? 'Could not save changes.' : 'Nem sikerült módosítani.'}
        </p>
      ) : null}
    </div>
  )
}
