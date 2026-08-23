import { DraftNotice } from '@/components/site/draft-notice'
import { PageShell } from '@/components/site/page-shell'
import { CONTACT_EMAIL } from '@/lib/site'
import { HelpCircle, Mail, MapPin } from 'lucide-react'
import type { Metadata } from 'next'
import Link from 'next/link'
import { isLocale, localePath } from '@/lib/i18n'
import { notFound } from 'next/navigation'

export const metadata: Metadata = {
  title: 'Kapcsolat — OurFilm',
  description:
    'Írj nekünk, ha kérdésed van az OurFilmről, egy eseményről vagy a fotóidról.',
  // TODO(copy): remove once the contact address is confirmed.
  robots: { index: false, follow: true },
}

type Props = { params: Promise<{ locale: string }> }

export default async function KapcsolatPage({ params }: Props) {
  const { locale } = await params
  if (!isLocale(locale)) notFound()

  return (
    <PageShell
      locale={locale}
      eyebrow="KAPCSOLAT"
      title="Írj nekünk"
      lead="Kérdés az eseményedről, a feltöltésről vagy a letöltésről? Egy ember olvassa a leveleket, és igyekszik egy munkanapon belül válaszolni."
    >
      <section className="relative px-4 pb-24 sm:px-6 lg:pb-32">
        <div className="mx-auto max-w-3xl">
          <DraftNotice>
            <strong className="font-semibold text-foreground">
              Ez az oldal még vázlat.
            </strong>{' '}
            Az e-mail-cím helykitöltő, és a válaszidőre tett ígéret sincs még
            megerősítve. Az oldal egyelőre nem jelenik meg a keresőkben.
          </DraftNotice>

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
              Ez a leggyorsabb út. Ha egy konkrét eseményről írsz, küldd el az
              album linkjét is — úgy sokkal hamarabb tudunk segíteni.
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
              <h2 className="mt-6 text-base font-semibold">
                Először nézd meg a GYIK-et
              </h2>
              <p className="mt-2 flex-1 text-sm leading-relaxed text-pretty text-muted-foreground">
                A leggyakoribb kérdésekre — feltöltés, minőség, adatvédelem —
                ott már ott a válasz.
              </p>
              <Link
                href={localePath(locale, '/#faq')}
                className="mt-5 text-sm font-medium text-accent underline underline-offset-4 transition-colors hover:text-foreground"
              >
                Gyakori kérdések
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
              <h2 className="mt-6 text-base font-semibold">Hol vagyunk</h2>
              <p className="mt-2 flex-1 text-sm leading-relaxed text-pretty text-muted-foreground">
                Budapest. TODO: ide jön a postai cím és a cégadatok, ha kellenek
                a számlázáshoz.
              </p>
              <Link
                href={localePath(locale, '/rolunk')}
                className="mt-5 text-sm font-medium text-accent underline underline-offset-4 transition-colors hover:text-foreground"
              >
                Rólunk
              </Link>
            </article>
          </div>
        </div>
      </section>
    </PageShell>
  )
}
