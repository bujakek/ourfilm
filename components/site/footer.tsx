import { type Locale, localePath } from '@/lib/i18n'
import { occasions } from '@/lib/occasions'
import { CONTACT_EMAIL } from '@/lib/site'
import { Aperture } from 'lucide-react'
import Link from 'next/link'

import { CREATE_EVENT_PATH } from '@/lib/routes'

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
const columns: FooterColumn[] = [
  {
    heading: 'Termék',
    links: [
      { label: 'Hogyan működik', href: '/#how-it-works' },
      { label: 'Bemutató', href: '/#live-demo' },
      { label: 'Minden kép egy helyen', href: '/#photo-quality' },
      { label: 'Árak', href: '/arak' },
    ],
  },
  {
    // Generated from the same module the pages and the sitemap read, so a new
    // occasion appears here without anyone remembering to add it.
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
      { label: 'Próbáld ki ingyen', href: CREATE_EVENT_PATH, external: true },
    ],
  },
  {
    heading: 'Cég',
    links: [
      { label: 'Rólunk', href: '/rolunk' },
      { label: 'Blog', href: '/blog' },
      { label: 'Adatkezelési tájékoztató', href: '/adatvedelem' },
      { label: 'Általános Szerződési Feltételek', href: '/aszf' },
    ],
  },
]

export function Footer({ locale }: { locale: Locale }) {
  return (
    <footer className="relative px-4 pt-16 pb-10 sm:px-6">
      <div className="mx-auto max-w-6xl">
        <div className="glass rounded-[2rem] p-8 sm:p-12">
          <div className="flex flex-col gap-12 lg:flex-row lg:justify-between">
            <div className="max-w-xs">
              <Link
                href={localePath(locale, '/')}
                className="flex items-center gap-2.5"
                aria-label="OurFilm — vissza a főoldalra"
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
                Minden vendégfotó egy közös albumban.
              </p>
              <a
                href={`mailto:${CONTACT_EMAIL}`}
                className="mt-4 inline-block text-sm text-foreground/80 underline underline-offset-4 transition-colors hover:text-foreground"
              >
                {CONTACT_EMAIL}
              </a>
            </div>

            <nav
              aria-label="Lábléc"
              className="grid grid-cols-2 gap-8 sm:grid-cols-4 lg:gap-12"
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
              © {new Date().getFullYear()} OurFilm. Minden jog fenntartva.
            </p>
          </div>
        </div>
      </div>
    </footer>
  )
}
