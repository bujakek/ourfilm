import { PageShell } from '@/components/site/page-shell'
import { hasRealCompanyDetails } from '@/lib/company'
import { isLocale, localePath } from '@/lib/i18n'
import { FREE_PARTICIPANT_LIMIT } from '@/lib/onboarding'
import { EVENT_PRICE_LABEL } from '@/lib/pricing'
import { CREATE_EVENT_PATH } from '@/lib/routes'
import { Check } from 'lucide-react'
import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'

const TITLE = 'Árak – OurFilm'
const DESCRIPTION = `Egy teljes esküvői vendégkamera ${EVENT_PRICE_LABEL}-ért, egyszeri fizetéssel. Legfeljebb ${FREE_PARTICIPANT_LIMIT} vendéggel ingyen kipróbálható.`

export const metadata: Metadata = {
  title: TITLE,
  description: DESCRIPTION,
  openGraph: { title: TITLE, description: DESCRIPTION },
  // Indexed only once the provider's details are real. A price a stranger can
  // find in Google must not lead to legal pages with placeholder identifiers.
  robots: { index: hasRealCompanyDetails, follow: true },
}

const included = [
  'Korlátlan számú vendég',
  'Saját tekercs minden vendégnek',
  'Saját QR-kód és meghívólink',
  'Azonnali vagy esemény végi előhívás',
  'Privát galéria a képeknek',
  'Az egész album letöltése',
]

type Props = { params: Promise<{ locale: string }> }

export default async function ArakPage({ params }: Props) {
  const { locale } = await params
  if (!isLocale(locale)) notFound()

  return (
    <PageShell
      locale={locale}
      eyebrow="ÁRAK"
      title="Egy esküvő. Egy kamera. Egy ár."
      lead="Nincs előfizetés és nincs vendégenkénti díj. Egyszer fizettek, az egész násznép fotózhat."
    >
      <section className="relative px-4 pb-24 sm:px-6 lg:pb-32">
        <div className="mx-auto max-w-4xl">
          <article className="glass-strong overflow-hidden rounded-[2rem]">
            <div className="grid gap-10 p-7 sm:p-10 lg:grid-cols-[0.9fr_1.1fr] lg:gap-14 lg:p-12">
              <div className="flex flex-col">
                <p className="text-xs font-medium tracking-[0.2em] text-accent uppercase">
                  Teljes esemény
                </p>

                <p className="mt-5 flex flex-wrap items-baseline gap-x-3 gap-y-1">
                  <span className="text-gradient text-5xl font-semibold tracking-tight sm:text-6xl">
                    {EVENT_PRICE_LABEL}
                  </span>
                  <span className="text-sm text-muted-foreground">
                    egyszeri fizetés
                  </span>
                </p>

                <p className="mt-5 max-w-md leading-relaxed text-pretty text-muted-foreground">
                  Minden vendég saját tekercset kap. A képeket pedig azonnal
                  vagy az este végén nézhetitek meg együtt.
                </p>

                <Link
                  href={CREATE_EVENT_PATH}
                  className="btn-shine mt-8 inline-flex min-h-12 items-center justify-center rounded-full bg-primary px-7 text-sm font-semibold text-primary-foreground transition-transform hover:scale-[1.03]"
                >
                  Hozd létre ingyen
                </Link>
                <p className="mt-3 text-center text-xs leading-relaxed text-muted-foreground">
                  Nincs app. Nincs vendégregisztráció.
                </p>
              </div>

              <div className="border-t border-border pt-8 lg:border-t-0 lg:border-l lg:pt-0 lg:pl-14">
                <h2 className="text-xl font-semibold tracking-tight">
                  Minden benne van, ami az estéhez kell.
                </h2>
                <ul className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-1">
                  {included.map((item) => (
                    <li key={item} className="flex items-start gap-3 text-sm">
                      <span className="mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full bg-accent/15">
                        <Check
                          className="size-3.5 text-accent"
                          strokeWidth={2.2}
                          aria-hidden="true"
                        />
                      </span>
                      <span className="leading-relaxed text-foreground/90">
                        {item}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>

            <div className="border-t border-border bg-white/[0.025] px-7 py-7 sm:px-10 lg:px-12">
              <div className="flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
                <div className="max-w-2xl">
                  <h2 className="font-semibold">Előbb próbáld ki.</h2>
                  <p className="mt-1.5 text-sm leading-relaxed text-pretty text-muted-foreground">
                    Legfeljebb {FREE_PARTICIPANT_LIMIT} vendéggel teljesen
                    ingyen használhatod. Ha többen csatlakoznának, egyetlen
                    fizetéssel feloldhatod a teljes eseményt.
                  </p>
                </div>
                <span className="glass shrink-0 rounded-full px-4 py-2 text-xs font-medium text-accent">
                  Bankkártya nélkül
                </span>
              </div>
            </div>
          </article>

          <p className="mx-auto mt-10 max-w-2xl text-center text-sm leading-relaxed text-pretty text-muted-foreground">
            Kérdésed van?{' '}
            <Link
              href={localePath(locale, '/kapcsolat')}
              className="text-accent underline underline-offset-4 transition-colors hover:text-foreground"
            >
              Írj nekünk
            </Link>{' '}
            vagy nézd meg a{' '}
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
