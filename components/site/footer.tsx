import { type Locale, localePath } from '@/lib/i18n'
import { OCCASIONS_ARE_DRAFT } from '@/lib/occasions'
import { CONTACT_EMAIL } from '@/lib/site'
import { Aperture } from 'lucide-react'
import Link from 'next/link'

import { marketingCopy } from '@/lib/marketing-copy'

interface FooterColumn {
  heading: string
  links: { label: string; href: string; external?: boolean }[]
}

/**
 * Three columns, not five. The occasion sub-links collapsed into the
 * `/alkalmak` index they all sit under — which is itself hidden while
 * `OCCASIONS_ARE_DRAFT`; everything else is redistributed
 * rather than dropped, because these are real pages and one of them —
 * `Elállás a szerződéstől` — is consumer-law reachability rather than
 * navigation.
 *
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
        ...(OCCASIONS_ARE_DRAFT
          ? []
          : [{ label: 'Occasions', href: '/alkalmak' }]),
        { label: 'Pricing', href: '/arak' },
        { label: 'Blog', href: '/blog' },
      ],
    },
    {
      heading: 'Company',
      links: [
        { label: 'About', href: '/rolunk' },
        { label: 'Contact', href: '/kapcsolat' },
        { label: 'Legal notice', href: '/impresszum' },
        { label: 'Alternatives', href: '/alternativak' },
      ],
    },
    {
      heading: 'Legal',
      links: [
        { label: 'Terms', href: '/aszf' },
        { label: 'Privacy', href: '/adatvedelem' },
        { label: 'Magyar', href: '/hu', external: true },
      ],
    },
  ],
  hu: [
    {
      heading: 'A termék',
      links: [
        { label: 'Hogyan működik', href: '/#how-it-works' },
        { label: 'QR-kód', href: '/#qr-code' },
        { label: 'A képek előhívása', href: '/#photo-reveal' },
        ...(OCCASIONS_ARE_DRAFT
          ? []
          : [{ label: 'Alkalmak', href: '/alkalmak' }]),
        { label: 'Árak', href: '/arak' },
        { label: 'Blog', href: '/blog' },
      ],
    },
    {
      heading: 'A cég',
      links: [
        { label: 'Rólunk', href: '/rolunk' },
        { label: 'Kapcsolat', href: '/kapcsolat' },
        { label: 'Impresszum', href: '/impresszum' },
        { label: 'Alternatívák', href: '/alternativak' },
        { label: 'Összehasonlítás', href: '/osszehasonlitas' },
      ],
    },
    {
      heading: 'Jogi',
      links: [
        { label: 'ÁSZF', href: '/aszf' },
        { label: 'Adatvédelem', href: '/adatvedelem' },
        // Consumer withdrawal. It is reachable from the footer on purpose and
        // is the one link here that is not a navigation choice.
        { label: 'Elállás a szerződéstől', href: '/kapcsolat#elallas' },
        { label: 'English', href: '/en', external: true },
      ],
    },
  ],
}

export function Footer({ locale }: { locale: Locale }) {
  const copy = marketingCopy[locale].footer
  const columns = columnsByLocale[locale]
  return (
    /* A rule and four columns, not a glass card floating above the page edge.
       A footer is where a document ends; a card there is a card with nothing
       after it, which is why the old one always looked like it had been left
       behind by a section. */
    <footer className="relative border-t border-border px-5 pt-14 pb-12 sm:px-6 lg:px-10">
      <div className="mx-auto max-w-6xl">
        <div className="grid gap-10 lg:grid-cols-[1.4fr_repeat(3,1fr)]">
          <div>
            <Link
              href={localePath(locale, '/')}
              className="inline-flex min-h-11 items-center gap-2.5"
              aria-label={marketingCopy[locale].nav.home}
            >
              <Aperture
                className="size-[17px] text-accent"
                strokeWidth={1.6}
                aria-hidden="true"
              />
              <span className="text-[16px] font-semibold tracking-[-0.015em]">
                OurFilm
              </span>
            </Link>
            <p className="mt-3 max-w-[18rem] text-[14px] leading-[1.55] text-foreground/50">
              {copy.tagline}
            </p>
            <a
              href={`mailto:${CONTACT_EMAIL}`}
              className="mt-2 inline-flex min-h-11 items-center text-[14px] text-foreground/70 underline underline-offset-4 transition-colors hover:text-foreground"
            >
              {CONTACT_EMAIL}
            </a>
          </div>

          <nav
            aria-label={copy.aria}
            className="col-span-full grid grid-cols-2 gap-10 sm:grid-cols-3 lg:col-span-3"
          >
            {columns.map((column) => (
              <div key={column.heading}>
                <h2 className="font-mono text-[9px] font-medium tracking-[0.18em] text-foreground/38">
                  {column.heading.toUpperCase()}
                </h2>
                <ul className="mt-2 flex flex-col gap-0.5 md:mt-3.5 md:gap-2.5">
                  {column.links.map((link) => (
                    <li key={link.href}>
                      <Link
                        href={
                          link.external
                            ? link.href
                            : localePath(locale, link.href)
                        }
                        className="inline-flex min-h-11 min-w-11 items-center text-[14px] text-foreground/62 transition-colors hover:text-foreground md:min-h-0 md:min-w-0"
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

        {/* Never a literal year: the footer renders on every page, and a
            hardcoded one silently goes stale on 1 January. */}
        <p className="mt-12 border-t border-white/8 pt-6 font-mono text-[9.5px] font-medium tracking-[0.14em] text-foreground/32">
          © {new Date().getFullYear()} OURFILM · {copy.copyright.toUpperCase()}
        </p>
      </div>
    </footer>
  )
}
