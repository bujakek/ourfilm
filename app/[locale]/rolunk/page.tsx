import { PageShell } from '@/components/site/page-shell'
import { Camera, Heart, MapPin } from 'lucide-react'
import type { Metadata } from 'next'
import Link from 'next/link'
import { isLocale, localePath } from '@/lib/i18n'
import { notFound } from 'next/navigation'

export const metadata: Metadata = {
  title: 'Rólunk — OurFilm',
  description:
    'Az OurFilm egy saját esküvő után született: a vendégek fotói szétszóródtak, és sok közülük sosem jutott vissza hozzánk.',
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
    text: 'Az OurFilm magyar fejlesztés, amelyet valódi eseményeken, valódi vendégekkel tesztelünk.',
  },
  {
    icon: Camera,
    title: 'Egy esküvőből indult',
    text: 'A vendégek képeinek nagy része sosem jutott el hozzánk. Ebből lett az OurFilm.',
  },
  {
    icon: Heart,
    title: 'Amit fontosnak tartunk',
    text: 'A vendégnek ne kelljen semmit telepítenie vagy regisztrálnia. Egy QR-kód, és kész.',
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
      title="Azért csináljuk, mert velünk is megtörtént"
      lead="Egy esemény emlékei ritkán férnek el egyetlen fényképezőgépben. A vendégek telefonjain is rengeteg kép készül, és sok közülük sosem jut el a házigazdához."
    >
      <section className="relative px-4 pb-24 sm:px-6 lg:pb-32">
        <div className="mx-auto max-w-3xl">
          <div className="mt-12 space-y-5 text-lg leading-relaxed text-pretty text-muted-foreground">
            <p>
              Az ötlet a saját esküvőnk után született. Béreltünk egy Instax
              fényképezőgépet, hogy a vendégek is fotózzanak, és tényleg
              fotóztak. A kész képek egy része aztán elveszett, más része soha
              nem jutott vissza hozzánk. Ami telefonnal készült, az különböző
              Messenger-beszélgetésekben maradt, és amit végül elküldtek, azt az
              üzenetküldő gyakran össze is nyomta.
            </p>
            <p>
              Utólag derült ki, mennyi minden történt a napon, amiről nekünk
              egyetlen fotónk sem volt. Nem a fotós hibája: ő nem lehet
              egyszerre az asztaloknál, a készülődésnél és a hajnali bulin.
            </p>
            <p>
              Ezért csináltuk meg az OurFilmet úgy, hogy a vendégnek semmit ne
              kelljen telepítenie vagy regisztrálnia. Beolvassa a QR-kódot,
              feltölti a képeit, és ennyi. Amit feltöltenek, az egy helyre
              érkezik, és a házigazda egyben letöltheti.
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
              Írd meg, mire készülsz, és segítünk kitalálni, hogyan érdemes
              megosztanod a QR-kódot.
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
