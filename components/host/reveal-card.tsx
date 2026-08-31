'use client'

import { useState, useTransition } from 'react'

import { setReveal } from '@/app/host/events/[slug]/actions'
import type { RevealChoice } from '@/lib/camera'

const CHOICES: { mode: RevealChoice; title: string; detail: string }[] = [
  {
    mode: 'instant',
    title: 'Azonnal',
    detail: 'A vendégek már az esemény alatt láthatják az elkészült képeket.',
  },
  {
    mode: 'event_end',
    title: 'Az esemény végén',
    detail: 'A galéria akkor nyílik meg, amikor a fotózás véget ér.',
  },
]

/**
 * When the album develops.
 *
 * Both choices are pinned to the capture window, and the database trigger
 * recomputes the instant whenever that window moves.
 *
 * Like the capture window beside it, there is no optimistic state: the saved
 * rule is something a host will read back and act on.
 */
export function RevealCard({
  slug,
  mode: savedMode,
  locale,
}: {
  slug: string
  mode: RevealChoice
  locale: 'en' | 'hu'
}) {
  const en = locale === 'en'
  const [mode, setMode] = useState<RevealChoice>(savedMode)
  const [pending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const [saved, setSaved] = useState(false)

  const dirty = mode !== savedMode

  return (
    <div className="glass rounded-2xl px-5 py-4">
      <p className="font-medium">{en ? 'Photo reveal' : 'Képek megjelenése'}</p>

      <fieldset className="mt-4 flex flex-col gap-2">
        <legend className="sr-only">
          {en ? 'Photo reveal time' : 'Leleplezés időpontja'}
        </legend>
        {CHOICES.map((choice) => (
          <label
            key={choice.mode}
            className={`glass flex cursor-pointer gap-3 rounded-xl p-3 ${
              mode === choice.mode ? 'border-accent' : ''
            }`}
          >
            <input
              type="radio"
              name="reveal_mode_setting"
              value={choice.mode}
              checked={mode === choice.mode}
              onChange={() => {
                setMode(choice.mode)
                setSaved(false)
              }}
              className="mt-0.5 size-4 shrink-0 accent-[var(--color-accent)]"
            />
            <span className="min-w-0">
              <span className="block text-sm font-medium">
                {en
                  ? choice.mode === 'instant'
                    ? 'Immediately'
                    : 'At the end of the event'
                  : choice.title}
              </span>
              <span className="mt-0.5 block text-xs leading-relaxed text-muted-foreground">
                {en
                  ? choice.mode === 'instant'
                    ? 'Guests can see photos during the event.'
                    : 'The gallery opens when shooting ends.'
                  : choice.detail}
              </span>
            </span>
          </label>
        ))}
      </fieldset>

      <button
        type="button"
        disabled={pending || !dirty}
        onClick={() =>
          startTransition(async () => {
            setError(null)
            try {
              await setReveal(slug, mode)
              setSaved(true)
            } catch (e) {
              setError(
                e instanceof Error
                  ? e.message
                  : en
                    ? 'Could not save changes.'
                    : 'Nem sikerült módosítani.',
              )
            }
          })
        }
        className="mt-4 inline-flex min-h-12 w-full items-center justify-center rounded-full bg-primary px-6 text-sm font-semibold text-primary-foreground disabled:opacity-60"
      >
        {pending
          ? en
            ? 'Saving…'
            : 'Mentés…'
          : en
            ? 'Save changes'
            : 'Változtatások mentése'}
      </button>

      {error ? (
        <p className="mt-2 text-xs text-destructive">{error}</p>
      ) : saved ? (
        <p className="mt-2 text-xs text-accent">
          {en ? 'Saved.' : 'Elmentettük.'}
        </p>
      ) : null}
    </div>
  )
}
