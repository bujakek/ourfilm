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
      {locale === 'en' ? 'Privacy Notice' : 'adatkezelési tájékoztatót'}
    </Link>
  )

  if (locale === 'en') {
    return (
      <span>
        I accept the {terms}, and expressly ask OurFilm to start the service
        before the 14-day cancellation period ends. I understand that, if I
        cancel after service has started, I may have to pay for the proportion
        already supplied. The {privacy} explains how personal data is handled.
      </span>
    )
  }

  return (
    <span>
      Elfogadom az {terms}, és kijelentem, hogy megismertem az {privacy}.
      Kifejezetten kérem, hogy az OurFilm a 14 napos elállási/felmondási
      határidő lejárta előtt kezdje meg a szolgáltatás teljesítését. Tudomásul
      veszem, hogy felmondás esetén a felmondás közléséig arányosan teljesített
      szolgáltatás díját meg kell fizetnem, valamint azt, hogy a szolgáltatás
      maradéktalan teljesítését követően elveszítem a felmondási jogomat.
    </span>
  )
}
