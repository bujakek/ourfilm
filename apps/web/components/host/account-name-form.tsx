'use client'

import { useState, useTransition } from 'react'

import { updateHostDisplayName } from '@/app/(product)/host/account/actions'
import {
  HOST_FIELD,
  HOST_ROW_DETAIL,
  HOST_ROW_QUESTION,
  HOST_SECONDARY,
} from '@/components/host/ui/classes'
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
      <div className="grid grid-cols-[3.5rem_minmax(0,1fr)] items-end gap-4">
        <span
          aria-hidden="true"
          className="host-figure flex size-14 items-center justify-center rounded-full bg-host-tile text-[24px] text-white"
        >
          {hostInitials(trimmed || savedName)}
        </span>

        <div className="min-w-0">
          <label htmlFor="host-display-name" className={HOST_ROW_QUESTION}>
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
            className={`mt-2 ${HOST_FIELD}`}
          />
        </div>
      </div>

      <p className={`mt-3 ${HOST_ROW_DETAIL}`}>
        {en
          ? 'This name appears on the photos you upload.'
          : 'Ez a név jelenik meg az általad feltöltött képeknél.'}
      </p>

      <button
        type="button"
        disabled={pending || unchanged || problem !== null}
        className={`mt-4 w-full ${HOST_SECONDARY}`}
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
      </button>

      {error ? (
        <p
          role="alert"
          className="mt-2 text-[14px] leading-[1.5] text-host-danger"
        >
          {error}
        </p>
      ) : problem === 'required' || problem === 'too_short' ? (
        <p className={`mt-2 ${HOST_ROW_DETAIL}`}>
          {en
            ? 'Enter at least 2 characters.'
            : 'Adj meg legalább 2 karaktert.'}
        </p>
      ) : null}
    </div>
  )
}
