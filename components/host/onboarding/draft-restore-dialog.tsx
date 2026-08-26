'use client'

import { OnboardingDialog } from './onboarding-dialog'

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
}: {
  open: boolean
  onResume: () => void
  onDiscard: () => void
}) {
  return (
    <OnboardingDialog
      open={open}
      title="Folytatod az eseményed?"
      detail="Találtunk egy korábban elkezdett eseményt ezen az eszközön."
    >
      <div className="flex flex-col gap-2.5">
        <button
          type="button"
          onClick={onResume}
          className="btn-shine inline-flex min-h-14 items-center justify-center rounded-2xl bg-primary px-6 text-base font-semibold text-primary-foreground"
        >
          Folytatás
        </button>
        <button
          type="button"
          onClick={onDiscard}
          className="glass inline-flex min-h-14 items-center justify-center rounded-2xl px-6 text-base font-semibold"
        >
          Újrakezdés
        </button>
      </div>
    </OnboardingDialog>
  )
}
