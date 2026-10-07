'use client'

import Link from 'next/link'
import { useId, useState } from 'react'

import { localePath, type Locale } from '@/lib/i18n'

const detailsButtonClassName =
  'min-h-11 underline underline-offset-2 hover:text-foreground'

/**
 * Shared early-performance declaration for onboarding and billing.
 * Keep the request and acknowledgement visible in the checkbox label.
 * Render LegalDetails outside the label so links never toggle consent.
 */
export function PaidTermsAcceptance({ locale }: { locale: Locale }) {
  if (locale === 'en') {
    return (
      <span>
        I request the service to start immediately and acknowledge that full
        performance ends my 14-day right to cancel.
      </span>
    )
  }

  return (
    <span>
      Kérem a szolgáltatás azonnali megkezdését, és tudomásul veszem, hogy a
      teljes teljesítés után elveszítem a 14 napos felmondási jogomat.
    </span>
  )
}

/** Keep this outside the checkbox label: opening details must not accept terms. */
export function LegalDetails({
  locale,
  paid = true,
}: {
  locale: Locale
  paid?: boolean
}) {
  const en = locale === 'en'
  const [open, setOpen] = useState(false)
  const detailsId = useId()

  if (paid) {
    return (
      <div className="text-xs leading-relaxed text-muted-foreground">
        <div className="flex flex-wrap items-center gap-x-1.5">
          <Link
            href={localePath(locale, '/aszf')}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex min-h-11 items-center underline underline-offset-2 hover:text-foreground"
          >
            {en ? 'Terms' : 'ÁSZF'}
          </Link>
          <span aria-hidden="true">·</span>
          <button
            type="button"
            aria-expanded={open}
            aria-controls={detailsId}
            onClick={() => setOpen(!open)}
            className={detailsButtonClassName}
          >
            {en ? 'Details' : 'Részletek'}
          </button>
          <span aria-hidden="true">·</span>
          <Link
            href={localePath(locale, '/adatvedelem')}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex min-h-11 items-center underline underline-offset-2 hover:text-foreground"
          >
            {en ? 'Privacy Notice' : 'Adatkezelési tájékoztató'}
          </Link>
        </div>
        <p id={detailsId} hidden={!open} className="pb-3 text-xs">
          {en
            ? 'If you cancel within 14 days, before full performance, you pay a proportionate fee for the service already provided. The Terms explain your right to cancel and how to exercise it.'
            : 'Ha 14 napon belül, a maradéktalan teljesítés előtt mondod fel a szolgáltatást, az addig teljesített szolgáltatással arányos díj fizetendő. A felmondási jog és annak gyakorlása részletesen az ÁSZF-ben található.'}
        </p>
      </div>
    )
  }

  return (
    <div className="text-xs leading-relaxed text-muted-foreground">
      <button
        type="button"
        aria-expanded={open}
        aria-controls={detailsId}
        onClick={() => setOpen(!open)}
        className={detailsButtonClassName}
      >
        {en ? 'Details' : 'Részletek'}
      </button>
      <div id={detailsId} hidden={!open} className="pb-3">
        <Link
          href={localePath(locale, '/adatvedelem')}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex min-h-11 items-center underline underline-offset-2 hover:text-foreground"
        >
          {en ? 'Privacy Notice' : 'Adatkezelési tájékoztató'}
        </Link>
      </div>
    </div>
  )
}
