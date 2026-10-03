import { InfoPage } from '@/components/pages/info-page'
import { SiteShell } from '@/components/pages/site-shell'
import type { Metadata } from 'next'
import Link from 'next/link'
import { isLocale, localePath } from '@/lib/i18n'
import { localizedPageAlternates } from '@/lib/seo'
import { notFound } from 'next/navigation'

const copy = {
  en: {
    title: 'About – OurFilm',
    description:
      'OurFilm began after our own wedding, when many of the photos our guests took never reached us.',
    eyebrow: 'ABOUT',
    heading: 'We built the thing we wished we had.',
    lead: 'A wedding never fits inside one camera. Guests capture hundreds of moments too — but many of those photos never make it back to the couple.',
    paragraphs: [
      'OurFilm began after our own wedding. Our guests took plenty of photos, but they stayed scattered across phones and message threads. Many never reached us.',
      'Only later did we realise how much of the day we had missed. The photos existed. There simply was not one easy place for everyone to put them.',
      'So we built OurFilm: one QR code, one shared camera and every guest photo in one private gallery.',
    ],
    facts: [
      ['Made in Budapest', 'OurFilm is built in Hungary.'],
      [
        'Born from a real wedding',
        'We looked for this at our own wedding. Now we help other couples collect the moments their guests capture.',
      ],
      [
        'Easy for every guest',
        'No app and no account. They scan the QR code and start shooting.',
      ],
    ],
    question: 'Have a question?',
    questionBody:
      'Tell us what you are planning and we will help you set up your camera.',
    contact: 'Talk to us',
  },
  hu: {
    title: 'Rólunk – OurFilm',
    description:
      'Az OurFilm egy saját esküvő után született, amikor a vendégek fotóinak nagy része sosem jutott el hozzánk.',
    eyebrow: 'RÓLUNK',
    heading: 'Azért készítettük el, mert nekünk is hiányzott.',
    lead: 'Egy fotós sem lehet ott minden pillanatnál. Közben a vendégek is rengeteget fotóznak — csak ezek a képek sokszor sosem jutnak el a párhoz.',
    paragraphs: [
      'Az OurFilm ötlete a saját esküvőnk után született. A vendégeink rengeteget fotóztak, de a képek különböző telefonokon és üzenetváltásokban maradtak. Sok közülük végül sosem jutott el hozzánk.',
      'Csak később döbbentünk rá, mennyi minden történt aznap a látóterünkön kívül. A képek elkészültek, csak nem volt egyetlen közös hely, ahol megtalálhattuk volna őket.',
      'Ezért készítettük el az OurFilmet: egy QR-kóddal minden vendég ugyanazt a közös kamerát nyitja meg, a képek pedig egy privát galériába kerülnek.',
    ],
    facts: [
      ['Budapesten készül', 'Az OurFilm magyar fejlesztés.'],
      [
        'Egy esküvőből indult',
        'A saját esküvőnkre kerestünk megoldást. Ma másoknak segítünk összegyűjteni a vendégeik fotóit.',
      ],
      [
        'Egyszerű a vendégeknek',
        'Nincs app és nincs regisztráció. Beolvassák a QR-kódot, és már fotózhatnak is.',
      ],
    ],
    question: 'Kérdésed van?',
    questionBody:
      'Írd meg, milyen eseményre készülsz, és segítünk beállítani a kamerát.',
    contact: 'Írj nekünk',
  },
} as const

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params
  if (!isLocale(locale)) return {}
  const current = copy[locale]
  return {
    title: current.title,
    description: current.description,
    openGraph: { title: current.title, description: current.description },
    alternates: localizedPageAlternates(locale, '/rolunk'),
    robots: { index: false, follow: true },
  }
}

type Props = { params: Promise<{ locale: string }> }

export default async function RolunkPage({ params }: Props) {
  const { locale } = await params
  if (!isLocale(locale)) notFound()
  const current = copy[locale]

  return (
    <SiteShell locale={locale}>
      <InfoPage title={current.heading} intro={current.lead}>
        {current.paragraphs.map((paragraph) => (
          <p key={paragraph}>{paragraph}</p>
        ))}
        {current.facts.map(([title, text]) => (
          <section key={title}>
            <h2>{title}</h2>
            <p>{text}</p>
          </section>
        ))}
        <section>
          <h2>{current.question}</h2>
          <p>{current.questionBody}</p>
          <p>
            <Link href={localePath(locale, '/kapcsolat')}>
              {current.contact}
            </Link>
          </p>
        </section>
      </InfoPage>
    </SiteShell>
  )
}
