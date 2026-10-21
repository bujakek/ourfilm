import { SiteShell } from '@/components/pages/site-shell'
import type { Locale } from '@/lib/i18n'
import type { ReactNode } from 'react'

/**
 * Chrome only — no page header.
 *
 * Content routes cannot use `PageShell`: a page renders its own `<h1>` from
 * frontmatter, so the header has to come from the document rather than from a
 * wrapper. Each hub supplies its own `PageHeader` instead.
 *
 * The chrome is `SiteShell`, the frame of every page around the homepage, so
 * the content library and the rest of the site cannot drift apart.
 */
export function ContentLayout({
  locale,
  children,
}: {
  locale: Locale
  children: ReactNode
}) {
  return <SiteShell locale={locale}>{children}</SiteShell>
}
