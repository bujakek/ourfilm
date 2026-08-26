import type { Metadata } from 'next'
import { notFound } from 'next/navigation'

import { LegalPage } from '@/components/site/legal-page'
import { isLocale } from '@/lib/i18n'
import { hasCompleteLegalConfig } from '@/lib/legal/config'
import { processingAnnexDocument } from '@/lib/legal/copy/adatfeldolgozasi-melleklet'

const doc = processingAnnexDocument()

export const metadata: Metadata = {
  title: `${doc.title} — OurFilm`,
  description: doc.description,
  // Information pages, so they are indexable — but only once the mandatory
  // identifiers are real. A page that says HIÁNYZÓ KÖTELEZŐ ADAT must not be
  // the thing a search engine shows for "OurFilm ÁSZF".
  robots: { index: hasCompleteLegalConfig(), follow: true },
}

type Props = { params: Promise<{ locale: string }> }

export default async function Page({ params }: Props) {
  const { locale } = await params
  if (!isLocale(locale)) notFound()

  return <LegalPage locale={locale} eyebrow="ADATFELDOLGOZÁS" document={doc} />
}
