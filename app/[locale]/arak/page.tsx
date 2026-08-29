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

const copy = {
  en: {
    title: 'Pricing – OurFilm',
    description: `One complete wedding guest camera for HUF 12,900. Try it free with up to ${FREE_PARTICIPANT_LIMIT} guests.`,
    eyebrow: 'PRICING',
    heading: 'One wedding. One camera. One price.',
    lead: 'No subscription and no per-guest fee. Pay once and invite everyone.',
    plan: 'FULL EVENT',
    price: 'HUF 12,900',
    payment: 'one-time payment',
    body: 'Every guest gets their own roll. Reveal the photos right away or wait until the event ends.',
    create: 'Create your camera',
    helper: 'No app. No guest accounts.',
    includedHeading: 'Everything you need for the day.',
    included: [
      'Unlimited guests',
      'A personal roll for every guest',
      'Your own QR code and invite link',
      'Instant or end-of-event reveal',
      'A private photo gallery',
      'Download the complete album',
    ],
    tryHeading: 'Try it before you pay.',
    tryBody: `Use every feature free with up to ${FREE_PARTICIPANT_LIMIT} guests. If more people join, one payment unlocks the full event.`,
    noCard: 'No card required',
    question: 'Still have a question?',
    contact: 'Contact us',
    or: 'or read the',
    faq: 'FAQ',
  },
  hu: {
    title: 'Árak – OurFilm',
    description: `Egy teljes esküvői vendégkamera ${EVENT_PRICE_LABEL}-ért, egyszeri fizetéssel. Legfeljebb ${FREE_PARTICIPANT_LIMIT} vendéggel ingyen kipróbálható.`,
    eyebrow: 'ÁRAK',
    heading: 'Egy esküvő. Egy kamera. Egy ár.',
    lead: 'Nincs előfizetés és nincs vendégenkénti díj. Egyszer fizettek, az egész násznép fotózhat.',
    plan: 'TELJES ESEMÉNY',
    price: EVENT_PRICE_LABEL,
    payment: 'egyszeri fizetés',
    body: 'Minden vendég saját tekercset kap. A képeket pedig azonnal vagy az este végén nézhetitek meg együtt.',
    create: 'Hozd létre ingyen',
    helper: 'Nincs app. Nincs vendégregisztráció.',
    includedHeading: 'Minden benne van, ami az estéhez kell.',
    included: [
      'Korlátlan számú vendég',
      'Saját tekercs minden vendégnek',
      'Saját QR-kód és meghívólink',
      'Azonnali vagy esemény végi előhívás',
      'Privát galéria a képeknek',
      'Az egész album letöltése',
    ],
    tryHeading: 'Előbb próbáld ki.',
    tryBody: `Legfeljebb ${FREE_PARTICIPANT_LIMIT} vendéggel teljesen ingyen használhatod. Ha többen csatlakoznának, egyetlen fizetéssel feloldhatod a teljes eseményt.`,
    noCard: 'Bankkártya nélkül',
    question: 'Kérdésed van?',
    contact: 'Írj nekünk',
    or: 'vagy nézd meg a',
    faq: 'gyakori kérdéseket',
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
    robots: { index: hasRealCompanyDetails, follow: true },
  }
}

type Props = { params: Promise<{ locale: string }> }

export default async function ArakPage({ params }: Props) {
  const { locale } = await params
  if (!isLocale(locale)) notFound()
  const current = copy[locale]

  return (
    <PageShell
      locale={locale}
      eyebrow={current.eyebrow}
      title={current.heading}
      lead={current.lead}
    >
      <section className="relative px-4 pb-24 sm:px-6 lg:pb-32">
        <div className="mx-auto max-w-4xl">
          <article className="glass-strong overflow-hidden rounded-[2rem]">
            <div className="grid gap-10 p-7 sm:p-10 lg:grid-cols-[0.9fr_1.1fr] lg:gap-14 lg:p-12">
              <div className="flex flex-col">
                <p className="text-xs font-medium tracking-[0.2em] text-accent uppercase">
                  {current.plan}
                </p>

                <p className="mt-5 flex flex-wrap items-baseline gap-x-3 gap-y-1">
                  <span className="text-gradient text-5xl font-semibold tracking-tight sm:text-6xl">
                    {current.price}
                  </span>
                  <span className="text-sm text-muted-foreground">
                    {current.payment}
                  </span>
                </p>

                <p className="mt-5 max-w-md leading-relaxed text-pretty text-muted-foreground">
                  {current.body}
                </p>

                <Link
                  href={`${CREATE_EVENT_PATH}?lang=${locale}`}
                  className="btn-shine mt-8 inline-flex min-h-12 items-center justify-center rounded-full bg-primary px-7 text-sm font-semibold text-primary-foreground transition-transform hover:scale-[1.03]"
                >
                  {current.create}
                </Link>
                <p className="mt-3 text-center text-xs leading-relaxed text-muted-foreground">
                  {current.helper}
                </p>
              </div>

              <div className="border-t border-border pt-8 lg:border-t-0 lg:border-l lg:pt-0 lg:pl-14">
                <h2 className="text-xl font-semibold tracking-tight">
                  {current.includedHeading}
                </h2>
                <ul className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-1">
                  {current.included.map((item) => (
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
                  <h2 className="font-semibold">{current.tryHeading}</h2>
                  <p className="mt-1.5 text-sm leading-relaxed text-pretty text-muted-foreground">
                    {current.tryBody}
                  </p>
                </div>
                <span className="glass shrink-0 rounded-full px-4 py-2 text-xs font-medium text-accent">
                  {current.noCard}
                </span>
              </div>
            </div>
          </article>

          <p className="mx-auto mt-10 max-w-2xl text-center text-sm leading-relaxed text-pretty text-muted-foreground">
            {current.question}{' '}
            <Link
              href={localePath(locale, '/kapcsolat')}
              className="text-accent underline underline-offset-4 transition-colors hover:text-foreground"
            >
              {current.contact}
            </Link>{' '}
            {current.or}{' '}
            <Link
              href={localePath(locale, '/#faq')}
              className="text-accent underline underline-offset-4 transition-colors hover:text-foreground"
            >
              {current.faq}
            </Link>
            .
          </p>
        </div>
      </section>
    </PageShell>
  )
}
