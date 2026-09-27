import { OccasionCards } from '@/components/pages/occasion-cards'
import { occasionScreen } from '@/components/pages/occasion-screen'
import {
  SITE_BUTTON,
  SITE_CONTAINER,
  SITE_HEADING,
  SITE_KICKER,
  SITE_LEAD,
} from '@/components/pages/layout'
import { SiteClosing } from '@/components/pages/site-closing'
import { SiteFaq } from '@/components/pages/site-faq'
import { SiteShell } from '@/components/pages/site-shell'
import { SHOT_OPTIONS } from '@/lib/camera'
import { hasRealCompanyDetails } from '@/lib/company'
import { isLocale } from '@/lib/i18n'
import { FREE_PARTICIPANT_LIMIT } from '@/lib/onboarding'
import { EVENT_PRICE_LABEL, EVENT_PRICE_LABELS } from '@/lib/pricing'
import { CREATE_EVENT_PATH } from '@/lib/routes'
import { localizedPageAlternates } from '@/lib/seo'
import { cn } from '@/lib/utils'
import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'

/** `5, 10, 16, 24 or 36`, from the options the database accepts. */
const rolls = (or: string) =>
  `${SHOT_OPTIONS.slice(0, -1).join(', ')} ${or} ${SHOT_OPTIONS.at(-1)}`

const copy = {
  en: {
    title: 'Pricing – OurFilm',
    description: `One complete event camera for ${EVENT_PRICE_LABELS.en}. Try it free with up to ${FREE_PARTICIPANT_LIMIT} guests.`,
    kicker: 'Pricing',
    headingLines: ['One event.', 'One shared camera.', 'One price.'],
    leadLines: [
      'Pay once and the whole group can shoot.',
      'No subscription and no per-guest fee.',
    ],
    plan: 'Unlimited guests',
    price: EVENT_PRICE_LABELS.en,
    note: ['Full event', 'One-time payment'],
    included: 'Everything included',
    specs: [
      ['Guests', 'Unlimited'],
      ['Roll per guest', `${SHOT_OPTIONS[0]}–${SHOT_OPTIONS.at(-1)} shots`],
      ['QR code & invite link', 'Your own'],
      ['Developing', 'Instant / at the end'],
      ['Gallery', 'Private'],
      ['Album download', 'All at once, as a ZIP'],
    ],
    tryHeading: 'Try it first.',
    tryBody: `Free for up to ${FREE_PARTICIPANT_LIMIT} guests, no card required.`,
    create: 'Create for free',
    // Managed Payments: Link is the merchant of record outside Hungary, so
    // the total and the document come from Stripe's page, not from us.
    vatNote:
      'The final price and any applicable tax are shown in Stripe Checkout before you pay, and Link sends the invoice or receipt.',
    occasionsHeadingLines: ['For every occasion', 'worth looking back on.'],
    faqKicker: 'FAQ',
    faqTitle: 'Frequently asked questions',
    faq: [
      [
        'Can I try it for free?',
        `Yes. You can use OurFilm free with up to ${FREE_PARTICIPANT_LIMIT} guests, without a card. If more people want to join, one payment removes the guest limit.`,
      ],
      [
        'Do I pay for every event separately?',
        `The full event is a one-time ${EVENT_PRICE_LABELS.en}. It covers that event, with unlimited guests. There is no subscription and no per-guest fee.`,
      ],
      [
        'How many photos can a guest take?',
        `You choose ${rolls('or')} frames per guest. Everyone gets the same number on their own digital roll.`,
      ],
      [
        'What does the price include?',
        'Unlimited guests, your own QR code and invite link, the reveal you choose, a private gallery and the whole album as one ZIP download.',
      ],
      [
        'Do I get an invoice?',
        'Yes. Stripe Checkout shows the final price and any applicable tax before you pay, and Link sends the invoice or receipt by email.',
      ],
    ],
  },
  hu: {
    title: 'Árak · OurFilm',
    description: `Egy teljes eseménykamera ${EVENT_PRICE_LABEL}-ért, egyszeri fizetéssel. Legfeljebb ${FREE_PARTICIPANT_LIMIT} vendéggel ingyen kipróbálható.`,
    kicker: 'Árak',
    headingLines: ['Egy esemény.', 'Egy közös kamera.', 'Egyetlen ár.'],
    leadLines: [
      'Egyszer fizetsz, az egész társaság fotózhat.',
      'Nincs előfizetés és nincs vendégenkénti díj.',
    ],
    plan: 'Korlátlan vendég',
    price: EVENT_PRICE_LABEL,
    note: ['Teljes esemény', 'Egyszeri fizetés'],
    included: 'Minden benne van',
    specs: [
      ['Vendégek', 'Korlátlan'],
      ['Tekercs vendégenként', `${SHOT_OPTIONS[0]}–${SHOT_OPTIONS.at(-1)} kép`],
      ['QR-kód és meghívólink', 'Egyedi'],
      ['Előhívás', 'Azonnal / végén'],
      ['Galéria', 'Privát'],
      ['Album letöltése', 'Egyben, ZIP-ben'],
    ],
    tryHeading: 'Előbb próbáld ki.',
    tryBody: `${FREE_PARTICIPANT_LIMIT} vendégig ingyenes, bankkártya nélkül.`,
    create: 'Hozd létre ingyen',
    // Alanyi adómentes, so the figure above is the whole of it. A host who
    // reads a price and then meets a different total at checkout is the one
    // thing a price page must never do — and an áfás vevő has to know before
    // paying that there is no VAT here to reclaim.
    vatNote:
      'A feltüntetett ár a fizetendő végösszeg. A szolgáltató alanyi adómentes, ezért az összeg nem tartalmaz áfát, és áfa nem vonható le belőle. A számlát fizetés után e-mailben küldjük.',
    occasionsHeadingLines: ['Minden alkalomra,', 'amire jó visszanézni.'],
    faqKicker: 'GYIK',
    faqTitle: 'Gyakori kérdések',
    faq: [
      [
        'Kipróbálhatom ingyen?',
        `Igen. Legfeljebb ${FREE_PARTICIPANT_LIMIT} vendéggel ingyen használhatod az OurFilmet, bankkártya megadása nélkül. Ha többen csatlakoznának, egyetlen fizetéssel megszüntetheted a vendégkorlátot.`,
      ],
      [
        'Minden eseményért külön kell fizetnem?',
        `A teljes esemény ára egyszeri ${EVENT_PRICE_LABEL}. Ez az adott eseményre szól, korlátlan számú vendéggel. Nincs előfizetés és nincs vendégenkénti díj.`,
      ],
      [
        'Hány képet készíthet egy vendég?',
        `Te választod ki, hogy ${rolls('vagy')} képkocka jusson egy vendégnek. Mindenki ugyanannyi képet kap a saját digitális tekercsén.`,
      ],
      [
        'Mit tartalmaz az ár?',
        'Korlátlan számú vendéget, egyedi QR-kódot és meghívólinket, beállítható előhívást, privát galériát és az egész album letöltését, egyben, ZIP-ben.',
      ],
      [
        'Kapok számlát a fizetésről?',
        `Igen, a számlát fizetés után e-mailben küldjük. A feltüntetett ${EVENT_PRICE_LABEL} a fizetendő végösszeg. A szolgáltató alanyi adómentes, így az összeg nem tartalmaz áfát, és áfa nem vonható le belőle.`,
      ],
    ],
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
    alternates: localizedPageAlternates(locale, '/arak'),
    robots: { index: hasRealCompanyDetails, follow: true },
  }
}

type Props = { params: Promise<{ locale: string }> }

/**
 * One package, stated once: what it costs, what is in it, and that the first
 * five guests cost nothing. Then the occasions, the questions a buyer asks,
 * and the closing ask every page ends on.
 */
export default async function ArakPage({ params }: Props) {
  const { locale } = await params
  if (!isLocale(locale)) notFound()
  const current = copy[locale]
  const createHref = `${CREATE_EVENT_PATH}?lang=${locale}`

  return (
    <SiteShell locale={locale}>
      <section className={SITE_CONTAINER}>
        <div className="pt-25 text-center">
          <p className={cn(SITE_KICKER, 'mb-5 tab:mb-10')}>{current.kicker}</p>
          <h1 className={SITE_HEADING}>
            {current.headingLines.map((line) => (
              <span key={line} className="block">
                {line}
              </span>
            ))}
          </h1>
          <p className={cn(SITE_LEAD, 'mt-4 hidden tab:block')}>
            {current.leadLines.map((line) => (
              <span key={line} className="block">
                {line}
              </span>
            ))}
          </p>
        </div>

        <div className="mx-auto mt-[50px] max-w-[800px] tab:mt-[58px]">
          <div className="flex items-center justify-between gap-2.5 min-[360px]:gap-[15px] tab:items-baseline tab:gap-6">
            <h2 className="landing-serif max-w-[140px] font-landing-display text-[22px] leading-[1.2] text-white min-[360px]:text-[25px] tab:max-w-none tab:text-[30px]">
              {current.plan}
            </h2>
            <p className="landing-serif font-landing-display text-[28px] leading-[1.2] whitespace-nowrap text-white min-[360px]:text-[34px] tab:text-[44px]">
              {priceAmount(current.price)}{' '}
              <span className="text-[19px] min-[360px]:text-[22px] tab:text-[28px]">
                {priceUnit(current.price)}
              </span>
            </p>
          </div>
          <div className="mt-[22px] mb-[30px] flex justify-between gap-5 rounded-[20px] border border-site-line bg-site-note p-[18px] text-[14px] text-site-question tab:mt-6 tab:mb-[34px] tab:rounded-[24px] tab:px-6 tab:py-5 tab:text-[16px]">
            {current.note.map((item) => (
              <span key={item}>{item}</span>
            ))}
          </div>

          <p className={cn(SITE_KICKER, 'mb-[22px]')}>{current.included}</p>
          <dl className="grid gap-4 tab:grid-cols-2 tab:gap-x-10 tab:gap-y-[18px]">
            {current.specs.map(([term, value]) => (
              <div
                key={term}
                className="flex justify-between gap-3 text-[15px] tab:text-[16px]"
              >
                <dt className="text-site-term">{term}</dt>
                <dd className="text-right text-site-value">{value}</dd>
              </div>
            ))}
          </dl>

          <div className="mt-[30px] border-t border-site-line pt-7 pb-[22px] tab:mt-9 tab:flex tab:items-center tab:justify-between tab:gap-6 tab:pt-[34px] tab:pb-[26px]">
            <div>
              <h3 className="landing-serif font-landing-display text-[26px] leading-[1.2] text-white">
                {current.tryHeading}
              </h3>
              <p className="mt-2 text-[15px] text-site-muted">
                {current.tryBody}
              </p>
            </div>
            <Link
              href={createHref}
              className={cn(SITE_BUTTON, 'mt-6 flex tab:mt-0 tab:inline-flex')}
            >
              {current.create}
            </Link>
          </div>
          <p className="max-w-[740px] text-[12px] leading-[1.6] text-site-kicker tab:text-[13px] tab:leading-[1.5]">
            {current.vatNote}
          </p>
        </div>
      </section>

      <section className={cn(SITE_CONTAINER, 'pt-[90px] tab:pt-[150px]')}>
        <h2 className={cn(SITE_HEADING, 'mb-[35px] text-center tab:mb-15')}>
          {current.occasionsHeadingLines.map((line) => (
            <span key={line} className="block">
              {line}
            </span>
          ))}
        </h2>
        <OccasionCards locale={locale} compact />
      </section>

      <SiteFaq
        kicker={current.faqKicker}
        title={current.faqTitle}
        items={current.faq}
      />
      <SiteClosing
        locale={locale}
        content={occasionScreen(locale, 'birthday')}
      />
    </SiteShell>
  )
}

/**
 * Splits a price label into its figure and its unit, so the two can be set at
 * different sizes without either being written down twice.
 *
 * The unit is the last space-separated token — `12 900 Ft` is a number with a
 * thousands space in it, not two words.
 */
function priceAmount(label: string): string {
  return label.slice(0, label.lastIndexOf(' ')) || label
}

function priceUnit(label: string): string {
  return label.slice(label.lastIndexOf(' ') + 1)
}
