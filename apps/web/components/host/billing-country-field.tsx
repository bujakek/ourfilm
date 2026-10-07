'use client'

import { useId, useState } from 'react'

import {
  type BillingCountry,
  billingCountryOptions,
  billingCountryName,
  parseBillingCountry,
} from '@/lib/billing-country'
import type { Locale } from '@/lib/i18n'
import { cn } from '@/lib/utils'

/**
 * "Számlázási ország" — the one commercial question, asked where the host is
 * already deciding to pay.
 *
 * A native `<select>`: on a phone it opens the OS picker, which is the only
 * way to choose from ~90 countries at 390px without a search box.
 *
 * Starts on the caller's saved or suggested country. Compact checkout shows
 * the value beside a Change button; continuing confirms the displayed value.
 * The server validates that submitted value independently of any suggestion.
 *
 * No explanation underneath: the price follows the choice on the button, and
 * a country this deployment cannot sell to is explained by the action's
 * refusal. Never "Billingo" or "Managed Payments" anywhere — those are our
 * arrangements, not the host's choice.
 */
export function BillingCountryField({
  locale,
  value,
  onChange,
  suggested,
  name,
  className,
  compact = false,
}: {
  locale: Locale
  value: string | null
  onChange: (value: BillingCountry | null) => void
  suggested: BillingCountry | null
  /** Set when the field posts in a `<form>`. */
  name?: string
  className?: string
  compact?: boolean
}) {
  const id = useId()
  const [editing, setEditing] = useState(false)
  const en = locale === 'en'
  const country = parseBillingCountry(value)
  const options = billingCountryOptions(locale)
  const top = suggested ? options.filter((o) => o.code === suggested) : []
  const rest = suggested ? options.filter((o) => o.code !== suggested) : options

  if (compact && country && !editing) {
    return (
      <div
        className={cn(
          'flex flex-wrap items-center justify-between gap-x-3 text-sm',
          className,
        )}
      >
        <input type="hidden" name={name} value={country} />
        <p>
          <span className="text-muted-foreground">
            {en ? 'Billing country: ' : 'Számlázási ország: '}
          </span>
          {billingCountryName(country, locale)}
        </p>
        <button
          type="button"
          onClick={() => setEditing(true)}
          className="min-h-11 text-accent underline underline-offset-4"
        >
          {en ? 'Change' : 'Módosítás'}
        </button>
      </div>
    )
  }

  return (
    <div className={className}>
      <label
        htmlFor={id}
        className="block text-[12px] font-medium text-foreground"
      >
        {en ? 'Billing country' : 'Számlázási ország'}
      </label>
      <select
        id={id}
        name={name}
        required
        value={country ?? ''}
        onChange={(event) => {
          onChange(parseBillingCountry(event.target.value))
        }}
        className={cn(
          'mt-1.5 h-11 w-full rounded-lg border border-white/13 bg-transparent px-3 text-[14px] text-foreground',
          'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent',
          !country && 'text-muted-foreground',
        )}
      >
        <option value="" disabled>
          {en ? 'Choose a country' : 'Válassz országot'}
        </option>
        {top.length > 0 ? (
          <optgroup label={en ? 'Suggested' : 'Javasolt'}>
            {top.map((option) => (
              <option key={option.code} value={option.code}>
                {option.name}
              </option>
            ))}
          </optgroup>
        ) : null}
        <optgroup label={en ? 'All countries' : 'Minden ország'}>
          {rest.map((option) => (
            <option key={option.code} value={option.code}>
              {option.name}
            </option>
          ))}
        </optgroup>
      </select>
    </div>
  )
}
