import { BackgroundGlow } from '@/components/site/background-glow'
import { Footer } from '@/components/site/footer'
import { Navbar } from '@/components/site/navbar'
import { isLocale } from '@/lib/i18n'
import { notFound } from 'next/navigation'
import type { ReactNode } from 'react'

/**
 * Chrome only — no page header.
 *
 * Blog routes cannot use `PageShell`: a post renders its own `<h1>` from
 * frontmatter, so the header has to come from the article rather than from a
 * wrapper. The index supplies its own `PageHeader` instead.
 */
export default async function BlogLayout({
  children,
  params,
}: {
  children: ReactNode
  params: Promise<{ locale: string }>
}) {
  const { locale } = await params
  if (!isLocale(locale)) notFound()

  return (
    <div className="relative min-h-screen">
      <BackgroundGlow />
      <Navbar locale={locale} />
      <main className="relative z-10">{children}</main>
      <Footer locale={locale} />
    </div>
  )
}
