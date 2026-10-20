import Link from 'next/link'

import { PageGrain } from '@/components/site/page-grain'
import { defaultLocale, type Locale, localePath } from '@/lib/i18n'

/** The landing's white primary, written out: these screens are shared by the
 *  public site and the product, and neither tree's class module belongs to
 *  the other. `error-screen.tsx` imports both. */
export const SCREEN_PRIMARY =
  'inline-flex h-14 items-center justify-center rounded-[16px] bg-white px-6 text-[16px] font-medium text-landing-ink transition-colors hover:bg-white/90'

export const SCREEN_SECONDARY =
  'inline-flex h-14 items-center justify-center rounded-[16px] bg-white/8 px-6 text-[16px] font-medium text-white transition-colors hover:bg-white/12'

const copy = {
  en: {
    heading: 'Page not found',
    body: 'The link may be incomplete. Scan the QR code again or ask the host for the event link.',
    cta: 'Back to home',
  },
  hu: {
    heading: 'Nincs ilyen oldal',
    body: 'Lehet, hogy hiányos a link. Olvasd be újra a QR-kódot, vagy kérd el a szervezőtől az esemény linkjét.',
    cta: 'Vissza a főoldalra',
  },
} as const satisfies Record<Locale, unknown>

/**
 * The body of every 404 in the app: the per-segment `not-found.tsx` files and
 * the global one.
 *
 * `locale` is passed rather than inferred because the three callers know it
 * differently — a locale segment has it, the product area does not, and
 * `global-not-found` renders for a URL that matched no route at all and so has
 * nothing to read it from.
 */
export function NotFoundScreen({
  locale = defaultLocale,
}: {
  locale?: Locale
}) {
  const text = copy[locale]

  return (
    <div className="relative flex min-h-screen items-center justify-center px-4 py-16">
      <PageGrain />
      <main className="relative z-10 w-full max-w-md text-center">
        <p className="text-[11px] leading-[1.3] font-medium tracking-[0.24em] text-white/65 uppercase">
          404
        </p>
        <h1 className="mt-4 text-[30px] leading-[1.2] font-medium tracking-tight text-balance text-white">
          {text.heading}
        </h1>
        {/* Most people who land here mistyped a QR link, so lead with that
            rather than a generic apology. */}
        <p className="mt-4 text-[16px] leading-[1.6] text-pretty text-white/65">
          {text.body}
        </p>
        <Link
          href={localePath(locale, '/')}
          className={`mt-8 ${SCREEN_PRIMARY}`}
        >
          {text.cta}
        </Link>
      </main>
    </div>
  )
}
