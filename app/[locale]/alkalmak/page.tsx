import { PageShell } from '@/components/site/page-shell'
import { OCCASIONS_ARE_DRAFT, occasions } from '@/lib/occasions'
import { ArrowRight } from 'lucide-react'
import type { Metadata } from 'next'
import Image from 'next/image'
import Link from 'next/link'
import { isLocale, localePath } from '@/lib/i18n'
import { notFound } from 'next/navigation'

export const metadata: Metadata = {
  title: 'Digitális vendégkamera minden alkalomra – OurFilm',
  description:
    'Esküvő, születésnap, utazás vagy buli: adj mindenkinek saját digitális tekercset QR-kóddal, alkalmazás és regisztráció nélkül.',
  ...(OCCASIONS_ARE_DRAFT ? { robots: { index: false, follow: true } } : {}),
}

type Props = { params: Promise<{ locale: string }> }

export default async function AlkalmakPage({ params }: Props) {
  const { locale } = await params
  if (!isLocale(locale)) notFound()

  return (
    <PageShell
      locale={locale}
      eyebrow="ALKALMAK"
      title="Minden alkalomra, ahol fotó készül"
      lead="Ugyanaz a közös kamera, csak az alkalom más. Minden résztvevő saját digitális tekercset kap, a képek pedig együtt hívódnak elő."
    >
      <section className="relative px-4 pb-24 sm:px-6 lg:pb-32">
        <div className="mx-auto max-w-6xl">
          <ul className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {occasions.map((occasion) => (
              <li key={occasion.slug}>
                <Link
                  href={localePath(locale, `/alkalmak/${occasion.slug}`)}
                  className="glass glass-hover group flex h-full flex-col overflow-hidden rounded-3xl"
                >
                  <div className="relative aspect-[16/10] overflow-hidden">
                    <Image
                      src={occasion.image}
                      alt={occasion.alt}
                      fill
                      sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 360px"
                      className="object-cover"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/70 to-transparent" />
                  </div>
                  <div className="flex flex-1 flex-col p-6">
                    <span className="inline-flex items-center gap-2 text-sm font-semibold text-accent">
                      <occasion.icon
                        className="size-4"
                        strokeWidth={1.7}
                        aria-hidden="true"
                      />
                      {occasion.label}
                    </span>
                    <h2 className="mt-3 text-lg font-semibold text-balance">
                      {occasion.title}
                    </h2>
                    <p className="mt-2 flex-1 text-sm leading-relaxed text-pretty text-muted-foreground">
                      {occasion.text}
                    </p>
                    <span className="mt-5 inline-flex items-center gap-2 text-sm font-medium text-accent">
                      Tovább
                      <ArrowRight
                        className="size-4 transition-transform group-hover:translate-x-0.5"
                        aria-hidden="true"
                      />
                    </span>
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        </div>
      </section>
    </PageShell>
  )
}
