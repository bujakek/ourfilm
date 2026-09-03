import { PageGrain } from '@/components/site/page-grain'
import { Footer } from '@/components/site/footer'
import { Navbar } from '@/components/site/navbar'
import type { Locale } from '@/lib/i18n'
import type { ReactNode } from 'react'

/**
 * Chrome only — no page header.
 *
 * Content routes cannot use `PageShell`: a page renders its own `<h1>` from
 * frontmatter, so the header has to come from the document rather than from a
 * wrapper. Each hub supplies its own `PageHeader` instead.
 *
 * Shared by all four content route trees so they cannot drift into looking
 * like four different sites.
 */
export function ContentLayout({
  locale,
  children,
}: {
  locale: Locale
  children: ReactNode
}) {
  return (
    <div className="relative min-h-screen">
      <PageGrain />
      <Navbar locale={locale} />
      <main className="relative z-10">{children}</main>
      <Footer locale={locale} />
    </div>
  )
}
