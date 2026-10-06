import {
  SITE_BUTTON,
  SITE_KICKER,
  SITE_HEADING,
  SITE_LEAD,
} from '@/components/pages/layout'
import { OpenOnHash } from '@/components/pages/open-on-hash'
import { SiteShell } from '@/components/pages/site-shell'
import { CONTACT_EMAIL } from '@/lib/site'
import { ChevronRight } from 'lucide-react'
import type { Metadata } from 'next'
import Link from 'next/link'
import { isLocale, localePath } from '@/lib/i18n'
import { localizedPageAlternates } from '@/lib/seo'
import { notFound } from 'next/navigation'
import { submitLegalRequest } from './actions'
import { inputClassName, textareaClassName } from '@/components/ui/input'
import { cn } from '@/lib/utils'

const copy = {
  en: {
    title: 'Contact – OurFilm',
    description:
      'Get in touch with a question about OurFilm, your event or your photos.',
    kicker: 'Contact',
    heading: 'Write to us.',
    lead: 'Have a question about your event, taking photos or downloading them? Send us a note and a real person will reply.',
    emailBody: 'If your question is about an existing event, include its name.',
    faq: 'Frequently asked questions',
    faqBody: 'We have already collected answers to the most common questions.',
    made: 'Made in Budapest',
    madeBody: 'Read the story behind OurFilm.',
  },
  hu: {
    title: 'Kapcsolat – OurFilm',
    description:
      'Írj nekünk, ha kérdésed van az OurFilmről, egy eseményről vagy a fotóidról.',
    kicker: 'Kapcsolat',
    heading: 'Írj nekünk.',
    lead: 'Kérdésed van az eseményedről, a fotózásról vagy a letöltésről? Írj nekünk, és személyesen válaszolunk.',
    emailBody: 'Ha egy konkrét eseményről írsz, add meg az esemény nevét is.',
    faq: 'Gyakori kérdések',
    faqBody: 'A leggyakoribb kérdésekre már összegyűjtöttük a válaszokat.',
    made: 'Budapesten készül',
    madeBody: 'Ismerd meg az OurFilm történetét.',
  },
} as const

/** The two request forms, by the fragment every link to them uses. */
const REQUEST_IDS = ['elallas', 'kepeltavolitas'] as const

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params
  if (!isLocale(locale)) return {}
  return {
    title: copy[locale].title,
    description: copy[locale].description,
    alternates: localizedPageAlternates(locale, '/kapcsolat'),
    robots: { index: false, follow: true },
  }
}

type Props = {
  params: Promise<{ locale: string }>
  searchParams: Promise<{ legal?: string; type?: string }>
}

/**
 * The address, two ways further into the site, and — in Hungarian — the two
 * legal requests a consumer must be able to send: withdrawal from the
 * contract and removing a photo. Those are real forms posting to
 * `submitLegalRequest`; each sits in a row that opens in place.
 */
export default async function KapcsolatPage({ params, searchParams }: Props) {
  const { locale } = await params
  if (!isLocale(locale)) notFound()
  const current = copy[locale]
  const query = await searchParams
  const result =
    query.legal === 'sent' ? 'sent' : query.legal === 'error' ? 'error' : null
  const resultType = query.type === 'content' ? 'content' : 'withdrawal'

  const rows = [
    {
      href: localePath(locale, '/') + '#faq',
      title: current.faq,
      body: current.faqBody,
    },
    {
      href: localePath(locale, '/rolunk'),
      title: current.made,
      body: current.madeBody,
    },
  ]

  return (
    <SiteShell locale={locale}>
      <section className="mx-auto w-[90%] max-w-[800px] pt-25 pb-[70px] tab:pb-[120px]">
        <p className={cn(SITE_KICKER, 'mb-[22px] tab:mb-7')}>
          {current.kicker}
        </p>
        <h1 className={cn(SITE_HEADING, 'mb-5')}>{current.heading}</h1>
        <p className={cn(SITE_LEAD, 'mb-9')}>{current.lead}</p>
        <a
          href={`mailto:${CONTACT_EMAIL}`}
          className="landing-serif mb-4 inline-block max-w-full border-b border-site-underline font-landing-display text-[27px] leading-[1.4] break-words text-white tab:text-[36px]"
        >
          {CONTACT_EMAIL}
        </a>
        <p className={SITE_LEAD}>{current.emailBody}</p>

        <div className="mt-[50px] border-t border-site-line tab:mt-[70px]">
          {rows.map((row) => (
            <Link
              key={row.href}
              href={row.href}
              className="relative block border-b border-site-line py-7 pr-[30px] transition-colors hover:text-white tab:py-9 tab:pr-[42px]"
            >
              <h2 className="landing-serif mb-2.5 font-landing-display text-[28px] leading-[1.2] text-white tab:text-[30px]">
                {row.title}
              </h2>
              <p className="text-[16px] text-site-muted tab:text-[18px]">
                {row.body}
              </p>
              <ChevronRight
                aria-hidden="true"
                className="absolute top-1/2 right-2 size-[18px] text-white/50"
              />
            </Link>
          ))}
        </div>

        {locale === 'hu' ? (
          <div className="mt-[45px] tab:mt-[70px]">
            <OpenOnHash ids={REQUEST_IDS} />
            <h2 className="landing-serif mb-2.5 font-landing-display text-[28px] leading-[1.2] text-white tab:text-[30px]">
              Kérelmek egyszerűen
            </h2>
            <p className={cn(SITE_LEAD, 'mb-6')}>
              Válaszd ki, mit szeretnél intézni; a beküldésről azonnali,
              dátummal és időponttal ellátott e-mailes másolatot kapsz.
            </p>

            <LegalRequest
              id="elallas"
              kind="withdrawal"
              title="Elállás a szerződéstől"
              description="Fogyasztóként a fizetéstől számított 14 napon belül küldheted el a nyilatkozatot. Ha a szolgáltatás már megkezdődött, a ténylegesen teljesített rész arányos díja levonható; a visszatérítés ezért nem minden esetben automatikusan a teljes összeg."
              locale={locale}
              result={resultType === 'withdrawal' ? result : null}
            />
            <LegalRequest
              id="kepeltavolitas"
              kind="content"
              title="Kép eltávolítása vagy tartalom bejelentése"
              description="A leggyorsabb megoldás az esemény házigazdája, aki azonnal elrejtheti a képet. Ha ez nem lehetséges, itt pontosan megjelölheted a képet és a kérésed okát."
              locale={locale}
              result={resultType === 'content' ? result : null}
            />
          </div>
        ) : null}
      </section>
    </SiteShell>
  )
}

/**
 * One request as a row that opens into its form. It is open from the server
 * when a submission has just come back to it, so the confirmation or the
 * error is never folded away.
 */
function LegalRequest({
  id,
  kind,
  title,
  description,
  locale,
  result,
}: {
  id: string
  kind: 'withdrawal' | 'content'
  title: string
  description: string
  locale: string
  result: 'sent' | 'error' | null
}) {
  const isWithdrawal = kind === 'withdrawal'

  return (
    <details
      id={id}
      open={result !== null}
      className="group scroll-mt-24 border-b border-site-line"
    >
      <summary className="flex cursor-pointer list-none items-center justify-between gap-5 py-5 text-[16px] text-white [&::-webkit-details-marker]:hidden">
        {title}
        <ChevronRight
          aria-hidden="true"
          className="size-[18px] shrink-0 text-white/50 transition-transform group-open:rotate-90"
        />
      </summary>

      <div className="pb-8">
        <p className="text-[15px] leading-[1.6] text-site-muted">
          {description}
        </p>

        {result ? (
          <p
            role="status"
            className={cn(
              'mt-6 rounded-2xl px-4 py-3 text-[14px] leading-relaxed',
              result === 'sent'
                ? 'bg-white/8 text-white'
                : 'bg-destructive/10 text-destructive',
            )}
          >
            {result === 'sent'
              ? 'Megkaptuk a kérelmet, és a megadott e-mail-címre elküldtük a visszaigazolást.'
              : `Nem sikerült biztonságosan elküldeni a kérelmet. Írj közvetlenül a ${CONTACT_EMAIL} címre.`}
          </p>
        ) : null}

        <form action={submitLegalRequest} className="mt-6 space-y-4">
          <input
            type="hidden"
            name="requestType"
            value={isWithdrawal ? 'withdrawal' : 'content'}
          />
          <input type="hidden" name="locale" value={locale} />
          <div className="hidden" aria-hidden="true">
            <label>
              Weboldal
              <input name="website" tabIndex={-1} autoComplete="off" />
            </label>
          </div>

          <div className="grid gap-4 tab:grid-cols-2">
            <FormField label="Neved" name="name" autoComplete="name" />
            <FormField
              label="E-mail-címed"
              name="email"
              type="email"
              autoComplete="email"
            />
          </div>

          <FormField
            label="Esemény neve, linkje vagy Stripe-bizonylat azonosítója"
            name="eventReference"
            placeholder="Például: Anna és Bence esküvője"
          />

          {isWithdrawal ? (
            <>
              <FormField
                label="Fizetés időpontja (nem kötelező)"
                name="paymentDate"
                type="date"
                required={false}
              />
              <FormTextArea label="Megjegyzés (nem kötelező)" name="details" />
              <label className="flex cursor-pointer items-start gap-3 rounded-2xl border border-site-line bg-white/5 p-4 text-[14px] leading-relaxed text-site-value">
                <input
                  required
                  type="checkbox"
                  name="withdrawalConfirmed"
                  value="confirmed"
                  className="mt-0.5 size-4 shrink-0 accent-white"
                />
                <span>
                  Kijelentem, hogy a fent azonosított szerződéstől elállok,
                  illetve a már megkezdett szolgáltatást felmondom.
                </span>
              </label>
            </>
          ) : (
            <>
              <FormField
                label="Melyik képről van szó?"
                name="photoReference"
                placeholder="Kép sorszáma, pontos leírása vagy az album nézete"
              />
              <FormTextArea
                label="Miért kéred az eltávolítást vagy vizsgálatot?"
                name="details"
                required
              />
            </>
          )}

          <button type="submit" className={SITE_BUTTON}>
            {isWithdrawal ? 'Elállás megerősítése' : 'Kérelem elküldése'}
          </button>
          <p className="text-[12px] leading-relaxed text-site-kicker">
            A megadott adatokat kizárólag a kérelem kezelésére használjuk.
          </p>
        </form>
      </div>
    </details>
  )
}

function FormField({
  label,
  name,
  type = 'text',
  autoComplete,
  placeholder,
  required = true,
}: {
  label: string
  name: string
  type?: string
  autoComplete?: string
  placeholder?: string
  required?: boolean
}) {
  return (
    <label className="block text-[14px] font-medium text-site-value">
      {label}
      <input
        required={required}
        name={name}
        type={type}
        autoComplete={autoComplete}
        placeholder={placeholder}
        className={cn(inputClassName, 'mt-2 px-4 text-white')}
      />
    </label>
  )
}

function FormTextArea({
  label,
  name,
  required = false,
}: {
  label: string
  name: string
  required?: boolean
}) {
  return (
    <label className="block text-[14px] font-medium text-site-value">
      {label}
      <textarea
        required={required}
        name={name}
        rows={4}
        className={cn(textareaClassName, 'mt-2 px-4 py-3 text-white')}
      />
    </label>
  )
}
