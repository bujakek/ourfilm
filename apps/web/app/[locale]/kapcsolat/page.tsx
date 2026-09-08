import { PageShell } from '@/components/site/page-shell'
import { CONTACT_EMAIL } from '@/lib/site'
import { Flag, HelpCircle, Mail, ReceiptText } from 'lucide-react'
import type { Metadata } from 'next'
import Link from 'next/link'
import { isLocale, localePath } from '@/lib/i18n'
import { notFound } from 'next/navigation'
import { submitLegalRequest } from './actions'
import { Button, buttonVariants } from '@/components/ui/button'
import { inputClassName, textareaClassName } from '@/components/ui/input'
import { cn } from '@/lib/utils'

const copy = {
  en: {
    title: 'Contact – OurFilm',
    description:
      'Get in touch with a question about OurFilm, your event or your photos.',
    eyebrow: 'CONTACT',
    heading: 'Talk to us',
    lead: 'Have a question about your event, uploading or downloading photos? Send us a note and a real person will reply.',
    emailBody:
      'Tell us briefly how we can help. If your question is about an existing event, include its name.',
    faq: 'Frequently asked questions',
    faqBody: 'You may find the answer you need in our FAQ.',
    made: 'Made in Budapest',
    madeBody: 'OurFilm is built in Hungary.',
    about: 'About us',
  },
  hu: {
    title: 'Kapcsolat – OurFilm',
    description:
      'Írj nekünk, ha kérdésed van az OurFilmről, egy eseményről vagy a fotóidról.',
    eyebrow: 'KAPCSOLAT',
    heading: 'Írj nekünk',
    lead: 'Kérdésed van az eseményedről, a feltöltésről vagy a letöltésről? Írj nekünk, és személyesen válaszolunk.',
    emailBody:
      'Írd meg röviden, miben segíthetünk. Ha egy konkrét eseményről írsz, add meg az esemény nevét is.',
    faq: 'Gyakori kérdések',
    faqBody: 'A leggyakoribb kérdésekre már összegyűjtöttük a válaszokat.',
    made: 'Budapesten készül',
    madeBody: 'Az OurFilm magyar fejlesztés.',
    about: 'Rólunk',
  },
} as const

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params
  if (!isLocale(locale)) return {}
  return {
    title: copy[locale].title,
    description: copy[locale].description,
    robots: { index: false, follow: true },
  }
}

type Props = {
  params: Promise<{ locale: string }>
  searchParams: Promise<{ legal?: string; type?: string }>
}

export default async function KapcsolatPage({ params, searchParams }: Props) {
  const { locale } = await params
  if (!isLocale(locale)) notFound()
  const current = copy[locale]
  const query = await searchParams
  const result =
    query.legal === 'sent' ? 'sent' : query.legal === 'error' ? 'error' : null
  const resultType = query.type === 'content' ? 'content' : 'withdrawal'

  return (
    <PageShell
      locale={locale}
      eyebrow={current.eyebrow}
      title={current.heading}
      lead={current.lead}
    >
      <section className="relative px-4 pb-24 sm:px-6 lg:pb-32">
        <div className="mx-auto max-w-3xl">
          <div className="glass-strong mt-12 rounded-2xl p-8 sm:p-10">
            <span className="glass flex size-12 items-center justify-center rounded-lg">
              <Mail
                className="size-6 text-accent"
                strokeWidth={1.6}
                aria-hidden="true"
              />
            </span>
            <h2 className="mt-6 text-2xl font-semibold tracking-tight text-balance">
              E-mail
            </h2>
            <p className="mt-3 leading-relaxed text-pretty text-muted-foreground">
              {current.emailBody}
            </p>
            <a
              href={`mailto:${CONTACT_EMAIL}`}
              className={buttonVariants({ className: 'mt-7' })}
            >
              <Mail className="size-4" strokeWidth={2} aria-hidden="true" />
              {CONTACT_EMAIL}
            </a>
          </div>

          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <article className="glass flex h-full flex-col rounded-2xl p-7">
              <span className="glass flex size-12 items-center justify-center rounded-lg">
                <HelpCircle
                  className="size-6 text-accent"
                  strokeWidth={1.6}
                  aria-hidden="true"
                />
              </span>
              <h2 className="mt-6 text-base font-semibold">{current.faq}</h2>
              <p className="mt-2 flex-1 text-sm leading-relaxed text-pretty text-muted-foreground">
                {current.faqBody}
              </p>
              <Link
                href={localePath(locale, '/#faq')}
                className="mt-5 text-sm font-medium text-accent underline underline-offset-4 transition-colors hover:text-foreground"
              >
                {current.faq}
              </Link>
            </article>

            <article className="glass flex h-full flex-col rounded-2xl p-7">
              <span className="glass flex size-12 items-center justify-center rounded-lg">
                <ReceiptText
                  className="size-6 text-accent"
                  strokeWidth={1.6}
                  aria-hidden="true"
                />
              </span>
              <h2 className="mt-6 text-base font-semibold">{current.made}</h2>
              <p className="mt-2 flex-1 text-sm leading-relaxed text-pretty text-muted-foreground">
                {current.madeBody}
              </p>
              <Link
                href={localePath(locale, '/rolunk')}
                className="mt-5 text-sm font-medium text-accent underline underline-offset-4 transition-colors hover:text-foreground"
              >
                {current.about}
              </Link>
            </article>
          </div>

          {locale === 'hu' ? (
            <div className="mt-12 space-y-4">
              <h2 className="text-2xl font-semibold tracking-tight">
                Kérelmek egyszerűen
              </h2>
              <p className="leading-relaxed text-pretty text-muted-foreground">
                Válaszd ki, mit szeretnél intézni; a beküldésről azonnali,
                dátummal és időponttal ellátott e-mailes másolatot kapsz.
              </p>

              <LegalRequestCard
                id="elallas"
                icon="withdrawal"
                title="Elállás a szerződéstől"
                description="Fogyasztóként a fizetéstől számított 14 napon belül küldheted el a nyilatkozatot. Ha a szolgáltatás már megkezdődött, a ténylegesen teljesített rész arányos díja levonható; a visszatérítés ezért nem minden esetben automatikusan a teljes összeg."
                locale={locale}
                result={resultType === 'withdrawal' ? result : null}
              />

              <LegalRequestCard
                id="kepeltavolitas"
                icon="content"
                title="Kép eltávolítása vagy tartalom bejelentése"
                description="A leggyorsabb megoldás az esemény házigazdája, aki azonnal elrejtheti a képet. Ha ez nem lehetséges, itt pontosan megjelölheted a képet és a kérésed okát."
                locale={locale}
                result={resultType === 'content' ? result : null}
              />
            </div>
          ) : null}
        </div>
      </section>
    </PageShell>
  )
}

function LegalRequestCard({
  id,
  icon,
  title,
  description,
  locale,
  result,
}: {
  id: string
  icon: 'withdrawal' | 'content'
  title: string
  description: string
  locale: string
  result: 'sent' | 'error' | null
}) {
  const Icon = icon === 'withdrawal' ? ReceiptText : Flag
  const isWithdrawal = icon === 'withdrawal'

  return (
    <article id={id} className="glass scroll-mt-24 rounded-2xl p-7 sm:p-8">
      <div className="flex items-start gap-4">
        <span className="glass flex size-11 shrink-0 items-center justify-center rounded-lg">
          <Icon
            className="size-5 text-accent"
            strokeWidth={1.6}
            aria-hidden="true"
          />
        </span>
        <div>
          <h3 className="text-lg font-semibold">{title}</h3>
          <p className="mt-2 text-sm leading-relaxed text-pretty text-muted-foreground">
            {description}
          </p>
        </div>
      </div>

      {result ? (
        <p
          role="status"
          className={`mt-6 rounded-2xl px-4 py-3 text-sm leading-relaxed ${
            result === 'sent'
              ? 'bg-accent/15 text-foreground'
              : 'bg-destructive/10 text-destructive'
          }`}
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

        <div className="grid gap-4 sm:grid-cols-2">
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
            <label className="flex cursor-pointer items-start gap-3 rounded-2xl border border-border bg-white/5 p-4 text-sm leading-relaxed">
              <input
                required
                type="checkbox"
                name="withdrawalConfirmed"
                value="confirmed"
                className="mt-0.5 size-4 shrink-0 accent-[var(--accent)]"
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

        <Button type="submit">
          {isWithdrawal ? 'Elállás megerősítése' : 'Kérelem elküldése'}
        </Button>
        <p className="text-xs leading-relaxed text-muted-foreground">
          A megadott adatokat kizárólag a kérelem kezelésére használjuk.
        </p>
      </form>
    </article>
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
    <label className="block text-sm font-medium">
      {label}
      <input
        required={required}
        name={name}
        type={type}
        autoComplete={autoComplete}
        placeholder={placeholder}
        className={cn(inputClassName, 'mt-2 px-4')}
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
    <label className="block text-sm font-medium">
      {label}
      <textarea
        required={required}
        name={name}
        rows={4}
        className={cn(textareaClassName, 'mt-2 px-4 py-3')}
      />
    </label>
  )
}
