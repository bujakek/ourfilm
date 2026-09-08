'use client'

import { useState, useTransition } from 'react'

import { setReveal } from '@/app/(product)/host/events/[slug]/actions'
import { RevealSelector } from '@/components/host/reveal-selector'
import { Button } from '@/components/ui/button'
import type { RevealChoice } from '@/lib/camera'

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

      <fieldset className="mt-4">
        <legend className="sr-only">
          {en ? 'Photo reveal time' : 'Leleplezés időpontja'}
        </legend>
        <RevealSelector
          value={mode}
          onChange={(value) => {
            setMode(value)
            setSaved(false)
          }}
          name="reveal_mode_setting"
          locale={locale}
          disabled={pending}
        />
      </fieldset>

      <Button
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
        className="mt-4 w-full"
      >
        {pending
          ? en
            ? 'Saving…'
            : 'Mentés…'
          : en
            ? 'Save changes'
            : 'Változtatások mentése'}
      </Button>

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
