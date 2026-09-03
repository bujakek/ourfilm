import { PageShell } from '@/components/site/page-shell'
import { OCCASIONS_ARE_DRAFT, occasionCopy, occasions } from '@/lib/occasions'
import { ArrowRight } from 'lucide-react'
import type { Metadata } from 'next'
import Image from 'next/image'
import Link from 'next/link'
import { isLocale, localePath } from '@/lib/i18n'
import { notFound } from 'next/navigation'

const pageCopy = {
  en: {
    title: 'A Digital Guest Camera for Every Occasion – OurFilm',
    description:
      'Wedding, birthday, trip or party: give everyone their own digital roll with one QR code. No app or accounts.',
    eyebrow: 'OCCASIONS',
    heading: 'For every day worth seeing again',
    lead: 'One shared camera, whatever you are celebrating. Everyone gets their own roll, and every photo comes together in one gallery.',
    more: 'Learn more',
  },
  hu: {
    title: 'Digitális vendégkamera minden alkalomra – OurFilm',
    description:
      'Esküvő, születésnap, utazás vagy buli: adj mindenkinek saját digitális tekercset QR-kóddal, alkalmazás és regisztráció nélkül.',
    eyebrow: 'ALKALMAK',
    heading: 'Minden alkalomra, ahol fotó készül',
    lead: 'Ugyanaz a közös kamera, csak az alkalom más. Minden résztvevő saját digitális tekercset kap, a képek pedig együtt hívódnak elő.',
    more: 'Tovább',
  },
} as const

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params
  if (!isLocale(locale)) return {}
  const current = pageCopy[locale]
  return {
    title: current.title,
    description: current.description,
    ...(OCCASIONS_ARE_DRAFT ? { robots: { index: false, follow: true } } : {}),
  }
}

type Props = { params: Promise<{ locale: string }> }

export default async function AlkalmakPage({ params }: Props) {
  const { locale } = await params
  if (!isLocale(locale)) notFound()
  const current = pageCopy[locale]

  return (
    <PageShell
      locale={locale}
      eyebrow={current.eyebrow}
      title={current.heading}
      lead={current.lead}
    >
      <section className="relative px-4 pb-24 sm:px-6 lg:pb-32">
        <div className="mx-auto max-w-6xl">
          <ul className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {occasions.map((occasion) => {
              const item = occasionCopy(locale, occasion)
              return (
                <li key={occasion.slug}>
                  <Link
                    href={localePath(locale, `/alkalmak/${occasion.slug}`)}
                    className="glass glass-hover group flex h-full flex-col overflow-hidden rounded-2xl"
                  >
                    <div className="relative aspect-[16/10] overflow-hidden">
                      <Image
                        src={occasion.image}
                        alt={item.alt}
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
                        {item.label}
                      </span>
                      <h2 className="mt-3 text-lg font-semibold text-balance">
                        {item.title}
                      </h2>
                      <p className="mt-2 flex-1 text-sm leading-relaxed text-pretty text-muted-foreground">
                        {item.text}
                      </p>
                      <span className="mt-5 inline-flex items-center gap-2 text-sm font-medium text-accent">
                        {current.more}
                        <ArrowRight
                          className="size-4 transition-transform group-hover:translate-x-0.5"
                          aria-hidden="true"
                        />
                      </span>
                    </div>
                  </Link>
                </li>
              )
            })}
          </ul>
        </div>
      </section>
    </PageShell>
  )
}
