'use client'

import type { StepScreen } from '@/components/host/onboarding/onboarding-shell'
import { RevealPreview } from '@/components/host/onboarding/reveal-preview'
import { RevealSelector } from '@/components/host/reveal-selector'
import type { RevealChoice } from '@/lib/camera'
import { formatRevealBadge } from '@/lib/format'
import type { Locale } from '@/lib/i18n'

/** Question three: when does the album develop? (6c) */
export function revealScreen({
  mode,
  setMode,
  revealIso,
  timeZone,
  locale,
}: {
  mode: RevealChoice
  setMode: (value: RevealChoice) => void
  revealIso: string | null
  timeZone: string
  locale: Locale
}): StepScreen {
  const en = locale === 'en'
  // Sentence case, not a tracked caps label: a date and a time are more than
  // the three words a kicker may carry.
  const badge =
    mode === 'instant'
      ? en
        ? 'Visible right away'
        : 'Azonnal látható'
      : revealIso
        ? `${en ? 'Opens' : 'Megnyílik'} · ${formatRevealBadge(
            revealIso,
            timeZone,
            locale,
          )}`
        : en
          ? 'When the event ends'
          : 'Az esemény végén'

  return {
    eyebrow: en ? 'Developing' : 'Az előhívás',
    title: en
      ? 'When should the photos appear?'
      : 'Mikor jelenjenek meg a képek?',
    cta: en ? 'Continue' : 'Tovább',
    content: (
      <>
        <RevealPreview blurred={mode !== 'instant'} badge={badge} />

        <fieldset className="mt-5">
          <legend className="sr-only">
            {en ? 'Gallery reveal time' : 'A galéria megnyílásának időpontja'}
          </legend>
          <RevealSelector
            value={mode}
            onChange={setMode}
            name="reveal_mode_choice"
            locale={locale}
          />
        </fieldset>
      </>
    ),
  }
}
