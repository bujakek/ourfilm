import {
  SITE_BUTTON,
  SITE_CONTAINER,
  SITE_HEADING,
  SITE_KICKER,
} from '@/components/pages/layout'
import { PostByline } from '@/components/pages/post-byline'
import { hubCopy } from '@/lib/content/copy'
import { coverFor } from '@/lib/content/covers'
import { getDocs } from '@/lib/content/docs'
import { isLocale, localePath } from '@/lib/i18n'
import { CREATE_EVENT_PATH } from '@/lib/routes'
import { canonicalUrl, localizedPageAlternates } from '@/lib/seo'
import { siteCopy } from '@/lib/site-copy'
import { cn } from '@/lib/utils'
import type { Metadata } from 'next'
import Image from 'next/image'
import Link from 'next/link'
import { notFound } from 'next/navigation'

type Props = { params: Promise<{ locale: string }> }

const intro = {
  en: {
    kicker: 'Blog',
    headingLines: ['Moments become', 'memories.'],
    leadLines: [
      'Ideas and guides for shooting together.',
      'So the best moments end up in one place.',
    ],
    empty: 'No articles yet. Check back soon.',
  },
  hu: {
    kicker: 'Blog',
    headingLines: ['A pillanatokból', 'emlékek lesznek.'],
    leadLines: [
      'Ötletek és útmutatók a közös fotózáshoz.',
      'Hogy a legjobb pillanatok egy helyre kerüljenek.',
    ],
    empty: 'Még nincs bejegyzés. Hamarosan.',
  },
} as const

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params
  if (!isLocale(locale)) return {}

  const path = localePath(locale, '/blog')
  const copy = hubCopy[locale].blog

  return {
    title: `${copy.title} — OurFilm`,
    description: copy.lead,
    alternates: {
      ...localizedPageAlternates(locale, '/blog'),
      types: {
        'application/rss+xml': canonicalUrl(`${path}/rss.xml`),
      },
    },
  }
}

/**
 * Every article, newest first, beside an introduction that stays put while
 * the cards scroll past it. On a phone it is one column.
 */
export default async function BlogIndexPage({ params }: Props) {
  const { locale } = await params
  if (!isLocale(locale)) notFound()

  const docs = getDocs(locale, ['blog'])
  const copy = intro[locale]

  return (
    <section
      className={cn(
        SITE_CONTAINER,
        'pt-25 pb-[70px] tab:grid tab:grid-cols-2 tab:items-start tab:gap-9 tab:pb-[120px] xl:gap-15',
      )}
    >
      <div className="mb-10 text-center tab:sticky tab:top-25 tab:mb-0 tab:text-left">
        <p className={cn(SITE_KICKER, 'mb-5 tab:mb-10')}>{copy.kicker}</p>
        <h1 className={SITE_HEADING}>
          {copy.headingLines.map((line) => (
            <span key={line} className="block">
              {line}
            </span>
          ))}
        </h1>
        <p className="mt-3.5 mb-[26px] text-[16px] leading-[1.6] text-site-muted tab:mt-2.5 tab:mb-10 tab:text-[18px]">
          {copy.leadLines.map((line) => (
            <span key={line} className="tab:block">
              {line}{' '}
            </span>
          ))}
        </p>
        <Link
          href={`${CREATE_EVENT_PATH}?lang=${locale}`}
          className={SITE_BUTTON}
        >
          {siteCopy[locale].create}
        </Link>
      </div>

      {docs.length === 0 ? (
        <p className="text-site-muted">{copy.empty}</p>
      ) : (
        <ul className="flex flex-col gap-5">
          {docs.map((doc, i) => (
            <li key={doc.id}>
              <Link
                href={doc.href}
                className="block rounded-[28px] border border-site-line bg-site-surface p-2.5 transition-colors hover:border-white/16 tab:p-3"
              >
                <span className="relative block aspect-[1.57] overflow-hidden rounded-[18px]">
                  <Image
                    src={coverFor(doc.id, locale)}
                    alt=""
                    fill
                    priority={i === 0}
                    sizes="(min-width: 810px) 45vw, 90vw"
                    className="object-cover"
                  />
                </span>
                <span className="block px-2.5 pt-5 pb-2.5 tab:pt-[18px] tab:pb-2">
                  <h2 className="landing-serif mb-3 font-landing-display text-[26px] leading-[1.2] text-white">
                    {doc.title}
                  </h2>
                  <span className="mb-5 block text-[14px] leading-[1.4] text-site-muted tab:leading-[1.25]">
                    {doc.description}
                  </span>
                  <PostByline
                    doc={doc}
                    className="border-t border-site-line pt-[18px]"
                  />
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
