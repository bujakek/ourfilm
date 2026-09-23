'use client'

import { useId } from 'react'

import {
  type BillingCountry,
  billingCountryName,
  billingCountryOptions,
  type CheckoutReadiness,
  checkoutReadyFor,
  isDomesticBillingCountry,
  parseBillingCountry,
} from '@/lib/billing-country'
import { PAYMENT_PROCESSOR } from '@/lib/company'
import type { Locale } from '@/lib/i18n'
import { eventPriceLabelFor } from '@/lib/pricing'
import { cn } from '@/lib/utils'

/**
 * "Számlázási ország" — the one commercial question, asked where the host is
 * already deciding to pay.
 *
 * A native `<select>`: on a phone it opens the OS picker, which is the only
 * way to choose from ~90 countries at 390px without a search box.
 *
 * Starts empty unless the host confirmed a country before. A location-based
 * guess is floated to the top of the list but never selected for them — an IP
 * says where a phone is, not where its owner is billed, and a preselected
 * guess is a guess the host confirms without reading.
 *
 * What it shows underneath is the consequence in plain words: the price, and
 * who sells it. Never "Billingo" or "Managed Payments" — those are our
 * arrangements, not the host's choice.
 */
export function BillingCountryField({
  locale,
  value,
  onChange,
  suggested,
  readiness,
  name,
  className,
}: {
  locale: Locale
  value: string | null
  onChange: (value: BillingCountry | null) => void
  suggested: BillingCountry | null
  readiness: CheckoutReadiness
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
  const ready = country ? checkoutReadyFor(readiness, country) : true

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

      <p
        className="mt-2 text-[11.5px] leading-[1.55] text-muted-foreground"
        aria-live="polite"
      >
        {!country
          ? en
            ? 'The price and the seller depend on where you are billed. Pick the country of your billing address.'
            : 'Az ár és az eladó a számlázási címedtől függ. Válaszd ki a számlázási címed országát.'
          : !ready
            ? en
              ? `Payment from ${billingCountryName(country, locale)} is not switched on yet. Contact us and we will unlock the event.`
              : `${billingCountryName(country, locale)} felől még nem fogadunk fizetést. Írj nekünk, és feloldjuk az eseményt.`
            : sellerLine(country, readiness, en)}
      </p>
    </div>
  )
}

function sellerLine(
  country: BillingCountry,
  readiness: CheckoutReadiness,
  en: boolean,
): string {
  const price = eventPriceLabelFor(country)
  // The billing address entered at checkout has to match: Stripe's page lets
  // the country be changed, and a sale is classified by what is entered there.
  if (
    isDomesticBillingCountry(country) &&
    readiness.domesticSettlement === 'direct'
  ) {
    return en
      ? `${price}, the final amount. Sold by OurFilm; we email you a Hungarian invoice. Enter a Hungarian billing address at checkout.`
      : `${price}, ez a fizetendő végösszeg. Az eladó az OurFilm, a számlát e-mailben küldjük. A fizetésnél magyarországi számlázási címet adj meg.`
  }
  return en
    ? `${price}. Sold through ${PAYMENT_PROCESSOR.merchantOfRecord}, which issues your receipt. The final amount, including any tax, is shown at checkout.`
    : `${price}. Az értékesítő a ${PAYMENT_PROCESSOR.merchantOfRecord}, ő állítja ki a bizonylatot. A végösszeget az esetleges adóval együtt a fizetési oldal mutatja.`
}
