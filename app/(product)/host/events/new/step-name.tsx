'use client'

import type { Locale } from '@/lib/i18n'

import {
  OnboardingShell,
  type OnboardingNav,
} from '@/components/host/onboarding/onboarding-shell'

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
      eyebrow={en ? 'THE FILM NAME' : 'A FILM NEVE'}
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
      {/* A rule under a 22px field, not a filled box. The `Pencil` icon went
          with the box: at this size the rule is already unambiguous, and the
          icon was a second thing saying "you may type here". No visible label
          either — the heading two lines up is the question, and a second
          "Esemény neve" above the field would be the same words twice. */}
      <div>
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
          className="w-full border-b-[1.5px] border-white/20 bg-transparent pb-3 text-[22px] outline-none placeholder:text-foreground/28 focus:border-white/45"
        />
      </div>

      <p
        id="name-suggestions-label"
        className="mt-8.5 font-mono text-[9.5px] font-medium tracking-[0.2em] text-foreground/38"
      >
        {en ? 'IDEAS' : 'ÖTLETEK'}
      </p>
      {/* Wrapping in a row rather than stacking: three suggestions cost one or
          two lines instead of four, which is the room the 40px question needs. */}
      <ul
        aria-labelledby="name-suggestions-label"
        className="mt-3.5 flex flex-wrap gap-2"
      >
        {suggestions.map((suggestion) => (
          <li key={suggestion}>
            <button
              type="button"
              onClick={() => setName(suggestion)}
              className="rounded-full border border-white/13 px-3.5 py-2.5 text-[13px] text-foreground/72 transition-colors hover:border-white/30 hover:text-foreground"
            >
              {suggestion}
            </button>
          </li>
        ))}
      </ul>
    </OnboardingShell>
  )
}
