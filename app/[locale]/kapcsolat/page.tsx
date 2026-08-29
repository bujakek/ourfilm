import { PageShell } from '@/components/site/page-shell'
import { CONTACT_EMAIL } from '@/lib/site'
import { HelpCircle, Mail, MapPin } from 'lucide-react'
import type { Metadata } from 'next'
import Link from 'next/link'
import { isLocale, localePath } from '@/lib/i18n'
import { notFound } from 'next/navigation'

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

type Props = { params: Promise<{ locale: string }> }

export default async function KapcsolatPage({ params }: Props) {
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
        <div className="mx-auto max-w-3xl">
          <div className="glass-strong mt-12 rounded-3xl p-8 sm:p-10">
            <span className="glass flex size-12 items-center justify-center rounded-2xl">
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
            {/* mailto only, on purpose: a contact form with nothing behind it
                silently swallows messages, which is worse than no form. */}
            <a
              href={`mailto:${CONTACT_EMAIL}`}
              className="btn-shine mt-7 inline-flex items-center justify-center gap-2 rounded-full bg-primary px-7 py-3.5 text-sm font-semibold text-primary-foreground transition-transform hover:scale-[1.03]"
            >
              <Mail className="size-4" strokeWidth={2} aria-hidden="true" />
              {CONTACT_EMAIL}
            </a>
          </div>

          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <article className="glass flex h-full flex-col rounded-3xl p-7">
              <span className="glass flex size-12 items-center justify-center rounded-2xl">
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

            <article className="glass flex h-full flex-col rounded-3xl p-7">
              <span className="glass flex size-12 items-center justify-center rounded-2xl">
                <MapPin
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
        </div>
      </section>
    </PageShell>
  )
}
