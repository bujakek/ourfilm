import { type Locale, localePath } from '@/lib/i18n'
import { occasionCopy, occasions } from '@/lib/occasions'
import { CONTACT_EMAIL } from '@/lib/site'
import { Aperture } from 'lucide-react'
import Link from 'next/link'

import { CREATE_EVENT_PATH } from '@/lib/routes'
import { marketingCopy } from '@/lib/marketing-copy'

interface FooterColumn {
  heading: string
  links: { label: string; href: string; external?: boolean }[]
}

/**
 * Every href here must resolve to something that exists — a section that is
 * actually on the homepage, or a route with a page behind it. Links to pages
 * we have not written yet belong in the backlog, not in the footer.
 *
 * Homepage anchors are absolute (`/#faq`, not `#faq`) because the footer also
 * renders on /arak, /rolunk and the rest, where a bare fragment points at
 * nothing.
 *
 * Every href is written locale-relative and prefixed at render. The exception
 * is anything under `/host`, flagged `external` here: that area sits outside
 * the locale tree, and `proxy.ts` matches it by exact path.
 */
const columnsByLocale: Record<Locale, FooterColumn[]> = {
  en: [
    {
      heading: 'Product',
      links: [
        { label: 'How it works', href: '/#how-it-works' },
        { label: 'QR code', href: '/#qr-code' },
        { label: 'Photo reveal', href: '/#photo-reveal' },
        { label: 'Pricing', href: '/arak' },
      ],
    },
    {
      heading: 'Occasions',
      links: occasions.map((occasion) => ({
        label: occasionCopy('en', occasion).label,
        href: `/alkalmak/${occasion.slug}`,
      })),
    },
    {
      heading: 'Support',
      links: [
        { label: 'FAQ', href: '/#faq' },
        { label: 'Contact', href: '/kapcsolat' },
        {
          label: 'Create your camera',
          href: `${CREATE_EVENT_PATH}?lang=en`,
          external: true,
        },
      ],
    },
    {
      heading: 'Resources',
      links: [
        { label: 'Blog', href: '/blog' },
        { label: 'Alternatives', href: '/alternativak' },
      ],
    },
    {
      heading: 'Company',
      links: [
        { label: 'About', href: '/rolunk' },
        { label: 'Legal notice', href: '/impresszum' },
        { label: 'Privacy', href: '/adatvedelem' },
        { label: 'Terms', href: '/aszf' },
        { label: 'Magyar', href: '/hu', external: true },
      ],
    },
  ],
  hu: [
    {
      heading: 'Termék',
      links: [
        { label: 'Hogyan működik', href: '/#how-it-works' },
        { label: 'QR-kód', href: '/#qr-code' },
        { label: 'A képek előhívása', href: '/#photo-reveal' },
        { label: 'Árak', href: '/arak' },
      ],
    },
    {
      heading: 'Alkalmak',
      links: occasions.map((occasion) => ({
        label: occasion.label,
        href: `/alkalmak/${occasion.slug}`,
      })),
    },
    {
      heading: 'Támogatás',
      links: [
        { label: 'Gyakori kérdések', href: '/#faq' },
        { label: 'Kapcsolat', href: '/kapcsolat' },
        {
          label: 'Hozd létre ingyen',
          href: `${CREATE_EVENT_PATH}?lang=hu`,
          external: true,
        },
      ],
    },
    {
      heading: 'Tudásbázis',
      links: [
        { label: 'Blog', href: '/blog' },
        { label: 'Alternatívák', href: '/alternativak' },
        { label: 'Összehasonlítás', href: '/osszehasonlitas' },
      ],
    },
    {
      heading: 'Jogi',
      links: [
        { label: 'Rólunk', href: '/rolunk' },
        { label: 'Impresszum', href: '/impresszum' },
        { label: 'Adatkezelési tájékoztató', href: '/adatvedelem' },
        { label: 'Általános Szerződési Feltételek', href: '/aszf' },
        {
          label: 'Elállás a szerződéstől',
          href: '/kapcsolat#elallas',
        },
        { label: 'English', href: '/en', external: true },
      ],
    },
  ],
}

export function Footer({ locale }: { locale: Locale }) {
  const copy = marketingCopy[locale].footer
  const columns = columnsByLocale[locale]
  return (
    <footer className="relative px-4 pt-16 pb-10 sm:px-6">
      <div className="mx-auto max-w-6xl">
        <div className="glass rounded-[2rem] p-8 sm:p-12">
          <div className="flex flex-col gap-12 lg:flex-row lg:justify-between">
            <div className="max-w-xs">
              <Link
                href={localePath(locale, '/')}
                className="flex items-center gap-2.5"
                aria-label={marketingCopy[locale].nav.home}
              >
                <span className="glass flex size-9 items-center justify-center rounded-xl">
                  <Aperture
                    className="size-5 text-accent"
                    strokeWidth={1.6}
                    aria-hidden="true"
                  />
                </span>
                <span className="text-lg font-semibold tracking-tight">
                  OurFilm
                </span>
              </Link>
              <p className="mt-4 text-sm leading-relaxed text-muted-foreground">
                {copy.tagline}
              </p>
              <a
                href={`mailto:${CONTACT_EMAIL}`}
                className="mt-4 inline-block text-sm text-foreground/80 underline underline-offset-4 transition-colors hover:text-foreground"
              >
                {CONTACT_EMAIL}
              </a>
            </div>

            <nav
              aria-label={copy.aria}
              className="grid grid-cols-2 gap-8 sm:grid-cols-3 lg:grid-cols-5 lg:gap-10"
            >
              {columns.map((column) => (
                <div key={column.heading}>
                  <h2 className="text-xs font-semibold tracking-wider text-muted-foreground uppercase">
                    {column.heading}
                  </h2>
                  <ul className="mt-4 flex flex-col gap-3">
                    {column.links.map((link) => (
                      <li key={link.href}>
                        <Link
                          href={
                            link.external
                              ? link.href
                              : localePath(locale, link.href)
                          }
                          className="text-sm text-foreground/80 transition-colors hover:text-foreground"
                        >
                          {link.label}
                        </Link>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </nav>
          </div>

          <div className="mt-12 border-t border-border pt-6">
            {/* Never a literal year: the footer renders on every page, and a
                hardcoded one silently goes stale on 1 January. */}
            <p className="text-sm text-muted-foreground">
              © {new Date().getFullYear()} OurFilm. {copy.copyright}
            </p>
          </div>
        </div>
      </div>
    </footer>
  )
}
