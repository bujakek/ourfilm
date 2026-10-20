'use client'

import { setGuestsCanView } from '@/app/(product)/host/events/[slug]/actions'
import { useSettingsSave } from '@/components/host/settings-save'
import {
  HOST_PANEL,
  HOST_ROW_DETAIL,
  HOST_ROW_QUESTION,
} from '@/components/host/ui/classes'
import { Switch } from '@/components/ui/switch'
import { useOptimistic, useTransition } from 'react'

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
  const { report } = useSettingsSave()
  // Falls back to `canView` on its own once the action settles or throws, so
  // a failed toggle returns to the truth without any rollback code here.
  const [optimisticCanView, setOptimisticCanView] = useOptimistic(canView)

  const apply = (checked: boolean) =>
    startTransition(async () => {
      setOptimisticCanView(checked)
      try {
        await setGuestsCanView(slug, checked)
        report('ok', () => apply(checked))
      } catch {
        report('error', () => apply(checked))
      }
    })

  return (
    <section className={`${HOST_PANEL} px-5 py-2`}>
      <div className="flex min-h-[72px] items-center justify-between gap-4">
        <div className="min-w-0">
          <p className={HOST_ROW_QUESTION}>
            {en ? 'Guests can see the gallery' : 'Vendégek látják a galériát'}
          </p>
          <p className={HOST_ROW_DETAIL}>
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
          label={
            en ? 'Guests can see the gallery' : 'Vendégek látják a galériát'
          }
          disabled={pending}
          onCheckedChange={apply}
          tone="host"
        />
      </div>
    </section>
  )
}
