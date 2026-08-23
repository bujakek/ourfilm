import { isLocale, locales } from '@/lib/i18n'
import { notFound } from 'next/navigation'
import type { ReactNode } from 'react'

/**
 * The locale segment every public page now sits under.
 *
 * Deliberately not a visual wrapper — pages still render their own chrome, so
 * this only does two things: prerender the enabled locales, and refuse
 * everything else.
 *
 * `<html lang>` is *not* set here. It lives in the single root layout, which
 * is correct while Hungarian is the only locale; making it vary means
 * splitting into two root layouts, which in Next 16 pushes the global 404 onto
 * an experimental flag. That trade is deferred to the day English is enabled —
 * see the checklist in CLAUDE.md.
 */
export function generateStaticParams() {
  return locales.map((locale) => ({ locale }))
}

/** With `generateStaticParams` above, an unlisted locale is not built and does
 *  not fall through to a runtime render. The explicit check below covers the
 *  same ground in dev, where `dynamicParams` does not apply. */
export const dynamicParams = false

export default async function LocaleLayout({
  children,
  params,
}: {
  children: ReactNode
  params: Promise<{ locale: string }>
}) {
  const { locale } = await params
  if (!isLocale(locale)) notFound()

  return children
}
