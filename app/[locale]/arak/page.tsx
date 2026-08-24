import { PageShell } from '@/components/site/page-shell'
import { hasRealCompanyDetails } from '@/lib/company'
import { Check } from 'lucide-react'
import type { Metadata } from 'next'
import Link from 'next/link'
import { isLocale, localePath } from '@/lib/i18n'
import { notFound } from 'next/navigation'

const TITLE = 'Árak – OurFilm'
const DESCRIPTION =
  'Korlátlan vendég és korlátlan fotó, egyszeri 12 900 Ft-ért. Előfizetés nélkül, 5 fotóig ingyen kipróbálható.'

export const metadata: Metadata = {
  title: TITLE,
  description: DESCRIPTION,
  openGraph: { title: TITLE, description: DESCRIPTION },
  // Indexed only once the provider's details are real. The prices below are
  // now final, but a price a stranger can find in Google leads to an ÁSZF
  // that still says [NÉV — TODO], and a service cannot lawfully be sold to a
  // consumer while the mandatory identifiers are placeholders. One flag,
  // flipped in lib/company.ts, releases the whole set of pages together.
  robots: { index: hasRealCompanyDetails, follow: true },
}

// The numbers here are real and load-bearing.
//
// - 12 900 Ft is the amount configured on the Stripe Price that
//   STRIPE_PRICE_EVENT points at. If one changes, the other has to.
// - The 5-photo free cap comes from `public.free_photo_limit()` and is
//   enforced on every guest upload. Raising it means changing both.
//
// No gross/net split is shown because there is none to show: the provider
// charges no VAT, and the displayed figure is simply the amount payable.
interface Tier {
  name: string
  /** Absent on the partner card, which is quoted rather than priced. */
  price?: string
  cadence?: string
  description: string
  features?: string[]
  cta: string
  featured: boolean
}

const tiers: Tier[] = [
  {
    name: 'Ingyenes próba',
    price: '0 Ft',
    cadence: 'egy eseményre',
    description: 'Próbáld ki 5 fotóval, bankkártya nélkül.',
    features: [
      'Egy esemény',
      '5 feltöltött fotó',
      'Korlátlan vendég',
      'Saját QR-kód',
      'Közös album',
    ],
    cta: 'Próbáld ki ingyen',
    featured: false,
  },
  {
    name: 'Teljes esemény',
    price: '12 900 Ft',
    cadence: 'egyszeri díj',
    description:
      'Minden, amire szükséged van ahhoz, hogy egy helyre gyűjtsd a vendégeid képeit.',
    features: [
      'Korlátlan vendég',
      'Korlátlan fotó',
      'Saját QR-kód és meghívólink',
      'Minden kép egy közös albumban',
      'Az egész album letöltése',
      'Te döntöd el, mi látszik az albumban',
      'Nincs előfizetés',
    ],
    cta: 'Esemény létrehozása',
    featured: true,
  },
  {
    name: 'Partnereknek',
    description: 'Több eseményt kezelsz? Írj nekünk egyedi ajánlatért.',
    cta: 'Írj nekünk',
    featured: false,
  },
]

type Props = { params: Promise<{ locale: string }> }

export default async function ArakPage({ params }: Props) {
  const { locale } = await params
  if (!isLocale(locale)) notFound()

  return (
    <PageShell
      locale={locale}
      eyebrow="ÁRAK"
      title="Korlátlan vendég. Korlátlan fotó. Egyszeri 12 900 Ft."
      lead="Nincs előfizetés. Nincs vendégenkénti díj."
    >
      <section className="relative px-4 pb-24 sm:px-6 lg:pb-32">
        <div className="mx-auto max-w-6xl">
          <div className="mt-12 grid gap-4 lg:grid-cols-3">
            {tiers.map((tier) => (
              <article
                key={tier.name}
                className={`glass flex h-full flex-col rounded-3xl p-8 ${
                  tier.featured ? 'ring-1 ring-accent/40 ring-inset' : ''
                }`}
              >
                <div className="flex items-center justify-between gap-3">
                  <h2 className="text-lg font-semibold">{tier.name}</h2>
                  {tier.featured ? (
                    <span className="glass rounded-full px-3 py-1 text-xs font-medium text-accent">
                      Ajánlott
                    </span>
                  ) : null}
                </div>

                {tier.price ? (
                  <p className="mt-5 flex items-baseline gap-2">
                    <span className="text-gradient text-4xl font-semibold tracking-tight">
                      {tier.price}
                    </span>
                    {tier.cadence ? (
                      <span className="text-sm text-muted-foreground">
                        {tier.cadence}
                      </span>
                    ) : null}
                  </p>
                ) : null}

                <p className="mt-3 text-sm leading-relaxed text-pretty text-muted-foreground">
                  {tier.description}
                </p>

                {tier.features ? (
                  <ul className="mt-7 flex flex-1 flex-col gap-3">
                    {tier.features.map((feature) => (
                      <li key={feature} className="flex gap-3 text-sm">
                        <Check
                          className="mt-0.5 size-4 shrink-0 text-accent"
                          strokeWidth={2}
                          aria-hidden="true"
                        />
                        <span className="text-foreground/90">{feature}</span>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <div className="flex-1" />
                )}

                <Link
                  href={
                    tier.name === 'Partnereknek'
                      ? localePath(locale, '/kapcsolat')
                      : '/admin/login'
                  }
                  className={`mt-8 inline-flex items-center justify-center rounded-full px-6 py-3.5 text-sm font-semibold transition-transform hover:scale-[1.03] ${
                    tier.featured
                      ? 'btn-shine bg-primary text-primary-foreground'
                      : 'glass glass-hover text-foreground'
                  }`}
                >
                  {tier.cta}
                </Link>
              </article>
            ))}
          </div>

          <p className="mx-auto mt-10 max-w-3xl text-sm leading-relaxed text-pretty text-muted-foreground">
            Kérdésed van?{' '}
            <Link
              href={localePath(locale, '/kapcsolat')}
              className="text-accent underline underline-offset-4 transition-colors hover:text-foreground"
            >
              Írj nekünk
            </Link>
            , vagy nézd meg a{' '}
            <Link
              href={localePath(locale, '/#faq')}
              className="text-accent underline underline-offset-4 transition-colors hover:text-foreground"
            >
              gyakori kérdéseket
            </Link>
            .
          </p>
        </div>
      </section>
    </PageShell>
  )
}
