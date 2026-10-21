'use client'

import { ChevronDown } from 'lucide-react'
import { useId, useState } from 'react'

import { HOST_FIELD, HOST_FOCUS } from '@/components/host/ui/classes'

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
 * Starts on whatever the caller passes — `initialBillingCountry` decides
 * that — and otherwise empty. The IP-based `suggested` country is floated to
 * the top of the list but never selected by this field. Compact checkout
 * shows a chosen value beside a Change button; continuing confirms the
 * displayed value, and the server validates it again.
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
          'flex flex-wrap items-center justify-between gap-x-3 text-[15px] text-white',
          className,
        )}
      >
        <input type="hidden" name={name} value={country} />
        <p>
          <span className="text-white/65">
            {en ? 'Billing country: ' : 'Számlázási ország: '}
          </span>
          {billingCountryName(country, locale)}
        </p>
        <button
          type="button"
          onClick={() => setEditing(true)}
          className={`min-h-11 font-medium text-white underline underline-offset-4 ${HOST_FOCUS}`}
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
        className="block text-[13px] font-medium text-white/65"
      >
        {en ? 'Billing country' : 'Számlázási ország'}
      </label>
      <div className="relative mt-1.5">
        <select
          id={id}
          name={name}
          required
          value={country ?? ''}
          onChange={(event) => {
            onChange(parseBillingCountry(event.target.value))
          }}
          className={cn(
            HOST_FIELD,
            'appearance-none pr-11 [color-scheme:dark]',
            !country && 'text-white/65',
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
        <ChevronDown
          className="pointer-events-none absolute top-1/2 right-4 size-4 -translate-y-1/2 text-white/65"
          aria-hidden="true"
        />
      </div>
    </div>
  )
}
