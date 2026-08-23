import { DraftNotice } from '@/components/site/draft-notice'
import { PageShell } from '@/components/site/page-shell'
import { hasRealCompanyDetails, VAT_STATUS } from '@/lib/company'
import { Check } from 'lucide-react'
import type { Metadata } from 'next'
import Link from 'next/link'
import { isLocale, localePath } from '@/lib/i18n'
import { notFound } from 'next/navigation'

export const metadata: Metadata = {
  title: 'Árak — OurFilm',
  description:
    'Az OurFilm csomagjai eseményekhez. Egy esemény, egy QR-kód, korlátlan vendég.',
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
// No gross/net split is shown because there is none to show: the provider is
// alanyi adómentes and charges no VAT. See VAT_STATUS in lib/company.ts.
const tiers = [
  {
    name: 'Próba',
    price: '0 Ft',
    cadence: 'egy eseményre',
    description: 'Nézd meg, hogy működik, mielőtt bármit fizetnél.',
    features: [
      'Egy esemény',
      '5 kép az albumban',
      'Korlátlan vendég',
      'Feltöltés QR-kóddal',
      'Közös album',
    ],
    cta: 'Kezdd el ingyen',
    featured: false,
  },
  {
    name: 'Esemény',
    price: '12 900 Ft',
    cadence: 'egyszeri díj, eseményenként',
    description: 'Egy nagy naphoz, a teljes albummal és letöltéssel.',
    features: [
      'Minden, ami a Próbában',
      'Korlátlan számú kép',
      'Nyomtatható felbontás (4096 px)',
      'Teljes album letöltése ZIP-ben',
      'Fotók elrejtése moderáláshoz',
      'Nyomtatható QR-kártya',
    ],
    cta: 'Esemény létrehozása',
    featured: true,
  },
  {
    name: 'Egyedi',
    price: 'Egyedi',
    cadence: 'megbeszélés szerint',
    description: 'Több eseményre vagy visszatérő alkalmakra.',
    features: [
      'Minden, ami az Esemény csomagban',
      'Több esemény egy fiókban',
      'Egyedi igények',
    ],
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
      title="Egy esemény, egy ár"
      lead="Nincs előfizetés és nincs vendégenkénti díj — a vendégeid soha nem fizetnek semmit, és nem is regisztrálnak."
    >
      <section className="relative px-4 pb-24 sm:px-6 lg:pb-32">
        <div className="mx-auto max-w-6xl">
          <div className="mx-auto max-w-3xl">
            {hasRealCompanyDetails ? null : (
              <DraftNotice>
                <strong className="font-semibold text-foreground">
                  Ez az oldal még nem éles.
                </strong>{' '}
                Az összegek véglegesek, de a szolgáltatás megrendelése még nem
                indult el. Az oldal addig nem jelenik meg a keresőkben.
              </DraftNotice>
            )}
          </div>

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

                <p className="mt-5 flex items-baseline gap-2">
                  <span className="text-gradient text-4xl font-semibold tracking-tight">
                    {tier.price}
                  </span>
                  <span className="text-sm text-muted-foreground">
                    {tier.cadence}
                  </span>
                </p>

                <p className="mt-3 text-sm leading-relaxed text-pretty text-muted-foreground">
                  {tier.description}
                </p>

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

                <Link
                  href={
                    tier.name === 'Egyedi'
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
            {VAT_STATUS.priceNote}
          </p>

          <p className="mx-auto mt-4 max-w-3xl text-sm leading-relaxed text-pretty text-muted-foreground">
            Kérdésed van a csomagokról?{' '}
            <Link
              href={localePath(locale, '/kapcsolat')}
              className="text-accent underline underline-offset-4 transition-colors hover:text-foreground"
            >
              Írj nekünk
            </Link>{' '}
            — vagy nézd meg a{' '}
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
