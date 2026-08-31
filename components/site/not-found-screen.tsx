import Link from 'next/link'

import { BackgroundGlow } from '@/components/site/background-glow'
import { defaultLocale, type Locale, localePath } from '@/lib/i18n'

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
      <BackgroundGlow />
      <main className="relative z-10 w-full max-w-md text-center">
        <span className="glass inline-flex items-center gap-2 rounded-full px-4 py-1.5 text-xs font-medium tracking-wide text-accent">
          404
        </span>
        <h1 className="mt-6 text-3xl font-semibold tracking-tight text-balance sm:text-4xl">
          {text.heading}
        </h1>
        {/* Most people who land here mistyped a QR link, so lead with that
            rather than a generic apology. */}
        <p className="mt-4 leading-relaxed text-pretty text-muted-foreground">
          {text.body}
        </p>
        <Link
          href={localePath(locale, '/')}
          className="btn-shine mt-8 inline-flex items-center justify-center rounded-full bg-primary px-7 py-3.5 text-sm font-semibold text-primary-foreground transition-transform hover:scale-[1.03]"
        >
          {text.cta}
        </Link>
      </main>
    </div>
  )
}
