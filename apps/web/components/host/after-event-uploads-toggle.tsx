'use client'

import { useOptimistic, useState, useTransition } from 'react'

import { setAfterEventUploadsEnabled } from '@/app/(product)/host/events/[slug]/actions'
import { Switch } from '@/components/ui/switch'

/**
 * Let existing guests spend the remainder of their roll from their photo
 * library during the day after the camera closes.
 *
 * The switch is optimistic for the same reason as gallery access: the value is
 * a boolean a host can verify at a glance, and a failed action falls back to
 * the server prop without hand-written rollback state.
 */
export function AfterEventUploadsToggle({
  slug,
  enabled,
  locale,
}: {
  slug: string
  enabled: boolean
  locale: 'en' | 'hu'
}) {
  const en = locale === 'en'
  const [pending, startTransition] = useTransition()
  const [error, setError] = useState(false)
  const [optimisticEnabled, setOptimisticEnabled] = useOptimistic(enabled)

  return (
    <div className="glass rounded-2xl px-5 py-4">
      <div className="flex items-center justify-between gap-4">
        <div className="min-w-0">
          <p className="font-medium">
            {en ? 'Uploads after the event' : 'Feltöltés az esemény után'}
          </p>
          <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
            {optimisticEnabled
              ? en
                ? 'For 24 hours after closing, existing guests can add library photos using their remaining frames.'
                : 'A lezárás után 24 órán át a már csatlakozott vendégek a megmaradt képkockáikra tölthetnek fel képeket a telefonjuk fotótárából.'
              : en
                ? 'Uploads stop when the camera closes.'
                : 'A feltöltés a kamerával együtt lezárul.'}
          </p>
        </div>

        <Switch
          checked={optimisticEnabled}
          label={en ? 'Uploads after the event' : 'Feltöltés az esemény után'}
          disabled={pending}
          onCheckedChange={(checked) =>
            startTransition(async () => {
              setError(false)
              setOptimisticEnabled(checked)
              try {
                await setAfterEventUploadsEnabled(slug, checked)
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
