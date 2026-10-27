import { OccasionCards } from '@/components/pages/occasion-cards'
import { occasionScreen } from '@/components/pages/occasion-screen'
import {
  SITE_CONTAINER,
  SITE_HEADING,
  SITE_KICKER,
  SITE_LEAD,
} from '@/components/pages/layout'
import { SiteClosing } from '@/components/pages/site-closing'
import { SiteShell } from '@/components/pages/site-shell'
import { OCCASIONS_ARE_DRAFT } from '@/lib/occasions'
import type { Metadata } from 'next'
import { isLocale } from '@/lib/i18n'
import { localizedPageAlternates } from '@/lib/seo'
import { cn } from '@/lib/utils'
import { notFound } from 'next/navigation'

const pageCopy = {
  en: {
    title: 'A Digital Guest Camera for Every Occasion – OurFilm',
    description:
      'Wedding, birthday, trip or party: give everyone their own digital roll with one QR code. No app or accounts.',
    kicker: 'Occasions',
    headingLines: ['For every occasion', 'worth seeing again.'],
    leadLines: [
      'The occasion changes, the shared camera stays.',
      'Your moments, from everyone’s point of view.',
    ],
  },
  hu: {
    title: 'Digitális vendégkamera minden alkalomra – OurFilm',
    description:
      'Esküvő, születésnap, utazás vagy buli: adj mindenkinek saját digitális tekercset QR-kóddal, alkalmazás és regisztráció nélkül.',
    kicker: 'Alkalmak',
    headingLines: ['Minden alkalomra,', 'amit jó újra látni.'],
    leadLines: [
      'Az alkalom változik, a közös kamera marad.',
      'A ti pillanataitok, mindenki szemszögéből.',
    ],
  },
} as const

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params
  if (!isLocale(locale)) return {}
  const current = pageCopy[locale]
  return {
    title: current.title,
    description: current.description,
    alternates: localizedPageAlternates(locale, '/alkalmak'),
    ...(OCCASIONS_ARE_DRAFT ? { robots: { index: false, follow: true } } : {}),
  }
}

type Props = { params: Promise<{ locale: string }> }

/** The four occasions, each a card leading to its own page. */
export default async function AlkalmakPage({ params }: Props) {
  const { locale } = await params
  if (!isLocale(locale)) notFound()
  const current = pageCopy[locale]

  return (
    <SiteShell locale={locale}>
      <section className={SITE_CONTAINER}>
        <div className="pt-25 text-center">
          <p className={cn(SITE_KICKER, 'mb-5 tab:mb-10')}>{current.kicker}</p>
          <h1 className={SITE_HEADING}>
            {current.headingLines.map((line) => (
              <span key={line} className="block">
                {line}
              </span>
            ))}
          </h1>
          <p className={cn(SITE_LEAD, 'mt-4')}>
            {current.leadLines.map((line) => (
              <span key={line} className="tab:block">
                {line}{' '}
              </span>
            ))}
          </p>
        </div>
        <div className="mt-10 tab:mt-[70px]">
          <OccasionCards locale={locale} />
        </div>
      </section>
      <SiteClosing locale={locale} content={occasionScreen(locale, 'travel')} />
    </SiteShell>
  )
}
