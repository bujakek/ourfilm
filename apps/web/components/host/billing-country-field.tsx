'use client'

import { useId } from 'react'

import {
  type BillingCountry,
  billingCountryOptions,
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
 * Starts on whatever the caller passes (a confirmed country, or Hungary on the
 * Hungarian settings page) and otherwise empty. A location-based
 * guess is floated to the top of the list but never selected for them — an IP
 * says where a phone is, not where its owner is billed, and a preselected
 * guess is a guess the host confirms without reading.
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
}: {
  locale: Locale
  value: string | null
  onChange: (value: BillingCountry | null) => void
  suggested: BillingCountry | null
  /** Set when the field posts in a `<form>`. */
  name?: string
  className?: string
}) {
  const id = useId()
  const en = locale === 'en'
  const country = parseBillingCountry(value)
  const options = billingCountryOptions(locale)
  const top = suggested ? options.filter((o) => o.code === suggested) : []
  const rest = suggested ? options.filter((o) => o.code !== suggested) : options

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
        onChange={(event) => onChange(parseBillingCountry(event.target.value))}
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
