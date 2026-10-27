import { SiteShell } from '@/components/pages/site-shell'
import { isLocale } from '@/lib/i18n'
import { notFound } from 'next/navigation'
import type { ReactNode } from 'react'

export default async function Layout({
  children,
  params,
}: {
  children: ReactNode
  params: Promise<{ locale: string }>
}) {
  const { locale } = await params
  if (!isLocale(locale)) notFound()

  return <SiteShell locale={locale}>{children}</SiteShell>
}
