'use client'

import { motion, useAnimationControls, useReducedMotion } from 'motion/react'

import type { StepScreen } from '@/components/host/onboarding/onboarding-shell'
import { HOST_KICKER } from '@/components/host/ui/classes'
import { EVENT_NAME_MAX_LENGTH } from '@/lib/camera'
import type { Locale } from '@/lib/i18n'
import { T, still } from '@/lib/motion'

/**
 * Question one: what is this film called? (6a)
 *
 * One field, and nothing else on the screen — no cover picker, no event-type
 * chooser, no second setting. The three suggestions underneath are prompts
 * rather than categories: tapping one fills the field and leaves it editable,
 * because the point is removing the blank-field pause, not making the choice.
 */
export function nameScreen({
  name,
  setName,
  suggestions,
  canAdvance,
  locale,
  onAdvance,
}: {
  name: string
  setName: (value: string) => void
  suggestions: string[]
  canAdvance: boolean
  locale: Locale
  /** Enter advances rather than submitting. See the key handler below. */
  onAdvance?: () => void
}): StepScreen {
  const en = locale === 'en'
  return {
    eyebrow: en ? 'The film name' : 'A film neve',
    title: en
      ? 'What should we call your event?'
      : 'Mi legyen az esemény neve?',
    detail: en
      ? 'Give your film a name. It’s what your guests will see.'
      : 'Adj nevet a filmednek. Ezt látják majd a vendégeid.',
    cta: en ? 'Continue' : 'Tovább',
    ctaDisabled: !canAdvance,
    content: (
      <NameFields
        name={name}
        setName={setName}
        suggestions={suggestions}
        canAdvance={canAdvance}
        locale={locale}
        onAdvance={onAdvance}
      />
    ),
  }
}

function NameFields({
  name,
  setName,
  suggestions,
  canAdvance,
  locale,
  onAdvance,
}: {
  name: string
  setName: (value: string) => void
  suggestions: string[]
  canAdvance: boolean
  locale: Locale
  onAdvance?: () => void
}) {
  const en = locale === 'en'
  const reduceMotion = useReducedMotion()
  const field = useAnimationControls()

  return (
    <>
      {/* A filled 64px well rather than a rule: it is the one answer on the
          screen, and the suggestions below fill it. No visible label — the
          question above is the label, and the input carries it for a screen
          reader. The well is the wrapper so a tapped suggestion moves the text
          and not the box around it. */}
      <div className="flex h-16 w-full items-center overflow-hidden rounded-[20px] bg-host-tile px-5 has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-white/40">
        <motion.input
          aria-label={en ? 'Event name' : 'Az esemény neve'}
          maxLength={EVENT_NAME_MAX_LENGTH}
          autoFocus
          enterKeyHint="next"
          autoCapitalize="sentences"
          value={name}
          animate={field}
          onChange={(event) => setName(event.target.value)}
          onKeyDown={(event) => {
            if (event.key !== 'Enter') return
            // A lone text field in a form submits on Enter. Here that would post
            // a half-answered draft from the first of four screens, so the key
            // advances instead — and the keyboard's own "next" is what closes it.
            event.preventDefault()
            if (canAdvance) onAdvance?.()
          }}
          placeholder={en ? 'Enter your event name' : 'Írd be az esemény nevét'}
          className="w-full bg-transparent text-[20px] text-white outline-none placeholder:text-white/35"
        />
      </div>

      <p id="name-suggestions-label" className={`mt-6 ${HOST_KICKER}`}>
        {en ? 'Ideas' : 'Ötletek'}
      </p>
      <ul
        aria-labelledby="name-suggestions-label"
        className="mt-3 flex flex-wrap gap-2"
      >
        {suggestions.map((suggestion) => {
          const chosen = name === suggestion
          return (
            <li key={suggestion}>
              <motion.button
                type="button"
                aria-pressed={chosen}
                whileTap={reduceMotion ? undefined : { scale: 0.96 }}
                transition={reduceMotion ? still : T.snap}
                onClick={() => {
                  setName(suggestion)
                  if (reduceMotion) return
                  // The text arrives in the field from 4px, rather than a
                  // clone of the chip flying across the screen. What changed is
                  // the answer, and the answer is the words in the field.
                  field.set({ y: 4, opacity: 0.35 })
                  void field.start({ y: 0, opacity: 1, transition: T.settle })
                }}
                className={`inline-flex min-h-11 items-center rounded-[14px] px-[18px] py-2 text-left text-[14px] transition-colors ${
                  chosen
                    ? 'bg-white text-landing-ink'
                    : 'bg-host-tile text-white/80 hover:bg-white/10 hover:text-white'
                }`}
              >
                {suggestion}
              </motion.button>
            </li>
          )
        })}
      </ul>
    </>
  )
}
