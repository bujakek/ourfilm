import { PageShell } from '@/components/site/page-shell'
import { Camera, Heart, MapPin } from 'lucide-react'
import type { Metadata } from 'next'
import Link from 'next/link'
import { buttonVariants } from '@/components/ui/button'
import { isLocale, localePath } from '@/lib/i18n'
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
const icons = [MapPin, Camera, Heart]

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params
  if (!isLocale(locale)) return {}
  const current = copy[locale]
  return {
    title: current.title,
    description: current.description,
    openGraph: { title: current.title, description: current.description },
    robots: { index: false, follow: true },
  }
}

type Props = { params: Promise<{ locale: string }> }

export default async function RolunkPage({ params }: Props) {
  const { locale } = await params
  if (!isLocale(locale)) notFound()
  const current = copy[locale]
  const facts = current.facts.map(([title, text], index) => ({
    title,
    text,
    icon: icons[index],
  }))

  return (
    <PageShell
      locale={locale}
      eyebrow={current.eyebrow}
      title={current.heading}
      lead={current.lead}
    >
      <section className="relative px-4 pb-24 sm:px-6 lg:pb-32">
        <div className="mx-auto max-w-3xl">
          <div className="mt-12 space-y-5 text-lg leading-relaxed text-pretty text-muted-foreground">
            {current.paragraphs.map((paragraph) => (
              <p key={paragraph}>{paragraph}</p>
            ))}
          </div>

          <div className="mt-14 grid gap-4 sm:grid-cols-3">
            {facts.map((fact) => (
              <article
                key={fact.title}
                className="glass flex h-full flex-col rounded-2xl p-7"
              >
                <span className="glass flex size-12 items-center justify-center rounded-lg">
                  <fact.icon
                    className="size-6 text-accent"
                    strokeWidth={1.6}
                    aria-hidden="true"
                  />
                </span>
                <h2 className="mt-6 text-base font-semibold">{fact.title}</h2>
                <p className="mt-2 text-sm leading-relaxed text-pretty text-muted-foreground">
                  {fact.text}
                </p>
              </article>
            ))}
          </div>

          <div className="glass-strong mt-14 rounded-2xl p-8 sm:p-10">
            <h2 className="text-2xl font-semibold tracking-tight text-balance">
              {current.question}
            </h2>
            <p className="mt-3 leading-relaxed text-pretty text-muted-foreground">
              {current.questionBody}
            </p>
            <Link
              href={localePath(locale, '/kapcsolat')}
              className={buttonVariants({ className: 'mt-7' })}
            >
              {current.contact}
            </Link>
          </div>
        </div>
      </section>
    </PageShell>
  )
}
