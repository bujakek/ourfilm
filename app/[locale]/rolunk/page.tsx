import { DraftNotice } from '@/components/site/draft-notice'
import { PageShell } from '@/components/site/page-shell'
import { Heart, MapPin, Users } from 'lucide-react'
import type { Metadata } from 'next'
import Link from 'next/link'
import { isLocale, localePath } from '@/lib/i18n'
import { notFound } from 'next/navigation'

export const metadata: Metadata = {
  title: 'Rólunk — OurFilm',
  description:
    'Kik állnak az OurFilm mögött. Budapesten készül, azért, hogy egy esemény minden fotója egy helyre kerüljön.',
  // TODO(copy): remove once the real team and story copy lands.
  robots: { index: false, follow: true },
}

// PLACEHOLDER — scaffolding only. Names, headcount and dates are deliberately
// left out rather than invented; fill these in with the real story.
const facts = [
  {
    icon: MapPin,
    title: 'Budapesten készül',
    text: 'Itt találjuk ki, itt írjuk, és itt teszteljük — magyar eseményeken, magyar vendégekkel.',
  },
  {
    icon: Users,
    title: 'Kicsi csapat',
    text: 'TODO: hányan vagytok, és ki mit csinál. Egy-két mondat elég.',
  },
  {
    icon: Heart,
    title: 'Miért csináljuk',
    text: 'TODO: az eredeti történet — melyik esemény után hiányoztak a vendégek fotói.',
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
      title="Az esemény minden vendég szemével"
      lead="Egy jó esemény legszebb képei ritkán egy fényképezőgépben vannak. Szét vannak szórva húsz telefonon — és ott is maradnak."
    >
      <section className="relative px-4 pb-24 sm:px-6 lg:pb-32">
        <div className="mx-auto max-w-3xl">
          <DraftNotice>
            <strong className="font-semibold text-foreground">
              Ez az oldal még vázlat.
            </strong>{' '}
            A szerkezet kész, a szöveg egy része helykitöltő — a „TODO” jelölésű
            részeket kell valódi tartalomra cserélni. Az oldal egyelőre nem
            jelenik meg a keresőkben.
          </DraftNotice>

          <div className="mt-12 space-y-5 text-lg leading-relaxed text-pretty text-muted-foreground">
            <p>
              Az OurFilm egyetlen dolgot csinál: a vendégek beolvassák a
              QR-kódot, és a telefonjuk böngészőjéből feltöltik a képeiket.
              Nincs alkalmazás, nincs regisztráció, nincs jelszó — mert minden
              egyes lépés, amit egy vendégnek meg kell tennie, több tucat
              elmaradt fotót jelent.
            </p>
            <p>
              TODO: itt jön a valódi történet. Honnan jött az ötlet, mikor
              kezdtétek, és mi az, amit másképp csináltok, mint a fotómegosztó
              alkalmazások.
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
              Egy ember olvassa a leveleket, és tényleg válaszol.
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
