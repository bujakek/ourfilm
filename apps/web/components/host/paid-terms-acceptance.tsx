import Link from 'next/link'

import { localePath, type Locale } from '@/lib/i18n'

/**
 * The declaration a host accepts before paying, in one place.
 *
 * It is the same sentence on the billing card and on the last onboarding
 * screen, and it is the only record that the two things Hungarian consumer law
 * wants were actually said: that the ÁSZF was accepted (Ptk. 6:78 — terms bind
 * only where the other party could learn their content *and* accepted them),
 * and that performance inside the 14-day period was expressly requested with
 * its consequence acknowledged (45/2014. (II. 26.) Korm. rendelet).
 *
 * Shared rather than repeated because a legal declaration written out twice
 * drifts, and the version a host actually agreed to has to be knowable. The
 * Stripe Checkout page deliberately asks for nothing further — see the note in
 * `lib/stripe/checkout.ts`.
 */
export function PaidTermsAcceptance({ locale }: { locale: Locale }) {
  const terms = (
    <Link
      href={localePath(locale, '/aszf')}
      target="_blank"
      className="underline underline-offset-2 hover:text-foreground"
    >
      {locale === 'en' ? 'Terms' : 'ÁSZF-et'}
    </Link>
  )
  const privacy = (
    <Link
      href={localePath(locale, '/adatvedelem')}
      target="_blank"
      className="underline underline-offset-2 hover:text-foreground"
    >
      {locale === 'en' ? 'Privacy Notice' : 'Adatkezelési tájékoztató'}
    </Link>
  )

  if (locale === 'en') {
    return (
      <span>
        I ask for the service to start immediately, within the 14-day period. I
        acknowledge that I lose my right to cancel without giving a reason once
        the service has been fully performed.
        <span className="mt-1.5 block">
          If you cancel within the 14-day period, you pay a proportionate fee
          for the service provided up to that point.
        </span>
        <span className="mt-1.5 block">
          By purchasing, you accept the {terms}. {privacy}.
        </span>
      </span>
    )
  }

  return (
    <span>
      Kérem a szolgáltatás azonnali megkezdését a 14 napos határidőn belül.
      Tudomásul veszem, hogy maradéktalan teljesítéskor elveszítem az indokolás
      nélküli felmondási jogomat.
      <span className="mt-1.5 block">
        A 14 napos határidőn belüli felmondáskor az addig teljesített
        szolgáltatás arányos díja fizetendő.
      </span>
      <span className="mt-1.5 block">
        A vásárlással elfogadod az {terms}. {privacy}.
      </span>
    </span>
  )
}
