'use client'

import { Clock, Hourglass } from 'lucide-react'
import { motion, useReducedMotion } from 'motion/react'

import {
  OnboardingShell,
  type OnboardingNav,
} from '@/components/host/onboarding/onboarding-shell'
import { RevealPreview } from '@/components/host/onboarding/reveal-preview'
import type { RevealChoice } from '@/lib/camera'
import { formatRevealBadge } from '@/lib/format'
import type { Locale } from '@/lib/i18n'

export function StepReveal({
  nav,
  mode,
  setMode,
  revealIso,
  timeZone,
  locale,
}: {
  nav: OnboardingNav
  mode: RevealChoice
  setMode: (value: RevealChoice) => void
  revealIso: string | null
  timeZone: string
  locale: Locale
}) {
  const reduceMotion = useReducedMotion()
  const en = locale === 'en'
  const choices: { mode: RevealChoice; label: string; Icon: typeof Clock }[] = [
    { mode: 'instant', label: en ? 'Right away' : 'Azonnal', Icon: Hourglass },
    {
      mode: 'event_end',
      label: en ? 'When the event ends' : 'Az esemény végén',
      Icon: Clock,
    },
  ]
  const badge =
    mode === 'instant'
      ? en
        ? 'Photos appear right away'
        : 'A képek azonnal láthatók'
      : revealIso
        ? `${en ? 'Opens' : 'Megjelenik'}: ${formatRevealBadge(revealIso, timeZone, locale)}`
        : en
          ? 'Opens after the event'
          : 'Az esemény után jelenik meg'

  return (
    <OnboardingShell
      {...nav}
      locale={locale}
      title={
        en ? 'When should the photos appear?' : 'Mikor jelenjenek meg a képek?'
      }
      detail={
        en
          ? 'Keep them hidden while everyone shoots, or reveal them as they arrive. You decide.'
          : 'A képek alapból rejtve maradnak az esemény alatt. Te döntöd el, mikor nyíljon meg a galéria.'
      }
      cta={en ? 'Continue' : 'Tovább'}
    >
      <RevealPreview blurred={mode !== 'instant'} badge={badge} />

      <fieldset className="mt-auto pt-6">
        <legend className="sr-only">
          {en ? 'Gallery reveal time' : 'A galéria megnyílásának időpontja'}
        </legend>
        <div className="grid grid-cols-2 gap-2.5">
          {choices.map(({ mode: choice, label, Icon }) => {
            const active = choice === mode
            return (
              <label
                key={choice}
                className={`glass relative flex min-h-28 cursor-pointer flex-col justify-between overflow-hidden rounded-2xl p-3.5 has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-accent ${
                  active ? 'font-semibold text-accent' : ''
                }`}
              >
                {active ? (
                  <motion.span
                    layoutId="reveal-selection"
                    aria-hidden="true"
                    className="absolute inset-0 rounded-2xl bg-accent/10 ring-2 ring-accent ring-inset"
                    transition={
                      reduceMotion
                        ? { duration: 0 }
                        : { type: 'spring', stiffness: 480, damping: 38 }
                    }
                  />
                ) : null}
                <input
                  type="radio"
                  name="reveal_mode_choice"
                  value={choice}
                  checked={active}
                  onChange={() => setMode(choice)}
                  className="sr-only"
                />
                <motion.span
                  className="relative z-10 inline-flex"
                  animate={{ scale: active ? 1.08 : 1 }}
                  transition={{ duration: reduceMotion ? 0 : 0.16 }}
                >
                  <Icon
                    className="size-5"
                    strokeWidth={active ? 2 : 1.6}
                    aria-hidden="true"
                  />
                </motion.span>
                <span className="relative z-10 text-sm leading-snug text-balance">
                  {label}
                </span>
              </label>
            )
          })}
        </div>
      </fieldset>
    </OnboardingShell>
  )
}
