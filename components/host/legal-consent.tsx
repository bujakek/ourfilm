'use client'

import Link from 'next/link'

import { defaultLocale } from '@/lib/i18n'
import { CHECKOUT_COPY } from '@/lib/legal/copy/forms'
import { legalHref } from '@/lib/legal/routes'

/**
 * The two declarations that stand immediately before an order, and the notice
 * link that is not one.
 *
 * Shared by the last onboarding screen and the billing card, because both are
 * the moment a contract is entered into and the wording is not allowed to
 * differ between them.
 *
 * Three deliberate properties:
 *
 * - **Nothing is pre-ticked.** A pre-ticked box is not consent, and a
 *   pre-ticked express request to begin performance early is worse — it is the
 *   declaration that shortens a consumer's withdrawal right. Both are
 *   controlled inputs whose parent starts them false and never restores them
 *   from the stored draft.
 * - **The privacy notice is a link, not a checkbox.** It is read, not accepted;
 *   a tickbox next to it would misdescribe the legal basis of processing that
 *   rests on contract and legitimate interest.
 * - **The documents open in a new tab.** A host halfway through an order who
 *   navigates away to read the ÁSZF and loses their answers reads it once and
 *   never again.
 */
export function LegalConsent({
  acceptedTerms,
  setAcceptedTerms,
  acceptedEarlyPerformance,
  setAcceptedEarlyPerformance,
  disabled = false,
}: {
  acceptedTerms: boolean
  setAcceptedTerms: (value: boolean) => void
  acceptedEarlyPerformance: boolean
  setAcceptedEarlyPerformance: (value: boolean) => void
  disabled?: boolean
}) {
  return (
    <div className="flex flex-col gap-3">
      <Consent
        checked={acceptedTerms}
        onChange={setAcceptedTerms}
        disabled={disabled}
      >
        Elolvastam és elfogadom az{' '}
        <LegalLink route="terms">Általános Szerződési Feltételeket</LegalLink>.
      </Consent>

      <Consent
        checked={acceptedEarlyPerformance}
        onChange={setAcceptedEarlyPerformance}
        disabled={disabled}
      >
        {CHECKOUT_COPY.earlyPerformance}
      </Consent>

      <p className="text-xs leading-relaxed text-pretty text-muted-foreground">
        A személyes adatok kezeléséről az{' '}
        <LegalLink route="privacy">Adatkezelési tájékoztatóban</LegalLink>{' '}
        olvashatsz.
      </p>
    </div>
  )
}

function Consent({
  checked,
  onChange,
  disabled,
  children,
}: {
  checked: boolean
  onChange: (value: boolean) => void
  disabled: boolean
  children: React.ReactNode
}) {
  return (
    <label className="flex items-start gap-3">
      <input
        type="checkbox"
        checked={checked}
        disabled={disabled}
        onChange={(e) => onChange(e.target.checked)}
        className="mt-0.5 size-5 shrink-0 accent-[var(--color-accent)]"
      />
      <span className="text-xs leading-relaxed text-pretty">{children}</span>
    </label>
  )
}

function LegalLink({
  route,
  children,
}: {
  route: 'terms' | 'privacy'
  children: React.ReactNode
}) {
  return (
    <Link
      href={legalHref(defaultLocale, route)}
      target="_blank"
      rel="noopener"
      className="underline underline-offset-4"
    >
      {children}
    </Link>
  )
}
