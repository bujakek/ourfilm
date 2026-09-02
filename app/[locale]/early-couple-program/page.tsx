import { EarlyCoupleApplicationForm } from './application-form'
import { PageShell } from '@/components/site/page-shell'
import { type Locale, isLocale } from '@/lib/i18n'
import { canonicalUrl } from '@/lib/seo'
import {
  CalendarHeart,
  Camera,
  HeartHandshake,
  MessageCircle,
} from 'lucide-react'
import type { Metadata } from 'next'
import Link from 'next/link'
import { buttonVariants } from '@/components/ui/button'
import { notFound } from 'next/navigation'

const programPath = '/early-couple-program'

const copy = {
  en: {
    title: 'Early Couple Program – Use OurFilm free at your wedding',
    description:
      'Use OurFilm free at your wedding in exchange for two short, honest feedback calls with the founder.',
    eyebrow: 'EARLY COUPLE PROGRAM',
    heading: 'Use OurFilm free at your wedding.',
    lead: 'We are inviting a small group of couples to shape OurFilm with us. You get the complete experience at no cost; we ask for two short, honest conversations in return.',
    cta: 'Apply for the program',
    helper: 'No card. No public review. No catch.',
    includedEyebrow: 'WHAT YOU GET',
    includedHeading: 'The full wedding experience, personally supported.',
    included: [
      [
        'OurFilm free for your wedding',
        'Create your private guest camera, share one QR code and collect every roll without paying for the event.',
      ],
      [
        'A direct line to the founder',
        'I will help you get set up and be your point of contact if anything comes up before the wedding.',
      ],
      [
        'A real say in what comes next',
        'Your experience will help decide what we simplify, improve and build before the public launch.',
      ],
    ],
    exchangeEyebrow: 'THE EXCHANGE',
    exchangeHeading: 'Two short calls. Honest feedback. That is all.',
    steps: [
      [
        'Apply below',
        'Tell us when and where you are getting married, and why OurFilm feels right for your day.',
      ],
      [
        'Talk before the wedding',
        'A short call to understand your plans, help with setup and hear what you expect from the experience.',
      ],
      [
        'Use OurFilm on the day',
        'Your guests scan the QR code and get their own limited roll. No app and no guest accounts.',
      ],
      [
        'Tell us how it went',
        'After the wedding, we have one more short call about what worked, what did not and what you would change.',
      ],
    ],
    fitHeading: 'Who this is for',
    fitBody:
      'Couples planning a real wedding who like the disposable-camera feeling and are willing to share thoughtful, unfiltered feedback. You do not need to be a creator, post about OurFilm or provide a testimonial.',
    formEyebrow: 'APPLY',
    formHeading: 'Tell us about your wedding.',
    formLead:
      'Applications are reviewed personally. If it looks like a good fit, you will hear from me by email with the next step.',
  },
  hu: {
    title: 'Early Couple Program – Használjátok ingyen az OurFilmet',
    description:
      'Használjátok ingyen az OurFilmet az esküvőtökön két rövid, őszinte visszajelző beszélgetésért cserébe.',
    eyebrow: 'EARLY COUPLE PROGRAM',
    heading: 'Használjátok ingyen az OurFilmet az esküvőtökön.',
    lead: 'Néhány párt keresünk, akik velünk együtt formálnák az OurFilmet. Ti ingyen megkapjátok a teljes élményt, cserébe két rövid, őszinte beszélgetést kérünk.',
    cta: 'Jelentkezünk a programba',
    helper:
      'Nincs bankkártya. Nincs kötelező nyilvános vélemény. Nincs apró betűs rész.',
    includedEyebrow: 'AMIT KAPTOK',
    includedHeading: 'A teljes esküvői élmény, személyes segítséggel.',
    included: [
      [
        'Ingyenes OurFilm az esküvőtökre',
        'Létrehozhatjátok a privát vendégkamerát, megoszthatjátok az egyetlen QR-kódot, és fizetés nélkül összegyűjthetitek az összes tekercset.',
      ],
      [
        'Közvetlen kapcsolat az alapítóval',
        'Segítek a beállításban, és személyesen fordulhattok hozzám, ha az esküvő előtt bármi felmerül.',
      ],
      [
        'Valódi beleszólás a folytatásba',
        'A tapasztalataitok alapján döntjük el, mit egyszerűsítsünk, javítsunk vagy építsünk meg a nyilvános indulás előtt.',
      ],
    ],
    exchangeEyebrow: 'AMIT CSERÉBE KÉRÜNK',
    exchangeHeading: 'Két rövid beszélgetés. Őszinte visszajelzés. Ennyi.',
    steps: [
      [
        'Jelentkezzetek lent',
        'Írjátok meg, mikor és hol lesz az esküvőtök, és miért tetszett meg nektek az OurFilm.',
      ],
      [
        'Beszéljünk az esküvő előtt',
        'Egy rövid hívásban megismerem a terveiteket, segítek a beállításban, és meghallgatom, mit vártok az élménytől.',
      ],
      [
        'Használjátok az OurFilmet a nagy napon',
        'A vendégek beolvassák a QR-kódot, és mindenki saját, véges tekercset kap. Nincs app és nincs vendégregisztráció.',
      ],
      [
        'Meséljétek el, milyen volt',
        'Az esküvő után még egyszer röviden beszélünk arról, mi működött, mi nem, és min változtatnátok.',
      ],
    ],
    fitHeading: 'Kiknek szól a program?',
    fitBody:
      'Olyan pároknak, akik valódi esküvőt szerveznek, szeretik az eldobható fényképezőgépek hangulatát, és szívesen adnak átgondolt, szűretlen visszajelzést. Nem kell tartalomgyártónak lennetek, posztolnotok az OurFilmről vagy nyilvános ajánlást adnotok.',
    formEyebrow: 'JELENTKEZÉS',
    formHeading: 'Meséljetek az esküvőtökről.',
    formLead:
      'Minden jelentkezést személyesen nézek át. Ha illik hozzátok a program, e-mailben jelentkezem a következő lépéssel.',
  },
} as const satisfies Record<Locale, Record<string, unknown>>

const benefitIcons = [Camera, HeartHandshake, MessageCircle]

type Props = {
  params: Promise<{ locale: string }>
  searchParams: Promise<Record<string, string | string[] | undefined>>
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params
  if (!isLocale(locale)) return {}
  const current = copy[locale]
  const canonical = canonicalUrl(`/${locale}${programPath}`)

  return {
    title: current.title,
    description: current.description,
    alternates: {
      canonical,
      languages: {
        'en-GB': canonicalUrl(`/en${programPath}`),
        'hu-HU': canonicalUrl(`/hu${programPath}`),
        'x-default': canonicalUrl(`/en${programPath}`),
      },
    },
    openGraph: {
      title: current.title,
      description: current.description,
      url: canonical,
    },
    // This is a direct outreach page, intentionally absent from navigation
    // and the sitemap. It should not turn a small founder program into a
    // search landing page with an open-ended promise of free weddings.
    robots: { index: false, follow: true },
  }
}

function first(value: string | string[] | undefined) {
  return (Array.isArray(value) ? value[0] : value)?.slice(0, 200) ?? ''
}

export default async function EarlyCoupleProgramPage({
  params,
  searchParams,
}: Props) {
  const { locale } = await params
  if (!isLocale(locale)) notFound()
  const current = copy[locale]
  const query = await searchParams
  const tracking = {
    utmSource: first(query.utm_source),
    utmMedium: first(query.utm_medium),
    utmCampaign: first(query.utm_campaign),
    utmContent: first(query.utm_content),
    utmTerm: first(query.utm_term),
  }
  const minDate = new Date().toISOString().slice(0, 10)

  return (
    <PageShell
      locale={locale}
      eyebrow={current.eyebrow}
      title={current.heading}
      lead={current.lead}
    >
      <section className="relative px-4 pb-24 sm:px-6 lg:pb-32">
        <div className="mx-auto max-w-3xl">
          <div className="flex flex-col items-start gap-3 sm:flex-row sm:items-center">
            <Link href="#apply" className={buttonVariants()}>
              {current.cta}
            </Link>
            <p className="text-xs leading-relaxed text-muted-foreground">
              {current.helper}
            </p>
          </div>
        </div>
      </section>

      <section className="relative px-4 py-24 sm:px-6 lg:py-32">
        <div className="mx-auto max-w-6xl">
          <div className="max-w-2xl">
            <span className="glass inline-flex rounded-full px-4 py-1.5 text-xs font-medium tracking-wide text-accent">
              {current.includedEyebrow}
            </span>
            <h2 className="mt-6 text-3xl font-semibold tracking-tight text-balance sm:text-4xl">
              {current.includedHeading}
            </h2>
          </div>
          <div className="mt-10 grid gap-4 lg:grid-cols-3">
            {current.included.map(([title, text], index) => {
              const Icon = benefitIcons[index]
              return (
                <article
                  key={title}
                  className="glass flex h-full flex-col rounded-3xl p-7"
                >
                  <span className="glass flex size-12 items-center justify-center rounded-2xl">
                    <Icon
                      className="size-6 text-accent"
                      strokeWidth={1.6}
                      aria-hidden="true"
                    />
                  </span>
                  <h3 className="mt-6 text-lg font-semibold tracking-tight">
                    {title}
                  </h3>
                  <p className="mt-2 text-sm leading-relaxed text-pretty text-muted-foreground">
                    {text}
                  </p>
                </article>
              )
            })}
          </div>
        </div>
      </section>

      <section className="relative px-4 py-24 sm:px-6 lg:py-32">
        <div className="mx-auto grid max-w-6xl gap-10 lg:grid-cols-[0.8fr_1.2fr] lg:gap-16">
          <div>
            <span className="glass inline-flex rounded-full px-4 py-1.5 text-xs font-medium tracking-wide text-accent">
              {current.exchangeEyebrow}
            </span>
            <h2 className="mt-6 text-3xl font-semibold tracking-tight text-balance sm:text-4xl">
              {current.exchangeHeading}
            </h2>
            <div className="glass mt-8 rounded-3xl p-7">
              <h3 className="font-semibold">{current.fitHeading}</h3>
              <p className="mt-3 text-sm leading-relaxed text-pretty text-muted-foreground">
                {current.fitBody}
              </p>
            </div>
          </div>

          <ol className="space-y-4">
            {current.steps.map(([title, text], index) => (
              <li
                key={title}
                className="glass flex gap-4 rounded-3xl p-6 sm:gap-5 sm:p-7"
              >
                <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-accent/15 text-sm font-semibold text-accent">
                  {index + 1}
                </span>
                <div>
                  <h3 className="font-semibold">{title}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-pretty text-muted-foreground">
                    {text}
                  </p>
                </div>
              </li>
            ))}
          </ol>
        </div>
      </section>

      <section
        id="apply"
        className="relative scroll-mt-24 px-4 py-24 sm:px-6 lg:py-32"
      >
        <div className="mx-auto grid max-w-6xl gap-10 lg:grid-cols-[0.72fr_1.28fr] lg:gap-16">
          <div className="lg:pt-8">
            <span className="glass inline-flex items-center gap-2 rounded-full px-4 py-1.5 text-xs font-medium tracking-wide text-accent">
              <CalendarHeart
                className="size-4"
                strokeWidth={1.6}
                aria-hidden="true"
              />
              {current.formEyebrow}
            </span>
            <h2 className="mt-6 text-3xl font-semibold tracking-tight text-balance sm:text-4xl">
              {current.formHeading}
            </h2>
            <p className="mt-4 leading-relaxed text-pretty text-muted-foreground">
              {current.formLead}
            </p>
          </div>
          <EarlyCoupleApplicationForm
            locale={locale}
            minDate={minDate}
            tracking={tracking}
          />
        </div>
      </section>
    </PageShell>
  )
}
