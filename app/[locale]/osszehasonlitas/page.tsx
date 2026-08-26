import { DocList } from '@/components/content/doc-list'
import { HubLinks } from '@/components/content/hub-links'
import { PageHeader } from '@/components/site/page-header'
import { hubCopy } from '@/lib/content/copy'
import { getDocs } from '@/lib/content/docs'
import { isLocale, localePath } from '@/lib/i18n'
import { canonicalUrl } from '@/lib/seo'
import type { Metadata } from 'next'
import { notFound } from 'next/navigation'

type Props = { params: Promise<{ locale: string }> }

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params
  if (!isLocale(locale)) return {}

  const copy = hubCopy[locale].osszehasonlitas

  return {
    title: `${copy.title} — OurFilm`,
    description: copy.lead,
    alternates: {
      canonical: canonicalUrl(localePath(locale, '/osszehasonlitas')),
    },
  }
}

/**
 * Two shelves, one URL space.
 *
 * `vs` pages argue for OurFilm and `compare` pages weigh two other products
 * against each other. They share the address because to a reader they are the
 * same shelf, and they are separated here because a reader deserves to know
 * which of the two they are about to open.
 */
export default async function ComparisonHubPage({ params }: Props) {
  const { locale } = await params
  if (!isLocale(locale)) notFound()

  const ours = getDocs(locale, ['vs'])
  const theirs = getDocs(locale, ['compare'])
  const copy = hubCopy[locale].osszehasonlitas

  return (
    <>
      <PageHeader eyebrow={copy.eyebrow} title={copy.title} lead={copy.lead} />

      <section className="relative px-4 pb-24 sm:px-6 lg:pb-32">
        <div className="mx-auto max-w-3xl">
          {/* Said once, at the top of the shelf. The five
              competitor-versus-competitor pages state their sources and the
              date they were checked, but none of them says whose site this is
              — and that is a template's job rather than a reason to rewrite
              copy that is otherwise final. */}
          <p className="glass rounded-2xl px-6 py-4 text-sm leading-relaxed text-muted-foreground">
            Ezek az összevetések az OurFilm oldalán jelennek meg, nem független
            tesztek. A versenytársak nyilvános adatait a megjelölt napon
            ellenőriztük; az árak és a funkciók azóta változhattak.
          </p>

          <section className="mt-14">
            <h2 className="text-2xl font-semibold tracking-tight text-balance">
              Az OurFilm a többiekhez képest
            </h2>
            <p className="mt-2 leading-relaxed text-pretty text-muted-foreground">
              Saját oldalunkon írt összevetések. Ott is megírjuk, amikor a másik
              szolgáltatás a jobb választás.
            </p>
            <DocList docs={ours} locale={locale} showDate={false} />
          </section>

          <section className="mt-14">
            <h2 className="text-2xl font-semibold tracking-tight text-balance">
              Szolgáltatások egymás ellen
            </h2>
            <p className="mt-2 leading-relaxed text-pretty text-muted-foreground">
              Két másik szolgáltatás összevetése, ha még nem az OurFilm és
              valami között választotok.
            </p>
            <DocList docs={theirs} locale={locale} showDate={false} />
          </section>

          <HubLinks locale={locale} current="osszehasonlitas" />
        </div>
      </section>
    </>
  )
}
