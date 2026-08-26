import { DraftNotice } from '@/components/site/draft-notice'
import { PageShell } from '@/components/site/page-shell'
import { hasRealCompanyDetails, LAST_UPDATED } from '@/lib/company'
import { isLocale } from '@/lib/i18n'
import { CONTACT_EMAIL } from '@/lib/site'
import type { Metadata } from 'next'
import { notFound } from 'next/navigation'

export const metadata: Metadata = {
  title: 'Elállás — OurFilm',
  description:
    'Tájékoztató és elektronikus nyilatkozat az OurFilm fizetős szolgáltatásától való elálláshoz.',
  ...(hasRealCompanyDetails ? {} : { robots: { index: false, follow: true } }),
}

const withdrawalTemplate = [
  'Címzett: OurFilm',
  '',
  'Alulírott kijelentem, hogy elállok az alábbi OurFilm-szolgáltatásra vonatkozó szerződéstől.',
  '',
  'Esemény neve vagy linkje:',
  'Megrendelés / fizetés időpontja:',
  'A fogyasztó neve:',
  'A fiókhoz használt e-mail-cím:',
  'Kelt:',
].join('\n')

const withdrawalMailto = `mailto:${CONTACT_EMAIL}?subject=${encodeURIComponent(
  'Elállási nyilatkozat – OurFilm',
)}&body=${encodeURIComponent(withdrawalTemplate)}`

type Props = { params: Promise<{ locale: string }> }

export default async function ElallasPage({ params }: Props) {
  const { locale } = await params
  if (!isLocale(locale)) notFound()

  return (
    <PageShell
      locale={locale}
      eyebrow="ELÁLLÁS"
      title="Elállási nyilatkozat"
      lead="Ha fogyasztóként fizettél, itt tudod egyszerűen közölni az elállási szándékodat."
    >
      <section className="relative px-4 pb-24 sm:px-6 lg:pb-32">
        <div className="mx-auto max-w-3xl">
          {hasRealCompanyDetails ? null : (
            <DraftNotice>
              A fizetős indulás előtt töltsd ki a szolgáltatói adatokat, és
              ellenőrizd, hogy a <strong>{CONTACT_EMAIL}</strong> postafiók
              fogad és azonnal vissza tud igazolni levelet.
            </DraftNotice>
          )}

          <div className="mt-12 space-y-5 leading-relaxed text-pretty text-muted-foreground">
            <p>
              A fizetős szerződés megkötésétől számított 14 napon belül
              indokolás nélkül elállhatsz, ha fogyasztónak minősülsz. Ehhez
              kattints az alábbi gombra: a leveleződben megnyílik a szükséges
              adatokat tartalmazó minta.
            </p>
            <p>
              A nyilatkozat akkor határidőben közölt, ha a 14 napos határidő
              lejárta előtt elküldöd. A beérkezést e-mailben visszaigazoljuk.
              Használhatsz saját szöveget is, ha abból egyértelműen kiderül,
              hogy elállsz a szerződéstől.
            </p>

            <a
              href={withdrawalMailto}
              className="btn-shine inline-flex min-h-12 items-center justify-center rounded-full bg-primary px-6 text-sm font-semibold text-primary-foreground"
            >
              Elállási nyilatkozat elküldése e-mailben
            </a>

            <div className="glass rounded-2xl px-5 py-4 text-sm">
              <p className="font-medium text-foreground">
                Ha nem nyílik meg a leveleződ
              </p>
              <p className="mt-2">
                Küldd el a nyilatkozatot a <strong>{CONTACT_EMAIL}</strong>{' '}
                címre „Elállási nyilatkozat” tárggyal. Add meg az esemény nevét
                vagy linkjét, a fizetés időpontját, a nevedet és a fiókodhoz
                használt e-mail-címet.
              </p>
            </div>
          </div>

          <p className="mt-12 text-sm text-muted-foreground">
            Utolsó frissítés: {LAST_UPDATED}
          </p>
        </div>
      </section>
    </PageShell>
  )
}
