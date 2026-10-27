import Link from 'next/link'

import { Brand } from '@/components/landing/landing-nav'
import { type Locale, localePath } from '@/lib/i18n'
import { occasionCopy, occasionPath, occasions } from '@/lib/occasions'
import { LOGIN_PATH } from '@/lib/routes'
import { siteCopy } from '@/lib/site-copy'
import { CONTACT_EMAIL, demoEventUrl } from '@/lib/site'
import { cn } from '@/lib/utils'

import { SITE_CONTAINER, SITE_KICKER } from './layout'

/**
 * A rule, the mark and four short columns.
 *
 * Every page the old footer reached is still reached from here: the legal
 * notice and the withdrawal notice are consumer-law reachability rather than
 * navigation, and must not be dropped to tidy a column.
 */
export function SiteFooter({ locale }: { locale: Locale }) {
  const copy = siteCopy[locale].footer
  const { links } = copy
  const home = localePath(locale, '/')
  const targetLocale: Locale = locale === 'en' ? 'hu' : 'en'

  const columns = [
    {
      heading: copy.product,
      items: [
        { label: links.howItWorks, href: `${home}#how-it-works` },
        { label: links.tryIt, href: demoEventUrl(locale) },
        { label: links.pricing, href: localePath(locale, '/arak') },
        { label: links.login, href: `${LOGIN_PATH}?lang=${locale}` },
      ],
    },
    {
      heading: copy.occasions,
      items: occasions.map((occasion) => ({
        label: occasionCopy(locale, occasion).label,
        href: occasionPath(locale, occasion),
      })),
    },
    {
      heading: copy.help,
      items: [
        { label: links.faq, href: `${home}#faq` },
        { label: links.contact, href: localePath(locale, '/kapcsolat') },
        { label: links.privacy, href: localePath(locale, '/adatvedelem') },
        { label: links.terms, href: localePath(locale, '/aszf') },
        {
          label: links.withdrawal,
          href: `${localePath(locale, '/kapcsolat')}#elallas`,
        },
      ],
    },
    {
      heading: copy.company,
      items: [
        { label: links.blog, href: localePath(locale, '/blog') },
        { label: links.about, href: localePath(locale, '/rolunk') },
        { label: links.legal, href: localePath(locale, '/impresszum') },
        {
          label: links.alternatives,
          href: localePath(locale, '/alternativak'),
        },
      ],
    },
  ]

  return (
    <footer
      className={cn(
        SITE_CONTAINER,
        'border-t border-site-line pt-[45px] tab:grid tab:grid-cols-[1fr_2fr] tab:gap-[30px] tab:pt-[65px] xl:grid-cols-[1fr_1.5fr] xl:gap-[50px]',
      )}
    >
      <div>
        <Link
          href={home}
          className="inline-flex items-center gap-[7px]"
          aria-label="OurFilm"
        >
          <Brand size="sm" />
        </Link>
        <p className="mt-[22px] text-[15px] leading-[1.5] text-site-muted tab:mt-6 tab:text-[16px]">
          {copy.taglineLines.map((line) => (
            <span key={line} className="block">
              {line}
            </span>
          ))}
        </p>
      </div>

      <nav
        aria-label={copy.aria}
        className="mt-11 grid grid-cols-2 gap-[30px] tab:mt-0 tab:grid-cols-4 tab:gap-5 xl:gap-[30px]"
      >
        {columns.map((column) => (
          <div key={column.heading}>
            <h2
              className={cn(
                SITE_KICKER,
                'mb-4 text-[12px] tracking-[0.15em] tab:mb-5 tab:text-[12px]',
              )}
            >
              {column.heading}
            </h2>
            <ul>
              {column.items.map((item) => (
                <li key={item.label}>
                  <Link
                    href={item.href}
                    className="mb-3 block text-[14px] text-site-soft transition-colors hover:text-white"
                  >
                    {item.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </nav>

      <div className="col-span-full mt-11 flex flex-wrap gap-x-6 gap-y-2 text-[12px] text-site-faint tab:mt-[15px]">
        {/* Never a literal year: a hardcoded one goes stale on 1 January. */}
        <p>© {new Date().getFullYear()} OurFilm</p>
        <a
          href={`mailto:${CONTACT_EMAIL}`}
          className="transition-colors hover:text-white"
        >
          {CONTACT_EMAIL}
        </a>
        <Link
          href={localePath(targetLocale, '/')}
          hrefLang={targetLocale}
          className="transition-colors hover:text-white"
        >
          {copy.language}
        </Link>
      </div>
    </footer>
  )
}
