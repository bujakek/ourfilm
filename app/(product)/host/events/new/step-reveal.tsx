'use client'

import type { StepScreen } from '@/components/host/onboarding/onboarding-shell'
import { RevealPreview } from '@/components/host/onboarding/reveal-preview'
import { RevealSelector } from '@/components/host/reveal-selector'
import type { RevealChoice } from '@/lib/camera'
import { formatRevealBadge } from '@/lib/format'
import type { Locale } from '@/lib/i18n'

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
  // A readout, not a sentence — it is set in the mono now, and the rule for
  // that face is that it counts things rather than saying them. Same three
  // states as before, in caps.
  const badge =
    mode === 'instant'
      ? en
        ? 'VISIBLE NOW'
        : 'AZONNAL LÁTHATÓ'
      : revealIso
        ? `${en ? 'OPENS' : 'MEGNYÍLIK'} · ${formatRevealBadge(
            revealIso,
            timeZone,
            locale,
          ).toUpperCase()}`
        : en
          ? 'AFTER THE EVENT'
          : 'AZ ESEMÉNY VÉGÉN'

  return {
    eyebrow: en ? 'DEVELOPING' : 'AZ ELŐHÍVÁS',
    title: en
      ? 'When should the photos appear?'
      : 'Mikor jelenjenek meg a képek?',
    detail: en
      ? 'Keep them hidden while everyone shoots, or reveal them as they arrive. You decide.'
      : 'A képek alapból rejtve maradnak az esemény alatt. Te döntöd el, mikor nyíljon meg a galéria.',
    cta: en ? 'Continue' : 'Tovább',
    content: (
      <>
        <RevealPreview blurred={mode !== 'instant'} badge={badge} />

        <fieldset className="mt-auto pt-6">
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
