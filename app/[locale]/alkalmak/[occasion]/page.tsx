import { PageShell } from '@/components/site/page-shell'
import {
  OCCASIONS_ARE_DRAFT,
  occasionBySlug,
  occasionCopy,
  occasions,
} from '@/lib/occasions'
import { ArrowLeft } from 'lucide-react'
import type { Metadata } from 'next'
import Image from 'next/image'
import Link from 'next/link'
import { buttonVariants } from '@/components/ui/button'

import { CREATE_EVENT_PATH } from '@/lib/routes'
import { notFound } from 'next/navigation'
import { isLocale, localePath } from '@/lib/i18n'

type Props = { params: Promise<{ locale: string; occasion: string }> }

/** Five known slugs, so all five prerender and an unknown one 404s. */
export function generateStaticParams() {
  return occasions.map((o) => ({ occasion: o.slug }))
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale, occasion: slug } = await params
  if (!isLocale(locale)) return {}
  const occasion = occasionBySlug(slug)
  if (!occasion) return {}
  const copy = occasionCopy(locale, occasion)

  return {
    title: copy.meta.title,
    description: copy.meta.description,
    openGraph: {
      title: copy.meta.title,
      description: copy.meta.description,
    },
    ...(OCCASIONS_ARE_DRAFT ? { robots: { index: false, follow: true } } : {}),
  }
}

export default async function OccasionPage({ params }: Props) {
  const { locale, occasion: slug } = await params
  if (!isLocale(locale)) notFound()
  const occasion = occasionBySlug(slug)
  if (!occasion) notFound()
  const copy = occasionCopy(locale, occasion)

  return (
    <PageShell
      locale={locale}
      eyebrow={copy.label.toUpperCase()}
      title={copy.title}
      lead={copy.text}
    >
      <section className="relative px-4 pb-24 sm:px-6 lg:pb-32">
        <div className="mx-auto max-w-3xl">
          <div className="glass-strong mt-12 overflow-hidden rounded-[2rem] p-2">
            <div className="relative aspect-[16/10] overflow-hidden rounded-[1.6rem] sm:aspect-[16/8]">
              <Image
                src={occasion.image}
                alt={copy.alt}
                fill
                sizes="(max-width: 768px) 100vw, 768px"
                priority
                className="object-cover"
              />
            </div>
          </div>

          <div className="mt-14 space-y-12">
            {copy.sections.map((section) => (
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
              {copy.cta.heading}
            </h2>
            <p className="mt-3 leading-relaxed text-pretty text-muted-foreground">
              {copy.cta.body}
            </p>
            <Link
              href={`${CREATE_EVENT_PATH}?lang=${locale}`}
              className={buttonVariants({ className: 'mt-7' })}
            >
              {copy.cta.button}
            </Link>
            <p className="mt-4 text-sm text-muted-foreground">
              {copy.cta.helper}
            </p>
          </div>

          <Link
            href={localePath(locale, '/alkalmak')}
            className="mt-12 inline-flex min-h-11 items-center gap-2 text-sm text-muted-foreground transition-colors hover:text-foreground"
          >
            <ArrowLeft className="size-4" aria-hidden="true" />
            {locale === 'en' ? 'All occasions' : 'Minden alkalom'}
          </Link>
        </div>
      </section>
    </PageShell>
  )
}
