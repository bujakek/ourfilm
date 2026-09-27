import { DraftNotice } from '@/components/site/draft-notice'
import type { LegalSection } from '@/components/site/legal-sections'
import { InfoPage, InfoSections } from '@/components/pages/info-page'
import { SiteShell } from '@/components/pages/site-shell'
import {
  COMPANY,
  REGISTRY,
  hasRealCompanyDetails,
  HOSTING_PROVIDER,
  LAST_UPDATED,
} from '@/lib/company'
import { isLocale } from '@/lib/i18n'
import { CONTACT_EMAIL } from '@/lib/site'
import { localizedPageAlternates } from '@/lib/seo'
import type { Metadata } from 'next'
import { notFound } from 'next/navigation'

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params
  if (!isLocale(locale)) return {}
  return {
    title: locale === 'en' ? 'Legal notice — OurFilm' : 'Impresszum — OurFilm',
    description:
      locale === 'en'
        ? 'Legal and contact details of the OurFilm service provider.'
        : 'Az OurFilm szolgáltatójának kötelező azonosító adatai.',
    alternates: localizedPageAlternates(locale, '/impresszum'),
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
    <SiteShell locale={locale}>
      <InfoPage
        title={
          locale === 'en' ? 'Service provider details' : 'Szolgáltatói adatok'
        }
        intro={
          locale === 'en'
            ? 'Identity and contact details of the operator of OurFilm.'
            : 'Az OurFilm üzemeltetőjének azonosító és kapcsolattartási adatai.'
        }
      >
        <>
          {hasRealCompanyDetails ? null : (
            <DraftNotice>
              <strong className="font-semibold text-foreground">
                Ez még piszkozat.
              </strong>{' '}
              A <code>lib/company.ts</code> TODO értékeit valódi vállalkozói
              adatokra kell cserélni az indulás előtt.
            </DraftNotice>
          )}
          <InfoSections
            sections={locale === 'en' ? englishSections : sections}
          />
          <p>
            {locale === 'en' ? 'Last updated' : 'Utolsó frissítés'}:{' '}
            {LAST_UPDATED}
          </p>
        </>
      </InfoPage>
    </SiteShell>
  )
}
