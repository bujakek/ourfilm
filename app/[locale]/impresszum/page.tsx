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

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params
  return {
    title: locale === 'en' ? 'Legal notice — OurFilm' : 'Impresszum — OurFilm',
    description:
      locale === 'en'
        ? 'Legal and contact details of the OurFilm service provider.'
        : 'Az OurFilm szolgáltatójának kötelező azonosító adatai.',
    ...(hasRealCompanyDetails
      ? {}
      : { robots: { index: false, follow: true } }),
  }
}

const sections: LegalSection[] = [
  {
    title: 'A szolgáltató adatai',
    body: [
      `Név: ${COMPANY.name}.`,
      `Székhely: ${COMPANY.seat}.`,
      `Nyilvántartási szám: ${COMPANY.registryNumber}. Nyilvántartó: ${REGISTRY}.`,
      `Adószám: ${COMPANY.taxNumber}.`,
    ],
  },
  {
    title: 'Elérhetőség',
    body: [`E-mail: ${CONTACT_EMAIL}.`],
  },
  {
    title: 'Tárhelyszolgáltató',
    body: [HOSTING_PROVIDER],
  },
]

const englishSections: LegalSection[] = [
  {
    title: 'Service provider',
    body: [
      `Name: ${COMPANY.name}.`,
      `Registered office: ${COMPANY.seat}.`,
      `Sole trader registration number: ${COMPANY.registryNumber}. Register: ${REGISTRY}.`,
      `Tax number: ${COMPANY.taxNumber}.`,
    ],
  },
  {
    title: 'Contact',
    body: [
      `Email: ${CONTACT_EMAIL}. No telephone contact is currently provided.`,
    ],
  },
  { title: 'Hosting provider', body: [HOSTING_PROVIDER] },
]

type Props = { params: Promise<{ locale: string }> }

export default async function ImpresszumPage({ params }: Props) {
  const { locale } = await params
  if (!isLocale(locale)) notFound()

  return (
    <PageShell
      locale={locale}
      eyebrow={locale === 'en' ? 'LEGAL NOTICE' : 'IMPRESSZUM'}
      title={
        locale === 'en' ? 'Service provider details' : 'Szolgáltatói adatok'
      }
      lead={
        locale === 'en'
          ? 'Identity and contact details of the operator of OurFilm.'
          : 'Az OurFilm üzemeltetőjének azonosító és kapcsolattartási adatai.'
      }
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
          <LegalSections
            sections={locale === 'en' ? englishSections : sections}
          />
          <p className="mt-12 text-sm text-muted-foreground">
            {locale === 'en' ? 'Last updated' : 'Utolsó frissítés'}:{' '}
            {LAST_UPDATED}
          </p>
        </div>
      </section>
    </PageShell>
  )
}
