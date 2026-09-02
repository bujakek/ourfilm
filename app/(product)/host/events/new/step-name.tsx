'use client'

import { Pencil } from 'lucide-react'
import type { Locale } from '@/lib/i18n'

import {
  OnboardingShell,
  type OnboardingNav,
} from '@/components/host/onboarding/onboarding-shell'
import { inputSurfaceClassName } from '@/components/ui/input'

/**
 * Question one: what is this film called?
 *
 * One field, and nothing else on the screen — no cover picker, no event-type
 * chooser, no second setting. The suggestions underneath are prompts rather
 * than categories: tapping one fills the field and leaves it editable, because
 * the point is removing the blank-field pause, not making the choice.
 */
export function StepName({
  nav,
  name,
  setName,
  suggestions,
  canAdvance,
  locale,
}: {
  nav: OnboardingNav
  name: string
  setName: (value: string) => void
  suggestions: string[]
  canAdvance: boolean
  locale: Locale
}) {
  const en = locale === 'en'
  return (
    <OnboardingShell
      {...nav}
      locale={locale}
      title={
        en ? 'What should we call your event?' : 'Mi legyen az esemény neve?'
      }
      detail={
        en
          ? 'Give your camera a name. This is what your guests will see.'
          : 'Adj nevet a filmednek. Ezt látják majd a vendégeid.'
      }
      cta={en ? 'Continue' : 'Tovább'}
      ctaDisabled={!canAdvance}
    >
      <div className={inputSurfaceClassName}>
        <Pencil
          className="size-4 shrink-0 text-muted-foreground"
          strokeWidth={1.8}
          aria-hidden="true"
        />
        {/* No visible label: the heading two lines up is the question, and a
            second "Esemény neve" above the box would be the same words twice. */}
        <input
          aria-label={en ? 'Event name' : 'Az esemény neve'}
          maxLength={80}
          autoFocus
          enterKeyHint="next"
          autoCapitalize="sentences"
          value={name}
          onChange={(event) => setName(event.target.value)}
          onKeyDown={(event) => {
            if (event.key !== 'Enter') return
            // A lone text field in a form submits on Enter. Here that would
            // post a half-answered draft from the first of four screens, so
            // the key advances instead — and the keyboard's own "next" is
            // what closes it.
            event.preventDefault()
            if (canAdvance) nav.onNext?.()
          }}
          placeholder={en ? 'Enter your event name' : 'Írd be a filmed nevét'}
          className="min-w-0 flex-1 bg-transparent text-base outline-none placeholder:text-muted-foreground/50"
        />
      </div>

      <p
        id="name-suggestions-label"
        className="mt-8 text-xs tracking-[0.2em] text-muted-foreground/70"
      >
        {en ? 'IDEAS' : 'ÖTLETEK'}
      </p>
      <ul
        aria-labelledby="name-suggestions-label"
        className="mt-3 flex flex-col items-start gap-2.5"
      >
        {suggestions.map((suggestion) => (
          <li key={suggestion}>
            <button
              type="button"
              onClick={() => setName(suggestion)}
              className="glass min-h-11 rounded-full px-5 text-sm text-muted-foreground transition-colors hover:text-foreground"
            >
              {suggestion}
            </button>
          </li>
        ))}
      </ul>
    </OnboardingShell>
  )
}
