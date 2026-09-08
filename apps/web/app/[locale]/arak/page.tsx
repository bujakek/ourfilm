import { PageShell } from '@/components/site/page-shell'
import { hasRealCompanyDetails } from '@/lib/company'
import { isLocale, localePath } from '@/lib/i18n'
import { FREE_PARTICIPANT_LIMIT } from '@/lib/onboarding'
import { EVENT_PRICE_LABEL, EVENT_PRICE_LABELS } from '@/lib/pricing'
import { CREATE_EVENT_PATH } from '@/lib/routes'
import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'

const copy = {
  en: {
    title: 'Pricing – OurFilm',
    description: `One complete wedding guest camera for ${EVENT_PRICE_LABELS.en}. Try it free with up to ${FREE_PARTICIPANT_LIMIT} guests.`,
    eyebrow: 'PRICING',
    heading: 'One wedding. One camera. One price.',
    lead: 'No subscription and no per-guest fee. Pay once and invite everyone.',
    plan: 'FULL EVENT',
    price: EVENT_PRICE_LABELS.en,
    paymentLine: 'ONE-TIME PAYMENT · UNLIMITED GUESTS',
    body: 'Every guest gets their own roll. Reveal the photos right away or wait until the event ends.',
    create: 'Create your camera',
    helper: 'No app. No guest accounts.',
    includedHeading: 'Everything you need for the day.',
    /**
     * A receipt lists values; a checklist only lists that things exist. Each
     * row is what you get and how much of it — which is the question the
     * sentence "A personal roll for every guest" made a reader work out.
     */
    specs: [
      ['Guests', 'UNLIMITED'],
      ['Roll per guest', '5–36 SHOTS'],
      ['QR code & invite link', 'YOUR OWN'],
      ['Developing', 'INSTANT / AT THE END'],
      ['Gallery', 'PRIVATE'],
      ['Album download', 'FULL, PRINT-READY'],
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
    paymentLine: 'EGYSZERI FIZETÉS · KORLÁTLAN SZÁMÚ VENDÉG',
    body: 'Minden vendég saját tekercset kap. A képeket pedig azonnal vagy az este végén nézhetitek meg együtt.',
    create: 'Hozzátok létre ingyen',
    helper: 'Nincs app. Nincs vendégregisztráció.',
    includedHeading: 'Minden benne van, ami a naphoz kell.',
    specs: [
      ['Vendégek', 'NINCS KORLÁT'],
      ['Tekercs vendégenként', '5–36 KÉP'],
      ['QR-kód és meghívólink', 'EGYEDI'],
      ['Előhívás', 'AZONNAL / VÉGÉN'],
      ['Galéria', 'PRIVÁT'],
      ['Album letöltése', 'EGYBEN, ZIP-BEN'],
    ],
    tryHeading: 'Előbb próbáld ki.',
    tryBody: `Legfeljebb ${FREE_PARTICIPANT_LIMIT} vendéggel teljesen ingyen használhatjátok. Ha többen csatlakoznának, egyetlen fizetéssel megszüntethetitek a vendéglimitet.`,
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
          {/* One receipt, in paper. The `glass-strong` panel it replaces was
              the same material as everything else on the page, which left the
              price — the one thing this page exists to state — competing with
              its own container. */}
          <article className="paper overflow-hidden rounded-2xl">
            <div className="grid gap-10 p-7 sm:p-10 lg:grid-cols-[0.9fr_1.1fr] lg:gap-14 lg:p-12">
              <div className="flex flex-col">
                <p className="paper-muted font-mono text-[9.5px] font-medium tracking-[0.2em]">
                  {current.plan}
                </p>

                {/* `word-spacing` because Martian Mono's word space is very
                    wide, and "12 900" is one number rather than two. The
                    silver `text-gradient` is gone: a price is a figure, and the
                    counting voice is what the rest of the product now reads it
                    in. `EVENT_PRICE_LABELS` stays the only source. */}
                <p className="mt-5 flex flex-wrap items-baseline gap-x-2">
                  <span className="font-mono text-[62px] leading-none font-medium tracking-[-0.055em] [word-spacing:-0.3em]">
                    {priceAmount(current.price)}
                  </span>
                  <span className="font-mono text-[26px] font-medium tracking-[-0.04em]">
                    {priceUnit(current.price)}
                  </span>
                </p>

                <p className="paper-muted mt-4 font-mono text-[9.5px] font-medium tracking-[0.16em]">
                  {current.paymentLine}
                </p>

                <p className="paper-muted mt-5 max-w-md text-[14.5px] leading-relaxed text-pretty">
                  {current.body}
                </p>

                <Link
                  href={`${CREATE_EVENT_PATH}?lang=${locale}`}
                  className="btn-shine mt-8 inline-flex min-h-13 items-center justify-center rounded-lg bg-[color:var(--paper-foreground)] px-7 text-[15px] font-semibold text-[color:var(--paper)]"
                >
                  {current.create}
                </Link>
                {/* Manrope, not the mono: two short sentences are still
                    sentences, and the counting voice is for what the camera
                    counts. */}
                <p className="paper-muted mt-3 text-center text-[11.5px] leading-relaxed">
                  {current.helper}
                </p>
              </div>

              <div className="paper-rule border-t pt-8 lg:border-t-0 lg:border-l lg:pt-0 lg:pl-14">
                <h2 className="font-display text-[24px] leading-tight">
                  {current.includedHeading}
                </h2>
                <dl className="mt-6">
                  {current.specs.map(([label, value]) => (
                    <div
                      key={label}
                      className="paper-rule flex items-baseline justify-between gap-5 border-b py-3"
                    >
                      <dt className="text-[14.5px]">{label}</dt>
                      <dd className="text-right font-mono text-[12px] font-medium tracking-[0.06em]">
                        {value}
                      </dd>
                    </div>
                  ))}
                </dl>
              </div>
            </div>

            {/* The free tier stays a footer on the same sheet: it is the same
                receipt, read from the other end. */}
            <div className="paper-rule border-t bg-[rgba(20,19,18,.04)] px-7 py-7 sm:px-10 lg:px-12">
              <div className="flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
                <p className="paper-muted max-w-2xl text-[14.5px] leading-relaxed text-pretty">
                  <strong className="font-semibold text-[color:var(--paper-foreground)]">
                    {current.tryHeading}
                  </strong>{' '}
                  {current.tryBody}
                </p>
                <span className="shrink-0 rounded-full border border-[rgba(20,19,18,.2)] px-4 py-2 font-mono text-[9.5px] font-medium tracking-[0.14em]">
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

/**
 * Splits a price label into its figure and its unit, so the two can be set at
 * different sizes without either being written down twice.
 *
 * The unit is the last space-separated token — `12 900 Ft` is a number with a
 * thousands space in it, not two words — which holds for both live labels and
 * fails visibly rather than silently for a shape neither matches.
 */
function priceAmount(label: string): string {
  return label.slice(0, label.lastIndexOf(' ')) || label
}

function priceUnit(label: string): string {
  return label.slice(label.lastIndexOf(' ') + 1)
}
