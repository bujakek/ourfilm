import { ChevronRight } from 'lucide-react'
import Link from 'next/link'

import { SHOT_OPTIONS } from '@/lib/camera'
import { type Locale, localePath } from '@/lib/i18n'
import {
  type Occasion,
  type OccasionId,
  occasionCopy,
  occasionPath,
  occasions,
} from '@/lib/occasions'
import { CREATE_EVENT_PATH } from '@/lib/routes'
import { siteCopy } from '@/lib/site-copy'
import { cn } from '@/lib/utils'

import {
  SITE_BUTTON,
  SITE_CONTAINER,
  SITE_HEADING,
  SITE_KICKER,
  SITE_LEAD,
} from './layout'
import { occasionScreen } from './occasion-screen'
import { SiteClosing } from './site-closing'
import { SiteFaq } from './site-faq'
import { PhonePair, SitePhone } from './site-phones'

/** Which of an occasion's six features is about when the photos appear —
 *  the one the reveal card beside the two phones states. */
const REVEAL_FEATURE: Record<OccasionId, number> = {
  wedding: 1,
  birthday: 1,
  travel: 1,
  party: 2,
}

const rolls = (or: string) =>
  `${SHOT_OPTIONS.slice(0, -1).join(', ')} ${or} ${SHOT_OPTIONS.at(-1)}`

/** The three cards every occasion shares. Each is a live product claim. */
const shared = {
  en: {
    noApp: {
      title: 'No app. No guest sign-up.',
      lines: [
        'One QR code, a couple of taps, and everyone is shooting.',
        'On iPhone and Android, in the browser.',
      ],
    },
    private: {
      title: 'Your photos. Your album.',
      text: 'You decide whether the gallery opens for guests too, or stays with you. As the host you can hide any photo.',
    },
    settings: {
      title: 'You write the rules of the roll.',
      text: `${rolls('or')} frames per guest. An instant reveal, or a shared surprise at the end.`,
    },
    allOccasions: 'All occasions',
  },
  hu: {
    noApp: {
      title: 'Nincs app. Nincs vendégregisztráció.',
      lines: [
        'Egy QR-kód, néhány kattintás, és már fotózhattok is.',
        'iPhone-on és Androidon, a böngészőben.',
      ],
    },
    private: {
      title: 'A ti képeitek. A ti albumotok.',
      text: 'Te döntöd el, hogy a galéria a vendégeknek is megnyíljon, vagy csak nálad maradjon. Házigazdaként bármelyik képet elrejtheted.',
    },
    settings: {
      title: 'A tekercs szabályait te írod.',
      text: `${rolls('vagy')} képkocka vendégenként. Azonnali előhívás vagy közös meglepetés a végén.`,
    },
    allOccasions: 'Minden alkalom',
  },
} as const

const FEATURE_TITLE =
  'font-landing-display text-[26px] leading-[1.2] text-white landing-serif'
const FEATURE_TEXT = 'mt-2.5 text-[16px] leading-[1.6] text-site-muted'
/** A phone shown from its top down, fading out where it is cut. */
const CROPPED =
  'overflow-hidden [mask-image:linear-gradient(#000_80%,transparent)]'

/**
 * One occasion, argued the way the homepage argues the product: its own
 * headline beside the two phones, the problem in the occasion's words, five
 * cards of what the camera does, its own questions, and the closing ask.
 *
 * Every sentence that is not shared across occasions comes from
 * `lib/occasions.ts`, which is the one definition the sitemap, the footer and
 * the homepage also read.
 */
export function OccasionPage({
  locale,
  occasion,
}: {
  locale: Locale
  occasion: Occasion
}) {
  const copy = occasionCopy(locale, occasion)
  const common = shared[locale]
  const screen = occasionScreen(locale, occasion.id)
  const [intro, share] = copy.sections
  const reveal = copy.features.items[REVEAL_FEATURE[occasion.id]]

  return (
    <>
      <section
        className={cn(
          SITE_CONTAINER,
          'flex flex-col gap-7 pt-25 pb-[70px] tab:grid tab:grid-cols-2 tab:gap-9 tab:pb-20',
        )}
      >
        <div className="mx-auto max-w-[360px] text-center tab:mx-0 tab:max-w-none tab:text-left">
          <p className={cn(SITE_KICKER, 'mb-5 tab:mb-10')}>{copy.label}</p>
          <h1 className={cn(SITE_HEADING, 'mb-7 tab:mb-2.5')}>{copy.title}</h1>
          <p className={cn(SITE_LEAD, 'mb-10 hidden max-w-[590px] tab:block')}>
            {copy.text}
          </p>
          <Link
            href={`${CREATE_EVENT_PATH}?lang=${locale}`}
            className={SITE_BUTTON}
          >
            {siteCopy[locale].create}
          </Link>
        </div>
        <PhonePair
          locale={locale}
          content={screen}
          className="mx-auto w-full max-w-[430px] tab:max-w-none"
        />
      </section>

      <section
        className={cn(
          SITE_CONTAINER,
          'border-y border-site-line py-[70px] text-center tab:py-[120px]',
        )}
      >
        <h2
          className={cn(
            SITE_HEADING,
            'mx-auto mb-6 max-w-[660px] tab:mb-[30px]',
          )}
        >
          {intro.heading}
        </h2>
        <p className="mx-auto max-w-[540px] text-[16px] leading-[1.6] text-site-muted tab:text-[18px]">
          {intro.body}
        </p>
      </section>

      <section className={cn(SITE_CONTAINER, 'tab:grid tab:grid-cols-2')}>
        <Feature className="tab:border-r">
          <h3 className={FEATURE_TITLE}>{share.heading}</h3>
          <p className={FEATURE_TEXT}>{share.body}</p>
          <div
            className={cn(
              CROPPED,
              'mx-auto mt-[30px] h-[440px] max-w-[255px] [mask-image:linear-gradient(#000_88%,transparent)] tab:mt-10 tab:h-[510px] tab:max-w-[335px]',
            )}
          >
            <SitePhone locale={locale} screen="host" content={screen} />
          </div>
        </Feature>

        <Feature className="flex flex-col tab:justify-end">
          <div className="order-2 mt-[34px] grid grid-cols-2 gap-3 tab:order-none tab:mt-2.5 tab:mb-11">
            <SitePhone locale={locale} screen="guest" content={screen} />
            <SitePhone
              locale={locale}
              screen="host"
              content={screen}
              className="translate-y-5"
            />
          </div>
          <div>
            <h3 className={FEATURE_TITLE}>{reveal.title}</h3>
            <p className={FEATURE_TEXT}>{reveal.text}</p>
          </div>
        </Feature>

        <Feature className="h-[600px] pb-0 tab:col-span-2 tab:h-[550px] tab:border-y tab:pb-0 tab:text-center xl:h-[700px] xl:pb-0">
          <h3 className={FEATURE_TITLE}>{common.noApp.title}</h3>
          <p className={FEATURE_TEXT}>
            {common.noApp.lines.map((line) => (
              <span key={line} className="tab:block">
                {line}{' '}
              </span>
            ))}
          </p>
          <div
            className={cn(
              CROPPED,
              'mt-[35px] flex w-[520px] -translate-x-[88px] gap-4 [mask-image:linear-gradient(#000_78%,transparent)] tab:mx-auto tab:mt-15 tab:w-auto tab:max-w-[1010px] tab:translate-x-0 tab:justify-center tab:gap-10',
            )}
          >
            <SitePhone
              locale={locale}
              screen="setup"
              className="mt-[30px] w-[calc((100%-32px)/3)] tab:mt-0 tab:w-[calc((100%-80px)/3)]"
            />
            <SitePhone
              locale={locale}
              screen="host"
              content={screen}
              className="w-[calc((100%-32px)/3)] tab:mt-7 tab:w-[calc((100%-80px)/3)]"
            />
            <SitePhone
              locale={locale}
              screen="guest"
              content={screen}
              className="mt-[30px] w-[calc((100%-32px)/3)] tab:mt-0 tab:w-[calc((100%-80px)/3)]"
            />
          </div>
        </Feature>

        <Feature className="tab:border-r">
          <div
            className={cn(
              CROPPED,
              'mx-auto mb-[34px] h-[320px] max-w-[255px] tab:h-[340px] tab:max-w-[335px]',
            )}
          >
            <SitePhone locale={locale} screen="host" content={screen} />
          </div>
          <h3 className={FEATURE_TITLE}>{common.private.title}</h3>
          <p className={FEATURE_TEXT}>{common.private.text}</p>
        </Feature>

        <Feature>
          <h3 className={FEATURE_TITLE}>{common.settings.title}</h3>
          <p className={FEATURE_TEXT}>{common.settings.text}</p>
          <div
            className={cn(
              CROPPED,
              'mx-auto mt-[30px] h-[330px] max-w-[255px] tab:mt-10 tab:h-[350px] tab:max-w-[335px]',
            )}
          >
            <SitePhone locale={locale} screen="setup" />
          </div>
        </Feature>
      </section>

      <SiteFaq
        kicker={siteCopy[locale].faqKicker}
        title={siteCopy[locale].faqTitle}
        items={copy.faq}
      />
      <SiteClosing locale={locale} content={screen} />

      <nav
        aria-label={copy.label}
        className={cn(
          SITE_CONTAINER,
          'flex flex-wrap justify-center gap-[18px] pt-10 pb-15 text-[14px] text-site-soft tab:gap-9 tab:pb-[90px] tab:text-[15px]',
        )}
      >
        <Link
          href={localePath(locale, '/alkalmak')}
          className="transition-colors hover:text-white"
        >
          {common.allOccasions}
        </Link>
        {occasions
          .filter((other) => other.id !== occasion.id)
          .map((other) => (
            <Link
              key={other.id}
              href={occasionPath(locale, other)}
              className="flex items-center gap-2 transition-colors hover:text-white"
            >
              {occasionCopy(locale, other).label}
              <ChevronRight aria-hidden="true" className="size-3" />
            </Link>
          ))}
      </nav>
    </>
  )
}

/** One cell of the feature grid: ruled below on a phone, beside on a desktop. */
function Feature({
  className,
  children,
}: {
  className?: string
  children: React.ReactNode
}) {
  return (
    <div
      className={cn(
        'overflow-hidden border-b border-site-line px-2.5 py-[50px] tab:border-b-0 tab:px-[25px] tab:py-[50px] xl:px-[38px] xl:py-[70px]',
        className,
      )}
    >
      {children}
    </div>
  )
}
