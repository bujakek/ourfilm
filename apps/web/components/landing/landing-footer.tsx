import Link from 'next/link'

import { MenuMark } from '@/components/brand/menu-mark'
import { type Locale, localePath } from '@/lib/i18n'
import { landingCopy } from '@/lib/landing-copy'
import { occasionCopy, occasionPath, occasions } from '@/lib/occasions'
import { LOGIN_PATH } from '@/lib/routes'
import { CONTACT_EMAIL, demoEventUrl } from '@/lib/site'
import { cn } from '@/lib/utils'

import { LANDING_CONTAINER, LANDING_EYEBROW } from './layout'

/**
 * The page ends on a card: the mark, one line, and four columns.
 *
 * Every page the old footer reached is still reached from here — the legal
 * notice and the withdrawal notice are consumer-law reachability, not
 * navigation, and must not be dropped to tidy a column.
 */
export function LandingFooter({ locale }: { locale: Locale }) {
  const copy = landingCopy[locale].footer
  const { links } = copy
  const targetLocale: Locale = locale === 'en' ? 'hu' : 'en'

  const columns: {
    heading: string
    items: { label: string; href: string }[]
  }[] = [
    {
      heading: copy.columns.product,
      items: [
        { label: links.howItWorks, href: '#how-it-works' },
        { label: links.guestDemo, href: demoEventUrl(locale) },
        { label: links.pricing, href: localePath(locale, '/arak') },
        { label: links.login, href: `${LOGIN_PATH}?lang=${locale}` },
      ],
    },
    {
      heading: copy.columns.occasions,
      items: occasions.map((occasion) => ({
        label: occasionCopy(locale, occasion).label,
        href: occasionPath(locale, occasion),
      })),
    },
    {
      heading: copy.columns.help,
      items: [
        { label: links.faq, href: '#faq' },
        { label: links.privacy, href: localePath(locale, '/adatvedelem') },
        { label: links.terms, href: localePath(locale, '/aszf') },
        {
          label: links.withdrawal,
          href: `${localePath(locale, '/kapcsolat')}#elallas`,
        },
      ],
    },
    {
      heading: copy.columns.about,
      items: [
        { label: links.about, href: localePath(locale, '/rolunk') },
        { label: links.blog, href: localePath(locale, '/blog') },
        { label: links.contact, href: localePath(locale, '/kapcsolat') },
        { label: links.legal, href: localePath(locale, '/impresszum') },
        {
          label: links.alternatives,
          href: localePath(locale, '/alternativak'),
        },
      ],
    },
  ]

  return (
    <footer className={cn(LANDING_CONTAINER, 'pb-6 lg:pb-0')}>
      <div className="-mx-[9px] rounded-[24px] bg-white/4 p-[21px] lg:mx-0 lg:rounded-[32px] lg:p-9">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:gap-8">
          <span className="flex size-[50px] shrink-0 items-center justify-center rounded-[12px] bg-landing lg:size-[78px] lg:rounded-[16px]">
            <MenuMark className="h-[27px] w-[24px] lg:h-[40px] lg:w-[35px]" />
          </span>
          <p className="landing-serif font-landing-display text-[18px] leading-[1.4] text-white lg:text-[24px]">
            {copy.taglineLines.map((line) => (
              <span key={line} className="lg:block">
                {line}{' '}
              </span>
            ))}
          </p>
        </div>

        <nav
          aria-label={copy.aria}
          className="mt-6 grid gap-7 border-t border-dashed border-white/12 pt-6 lg:mt-[22px] lg:grid-cols-4 lg:gap-6 lg:pt-11"
        >
          {columns.map((column) => (
            <div key={column.heading}>
              <h2
                className={cn(
                  LANDING_EYEBROW,
                  'text-[12px] text-white/50 lg:text-[14px]',
                )}
              >
                {column.heading}
              </h2>
              <ul className="mt-2 flex flex-col lg:mt-3">
                {column.items.map((item) => (
                  <li key={item.label}>
                    <Link
                      href={item.href}
                      className="inline-flex min-h-[35px] items-center text-[15px] font-light text-white/70 transition-colors hover:text-white"
                    >
                      {item.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </nav>

        <div className="mt-8 flex flex-col gap-2 border-t border-dashed border-white/12 pt-5 text-[13px] text-white/40 lg:mt-9 lg:flex-row lg:items-center lg:gap-6">
          {/* Never a literal year: a hardcoded one goes stale on 1 January. */}
          <p>
            © {new Date().getFullYear()} OurFilm · {copy.copyright}
          </p>
          <a
            href={`mailto:${CONTACT_EMAIL}`}
            className="transition-colors hover:text-white"
          >
            {CONTACT_EMAIL}
          </a>
          <Link
            href={localePath(targetLocale, '/')}
            hrefLang={targetLocale}
            className="transition-colors hover:text-white lg:ml-auto"
          >
            {copy.language}
          </Link>
        </div>
      </div>
    </footer>
  )
}
