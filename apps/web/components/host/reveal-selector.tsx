'use client'

import type { RevealChoice } from '@/lib/camera'
import type { Locale } from '@/lib/i18n'

/**
 * When the album develops, as two radio rows.
 *
 * Rows rather than tiles: each choice is a label and a sentence, and a row
 * gives the sentence the width it needs at 390px and 130% text. The selected
 * row takes a sky wash and a sky dot — selected state is one of the two things
 * sky may mean — and the dot is the second signal, so the choice survives a
 * reader who cannot tell the wash apart.
 */
export function RevealSelector({
  value,
  onChange,
  name,
  locale,
  disabled = false,
}: {
  value: RevealChoice
  onChange: (value: RevealChoice) => void
  name: string
  locale: Locale
  disabled?: boolean
}) {
  const en = locale === 'en'
  const choices = [
    {
      value: 'instant' as const,
      label: en ? 'Right away' : 'Azonnal',
      detail: en
        ? 'Photos appear while the event is happening.'
        : 'A képek már az esemény alatt megjelennek.',
    },
    {
      value: 'event_end' as const,
      label: en ? 'When the event ends' : 'Az esemény végén',
      detail: en
        ? 'The gallery opens when shooting ends.'
        : 'A galéria a fotózás végén nyílik meg.',
    },
  ]

  return (
    <div className="flex flex-col gap-2">
      {choices.map(({ value: choice, label, detail }) => {
        const active = choice === value
        return (
          <label
            key={choice}
            className={`flex min-h-16 cursor-pointer items-center gap-3.5 rounded-[16px] px-4 py-2.5 text-white transition-colors has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-white/60 ${
              active ? 'bg-landing-sky/12' : 'bg-host-tile hover:bg-white/8'
            } ${disabled ? 'cursor-not-allowed opacity-60' : ''}`}
          >
            <input
              type="radio"
              name={name}
              value={choice}
              checked={active}
              disabled={disabled}
              onChange={() => onChange(choice)}
              className="sr-only"
            />
            <span
              aria-hidden="true"
              className={`flex size-4 shrink-0 items-center justify-center rounded-full border-[1.5px] ${
                active ? 'border-landing-sky' : 'border-white/55'
              }`}
            >
              {active ? (
                <span className="size-2 rounded-full bg-landing-sky" />
              ) : null}
            </span>
            <span className="min-w-0">
              <span className="block text-[15px] leading-[1.5] font-medium text-balance">
                {label}
              </span>
              <span className="block text-[13px] leading-[1.5] text-pretty text-white/65">
                {detail}
              </span>
            </span>
          </label>
        )
      })}
    </div>
  )
}
