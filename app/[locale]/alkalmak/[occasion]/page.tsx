import { PageShell } from '@/components/site/page-shell'
import { OCCASIONS_ARE_DRAFT, occasionBySlug, occasions } from '@/lib/occasions'
import { ArrowLeft } from 'lucide-react'
import type { Metadata } from 'next'
import Image from 'next/image'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { isLocale, localePath } from '@/lib/i18n'

type Props = { params: Promise<{ locale: string; occasion: string }> }

/** Five known slugs, so all five prerender and an unknown one 404s. */
export function generateStaticParams() {
  return occasions.map((o) => ({ occasion: o.slug }))
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { occasion: slug } = await params
  const occasion = occasionBySlug(slug)
  if (!occasion) return {}

  return {
    title: `${occasion.label} — közös fotóalbum | OurFilm`,
    description: occasion.text,
    ...(OCCASIONS_ARE_DRAFT ? { robots: { index: false, follow: true } } : {}),
  }
}

export default async function OccasionPage({ params }: Props) {
  const { locale, occasion: slug } = await params
  if (!isLocale(locale)) notFound()
  const occasion = occasionBySlug(slug)
  if (!occasion) notFound()

  return (
    <PageShell
      locale={locale}
      eyebrow={occasion.label.toUpperCase()}
      title={occasion.title}
      lead={occasion.text}
    >
      <section className="relative px-4 pb-24 sm:px-6 lg:pb-32">
        <div className="mx-auto max-w-3xl">
          <div className="glass-strong mt-12 overflow-hidden rounded-[2rem] p-2">
            <div className="relative aspect-[16/10] overflow-hidden rounded-[1.6rem] sm:aspect-[16/8]">
              <Image
                src={occasion.image}
                alt={occasion.alt}
                fill
                sizes="(max-width: 768px) 100vw, 768px"
                priority
                className="object-cover"
              />
            </div>
          </div>

          <div className="mt-14 space-y-12">
            {occasion.sections.map((section) => (
              <div key={section.heading}>
                <h2 className="text-2xl font-semibold tracking-tight text-balance">
                  {section.heading}
                </h2>
                <p className="mt-3 leading-relaxed text-pretty text-muted-foreground">
                  {section.body}
                </p>
              </div>
            ))}
          </div>

          <div className="glass-strong mt-14 rounded-3xl p-8 sm:p-10">
            <h2 className="text-2xl font-semibold tracking-tight text-balance">
              Hozd létre a közös albumot
            </h2>
            <p className="mt-3 leading-relaxed text-pretty text-muted-foreground">
              Néhány perc, és megvan az esemény, a QR-kód és a megosztható
              meghívólink. Senkinek nem kell appot telepítenie vagy
              regisztrálnia.
            </p>
            <Link
              href="/admin/login"
              className="btn-shine mt-7 inline-flex items-center justify-center rounded-full bg-primary px-7 py-3.5 text-sm font-semibold text-primary-foreground transition-transform hover:scale-[1.03]"
            >
              Próbáld ki ingyen
            </Link>
            <p className="mt-4 text-sm text-muted-foreground">
              5 képig, bankkártya nélkül. A teljes esemény egyszeri 12 900 Ft,
              korlátlan vendéggel és korlátlan képpel.
            </p>
          </div>

          <Link
            href={localePath(locale, '/alkalmak')}
            className="mt-12 inline-flex min-h-11 items-center gap-2 text-sm text-muted-foreground transition-colors hover:text-foreground"
          >
            <ArrowLeft className="size-4" aria-hidden="true" />
            Minden alkalom
          </Link>
        </div>
      </section>
    </PageShell>
  )
}
