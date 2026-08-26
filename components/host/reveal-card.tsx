'use client'

import { useState, useTransition } from 'react'

import { setReveal } from '@/app/host/events/[slug]/actions'
import type { RevealMode } from '@/lib/camera'

const CHOICES: { mode: RevealMode; title: string; detail: string }[] = [
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
  {
    mode: 'custom',
    title: 'Később',
    detail: 'Válassz egy későbbi időpontot a közös leleplezéshez.',
  },
]

/**
 * When the album develops.
 *
 * Two of the three modes carry no time of their own — they are pinned to the
 * capture window, and the database trigger recomputes the instant whenever that
 * window moves. So the date field appears only for `Később`, which is the one
 * answer that means a moment rather than a rule.
 *
 * Like the capture window beside it, no optimistic state: a reveal date is
 * something a host will read back and act on.
 */
export function RevealCard({
  slug,
  mode: savedMode,
  customValue,
  minValue,
}: {
  slug: string
  mode: RevealMode
  customValue: string
  /** The capture end — a custom reveal may not precede it. */
  minValue: string
}) {
  const [mode, setMode] = useState<RevealMode>(savedMode)
  const [custom, setCustom] = useState(customValue)
  const [pending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const [saved, setSaved] = useState(false)

  const dirty =
    mode !== savedMode || (mode === 'custom' && custom !== customValue)

  return (
    <div className="glass rounded-2xl px-5 py-4">
      <p className="font-medium">Képek megjelenése</p>

      <fieldset className="mt-4 flex flex-col gap-2">
        <legend className="sr-only">Leleplezés időpontja</legend>
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
              <span className="block text-sm font-medium">{choice.title}</span>
              <span className="mt-0.5 block text-xs leading-relaxed text-muted-foreground">
                {choice.detail}
              </span>
            </span>
          </label>
        ))}
      </fieldset>

      {mode === 'custom' ? (
        <div className="mt-3">
          <label
            htmlFor="reveal_at_setting"
            className="mb-1.5 block text-xs text-muted-foreground"
          >
            Leleplezés időpontja
          </label>
          <input
            id="reveal_at_setting"
            type="datetime-local"
            value={custom}
            min={minValue}
            onChange={(e) => {
              setCustom(e.target.value)
              setSaved(false)
            }}
            className="glass min-h-12 w-full rounded-xl px-4 text-sm outline-none focus:border-accent"
          />
        </div>
      ) : null}

      <button
        type="button"
        disabled={pending || !dirty}
        onClick={() =>
          startTransition(async () => {
            setError(null)
            try {
              await setReveal(slug, mode, mode === 'custom' ? custom : null)
              setSaved(true)
            } catch (e) {
              setError(
                e instanceof Error ? e.message : 'Nem sikerült módosítani.',
              )
            }
          })
        }
        className="mt-4 inline-flex min-h-12 w-full items-center justify-center rounded-full bg-primary px-6 text-sm font-semibold text-primary-foreground disabled:opacity-60"
      >
        {pending ? 'Mentés…' : 'Változtatások mentése'}
      </button>

      {error ? (
        <p className="mt-2 text-xs text-destructive">{error}</p>
      ) : saved ? (
        <p className="mt-2 text-xs text-accent">Elmentettük.</p>
      ) : null}
    </div>
  )
}
