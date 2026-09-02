'use client'

import { Sheet } from '@/components/host/sheet'
import { Button } from '@/components/ui/button'
import type { Locale } from '@/lib/i18n'

/**
 * Offers back an unfinished event found on this device.
 *
 * Shown only when the draft actually holds answers — restoring an untouched
 * form is an interruption that asks a question with no wrong answer, which is
 * the worst kind. No close button: the two buttons are the whole decision, and
 * dismissing it would leave the form in a state that matches neither.
 */
export function DraftRestoreDialog({
  open,
  onResume,
  onDiscard,
  locale = 'hu',
}: {
  open: boolean
  onResume: () => void
  onDiscard: () => void
  locale?: Locale
}) {
  const en = locale === 'en'
  return (
    <Sheet
      open={open}
      title={en ? 'Continue your event?' : 'Folytatod az eseményed?'}
      detail={
        en
          ? 'We found an unfinished event on this device.'
          : 'Találtunk egy korábban elkezdett eseményt ezen az eszközön.'
      }
    >
      <div className="flex flex-col gap-2.5">
        <Button type="button" onClick={onResume} size="lg" className="w-full">
          {en ? 'Continue' : 'Folytatás'}
        </Button>
        <Button
          type="button"
          onClick={onDiscard}
          variant="secondary"
          size="lg"
          className="w-full"
        >
          {en ? 'Start over' : 'Újrakezdés'}
        </Button>
      </div>
    </Sheet>
  )
}
