import { DraftNotice } from '@/components/site/draft-notice'
import {
  LegalSections,
  type LegalSection,
} from '@/components/site/legal-sections'
import { PageShell } from '@/components/site/page-shell'
import {
  COMPANY,
  REGISTRY,
  hasRealCompanyDetails,
  HOSTING_PROVIDER,
  LAST_UPDATED,
} from '@/lib/company'
import { isLocale } from '@/lib/i18n'
import { CONTACT_EMAIL } from '@/lib/site'
import type { Metadata } from 'next'
import { notFound } from 'next/navigation'

export const metadata: Metadata = {
  title: 'Impresszum — OurFilm',
  description: 'Az OurFilm szolgáltatójának kötelező azonosító adatai.',
  ...(hasRealCompanyDetails ? {} : { robots: { index: false, follow: true } }),
}

const sections: LegalSection[] = [
  {
    title: 'A szolgáltató adatai',
    body: [
      `Név: ${COMPANY.name}.`,
      `Székhely: ${COMPANY.seat}.`,
      `Nyilvántartási szám: ${COMPANY.registryNumber}. Nyilvántartó: ${REGISTRY}.`,
      `Adószám: ${COMPANY.taxNumber}.`,
      `Szakmai kamara: ${COMPANY.chamber}.`,
    ],
  },
  {
    title: 'Elérhetőség',
    body: [`E-mail: ${CONTACT_EMAIL}.`, `Telefonszám: ${COMPANY.phone}.`],
  },
  {
    title: 'Tárhelyszolgáltató',
    body: [HOSTING_PROVIDER],
  },
]

type Props = { params: Promise<{ locale: string }> }

export default async function ImpresszumPage({ params }: Props) {
  const { locale } = await params
  if (!isLocale(locale)) notFound()

  return (
    <PageShell
      locale={locale}
      eyebrow="IMPRESSZUM"
      title="Szolgáltatói adatok"
      lead="Az OurFilm üzemeltetőjének azonosító és kapcsolattartási adatai."
    >
      <section className="relative px-4 pb-24 sm:px-6 lg:pb-32">
        <div className="mx-auto max-w-3xl">
          {hasRealCompanyDetails ? null : (
            <DraftNotice>
              <strong className="font-semibold text-foreground">
                Ez még piszkozat.
              </strong>{' '}
              A <code>lib/company.ts</code> TODO értékeit valódi vállalkozói
              adatokra kell cserélni az indulás előtt.
            </DraftNotice>
          )}
          <LegalSections sections={sections} />
          <p className="mt-12 text-sm text-muted-foreground">
            Utolsó frissítés: {LAST_UPDATED}
          </p>
        </div>
      </section>
    </PageShell>
  )
}
