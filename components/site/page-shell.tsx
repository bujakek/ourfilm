import { BackgroundGlow } from '@/components/site/background-glow'
import { Footer } from '@/components/site/footer'
import { Navbar } from '@/components/site/navbar'
import { PageHeader } from '@/components/site/page-header'
import type { Locale } from '@/lib/i18n'
import type { ReactNode } from 'react'

interface PageShellProps {
  /** Drives the locale-relative hrefs in the nav and footer. */
  locale: Locale
  /** Short uppercase section marker shown in the pill above the title. */
  eyebrow: string
  title: ReactNode
  /** One or two sentences under the title. */
  lead?: ReactNode
  children: ReactNode
}

/**
 * The frame every standalone marketing page sits in — the same glow, nav and
 * footer as the homepage, plus the standard header.
 *
 * Blog routes deliberately do not use this: they need the chrome without a
 * fixed header, so `app/[locale]/blog/layout.tsx` composes the same parts
 * itself and each page supplies its own `PageHeader`.
 */
export function PageShell({
  locale,
  eyebrow,
  title,
  lead,
  children,
}: PageShellProps) {
  return (
    <div className="relative min-h-screen">
      <BackgroundGlow />
      <Navbar locale={locale} />
      <main className="relative z-10">
        <PageHeader eyebrow={eyebrow} title={title} lead={lead} />
        {children}
      </main>
      <Footer locale={locale} />
    </div>
  )
}
