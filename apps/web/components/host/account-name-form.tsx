'use client'

import { useRef, useState, useTransition } from 'react'

import { updateHostDisplayName } from '@/app/(product)/host/account/actions'
import { Button } from '@/components/ui/button'
import { X } from 'lucide-react'
import { inputSurfaceClassName } from '@/components/ui/input'
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
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const field = useRef<HTMLInputElement>(null)

  const trimmed = value.trim()
  const problem = hostDisplayNameProblem(trimmed)
  const unchanged = trimmed === savedName

  return (
    <div>
      <div className="grid grid-cols-[4.5rem_minmax(0,1fr)] items-center gap-4 sm:grid-cols-[5rem_minmax(0,1fr)] sm:gap-6">
        {/* Filled rather than outlined, and the only such shape above the save
            button. The initials are the one piece of this screen that is
            *about* the host rather than a field they operate, so they get the
            same cream-on-near-black the primary button wears. */}
        <span
          aria-hidden="true"
          className="flex size-18 items-center justify-center rounded-full bg-primary font-display text-[32px] text-primary-foreground sm:size-20 sm:text-[36px]"
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
          <div className={`mt-2 ${inputSurfaceClassName}`}>
            <input
              ref={field}
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
                setSaved(false)
                setError(null)
              }}
              className="min-w-0 flex-1 bg-transparent text-base font-normal text-foreground outline-none disabled:opacity-50 sm:text-sm"
            />
            {value ? (
              // Clearing a 40-character name on a phone is otherwise a long
              // press and a swipe. The field keeps focus so the next thing
              // typed goes where the host is already looking.
              <button
                type="button"
                aria-label={en ? 'Clear the name' : 'Név törlése'}
                onClick={() => {
                  setValue('')
                  setSaved(false)
                  setError(null)
                  field.current?.focus()
                }}
                className="-mr-2 flex size-11 shrink-0 items-center justify-center text-muted-foreground transition-colors hover:text-foreground"
              >
                <X className="size-4" strokeWidth={2} aria-hidden="true" />
              </button>
            ) : null}
          </div>
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
              setSaved(true)
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
      ) : saved ? (
        <p role="status" className="mt-2 text-sm text-accent">
          {en ? 'Saved.' : 'Elmentettük.'}
        </p>
      ) : null}
    </div>
  )
}
