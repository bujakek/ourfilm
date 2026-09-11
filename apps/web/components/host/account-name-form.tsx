'use client'

import { useState, useTransition } from 'react'

import { updateHostDisplayName } from '@/app/(product)/host/account/actions'
import { Button } from '@/components/ui/button'
import { inputClassName } from '@/components/ui/input'
import {
  HOST_DISPLAY_NAME_MAX_LENGTH,
  hostDisplayNameProblem,
  hostInitials,
} from '@/lib/host-name'

export function AccountNameForm({
  name,
  locale,
}: {
  name: string
  locale: 'en' | 'hu'
}) {
  const en = locale === 'en'
  const [savedName, setSavedName] = useState(name)
  const [value, setValue] = useState(name)
  const [pending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)

  const trimmed = value.trim()
  const problem = hostDisplayNameProblem(trimmed)
  const unchanged = trimmed === savedName

  return (
    <div>
      <div className="grid grid-cols-[4.5rem_minmax(0,1fr)] items-center gap-4 sm:grid-cols-[5rem_minmax(0,1fr)] sm:gap-6">
        <span
          aria-hidden="true"
          className="flex size-18 items-center justify-center rounded-full border border-border bg-white/6 font-display text-[32px] text-foreground sm:size-20 sm:text-[36px]"
        >
          {hostInitials(trimmed || savedName)}
        </span>

        <div className="min-w-0">
          <label
            htmlFor="host-display-name"
            className="text-sm text-muted-foreground"
          >
            {en ? 'Display name' : 'Megjelenített név'}
          </label>
          <input
            id="host-display-name"
            name="displayName"
            type="text"
            autoComplete="name"
            autoCapitalize="words"
            enterKeyHint="done"
            maxLength={HOST_DISPLAY_NAME_MAX_LENGTH}
            disabled={pending}
            value={value}
            onChange={(event) => {
              setValue(event.target.value)
              setError(null)
            }}
            className={`mt-2 ${inputClassName}`}
          />
        </div>
      </div>

      <p className="mt-3 pl-22 text-sm leading-relaxed text-pretty text-muted-foreground sm:pl-26">
        {en
          ? 'This name appears on the photos you upload.'
          : 'Ez a név jelenik meg az általad feltöltött képeknél.'}
      </p>

      <Button
        type="button"
        disabled={pending || unchanged || problem !== null}
        className="mt-5 w-full"
        onClick={() =>
          startTransition(async () => {
            setError(null)
            try {
              await updateHostDisplayName(trimmed)
              setSavedName(trimmed)
              setValue(trimmed)
            } catch {
              setError(
                en
                  ? 'Could not save the name.'
                  : 'Nem sikerült menteni a nevet.',
              )
            }
          })
        }
      >
        {pending
          ? en
            ? 'Saving…'
            : 'Mentés…'
          : en
            ? 'Save name'
            : 'Név mentése'}
      </Button>

      {error ? (
        <p role="alert" className="mt-2 text-sm text-destructive">
          {error}
        </p>
      ) : problem === 'required' || problem === 'too_short' ? (
        <p className="mt-2 text-sm text-muted-foreground">
          {en
            ? 'Enter at least 2 characters.'
            : 'Adj meg legalább 2 karaktert.'}
        </p>
      ) : null}
    </div>
  )
}
