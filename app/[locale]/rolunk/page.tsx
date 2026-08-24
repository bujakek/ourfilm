import { PageShell } from '@/components/site/page-shell'
import { Camera, Heart, MapPin } from 'lucide-react'
import type { Metadata } from 'next'
import Link from 'next/link'
import { isLocale, localePath } from '@/lib/i18n'
import { notFound } from 'next/navigation'

const TITLE = 'Rólunk – OurFilm'
const DESCRIPTION =
  'Az OurFilm egy saját esküvő után született, amikor a vendégek fotóinak nagy része sosem jutott el hozzánk.'

export const metadata: Metadata = {
  title: TITLE,
  description: DESCRIPTION,
  openGraph: { title: TITLE, description: DESCRIPTION },
  // Held back with the rest of the standalone pages until the provider's
  // details are real and /arak may be indexed — not because the copy below is
  // unfinished. Flip it in the same change that publishes those.
  robots: { index: false, follow: true },
}

// Only what is verifiably true. Headcount, customer numbers and testimonials
// are deliberately absent rather than invented.
const facts = [
  {
    icon: MapPin,
    title: 'Budapesten készül',
    text: 'Az OurFilm magyar fejlesztés.',
  },
  {
    icon: Camera,
    title: 'Egy esküvőből indult',
    text: 'A saját esküvőnkre kerestünk megoldást. Ma másoknak segítünk összegyűjteni a vendégeik fotóit.',
  },
  {
    icon: Heart,
    title: 'Egyszerű a vendégeknek',
    text: 'Nincs app és nincs regisztráció. Beolvassák a QR-kódot, és feltöltik a képeiket.',
  },
]

type Props = { params: Promise<{ locale: string }> }

export default async function RolunkPage({ params }: Props) {
  const { locale } = await params
  if (!isLocale(locale)) notFound()

  return (
    <PageShell
      locale={locale}
      eyebrow="RÓLUNK"
      title="Azért készítettük el, mert velünk is megtörtént."
      lead="Egy esemény emlékei ritkán férnek el egyetlen fényképezőgépben. A vendégek telefonjain is rengeteg kép készül, és sok közülük sosem jut el a házigazdához."
    >
      <section className="relative px-4 pb-24 sm:px-6 lg:pb-32">
        <div className="mx-auto max-w-3xl">
          <div className="mt-12 space-y-5 text-lg leading-relaxed text-pretty text-muted-foreground">
            <p>
              Az OurFilm ötlete a saját esküvőnk után született. A vendégeink
              rengeteget fotóztak, de a képek különböző telefonokon és
              beszélgetésekben maradtak. Sok közülük végül sosem jutott el
              hozzánk.
            </p>
            <p>
              Csak később láttuk, mennyi minden történt aznap, amiről nekünk
              egyetlen fotónk sem volt. Nem azért, mert nem készültek képek,
              hanem mert nem volt egy hely, ahová mindenki feltölthette volna
              őket.
            </p>
            <p>
              Ezért készítettük el az OurFilmet: egy QR-kód, és minden
              vendégfotó egy közös albumba kerül.
            </p>
          </div>

          <div className="mt-14 grid gap-4 sm:grid-cols-3">
            {facts.map((fact) => (
              <article
                key={fact.title}
                className="glass flex h-full flex-col rounded-3xl p-7"
              >
                <span className="glass flex size-12 items-center justify-center rounded-2xl">
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

          <div className="glass-strong mt-14 rounded-3xl p-8 sm:p-10">
            <h2 className="text-2xl font-semibold tracking-tight text-balance">
              Kérdésed van?
            </h2>
            <p className="mt-3 leading-relaxed text-pretty text-muted-foreground">
              Írd meg, milyen eseményre készülsz, és segítünk létrehozni az
              albumot.
            </p>
            <Link
              href={localePath(locale, '/kapcsolat')}
              className="btn-shine mt-7 inline-flex items-center justify-center rounded-full bg-primary px-7 py-3.5 text-sm font-semibold text-primary-foreground transition-transform hover:scale-[1.03]"
            >
              Írj nekünk
            </Link>
          </div>
        </div>
      </section>
    </PageShell>
  )
}
