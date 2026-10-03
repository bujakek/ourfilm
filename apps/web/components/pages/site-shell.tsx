import type { ReactNode } from 'react'

import { landingFontClass } from '@/components/landing/fonts'
import { LandingNav } from '@/components/landing/landing-nav'
import type { Locale } from '@/lib/i18n'
import { siteCopy } from '@/lib/site-copy'

import { SiteFooter } from './site-footer'

/**
 * The frame of every page around the homepage: the homepage's own fonts and
 * ground, its navigation, and the quieter footer these pages end on.
 *
 * The navigation is the homepage's, not a copy of it — the same bar at the
 * bottom of a desktop window and the same sheet on a phone, so moving between
 * the homepage and a price or an article never changes the frame.
 */
export function SiteShell({
  locale,
  children,
}: {
  locale: Locale
  children: ReactNode
}) {
  return (
    <div
      className={`${landingFontClass} min-h-screen bg-landing pb-[60px] font-landing-sans text-white lg:pb-[120px]`}
    >
      <a
        href="#page-content"
        className="fixed top-2.5 left-5 z-[60] -translate-y-[150%] rounded-xl bg-white px-5 py-3 text-landing-ink focus:translate-y-0"
      >
        {siteCopy[locale].skip}
      </a>
      <LandingNav locale={locale} />
      <main id="page-content">{children}</main>
      <SiteFooter locale={locale} />
    </div>
  )
}
