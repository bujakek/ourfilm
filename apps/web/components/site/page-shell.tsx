import { SiteShell } from '@/components/pages/site-shell'
import { PageHeader } from '@/components/site/page-header'
import type { Locale } from '@/lib/i18n'
import type { ReactNode } from 'react'

interface PageShellProps {
  /** Drives the locale-relative hrefs in the nav and footer. */
  locale: Locale
  /** Short section marker shown in capitals above the title. */
  eyebrow: string
  title: ReactNode
  /** One or two sentences under the title. */
  lead?: ReactNode
  children: ReactNode
}

/** `SiteShell` with the standard header, for a standalone page. */
export function PageShell({
  locale,
  eyebrow,
  title,
  lead,
  children,
}: PageShellProps) {
  return (
    <SiteShell locale={locale}>
      <PageHeader eyebrow={eyebrow} title={title} lead={lead} />
      {children}
    </SiteShell>
  )
}
