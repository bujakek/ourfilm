import { BackgroundGlow } from '@/components/site/background-glow'
import Link from 'next/link'
import { defaultLocale, localePath } from '@/lib/i18n'

export default function NotFound() {
  return (
    <div className="relative flex min-h-screen items-center justify-center px-4 py-16">
      <BackgroundGlow />
      <main className="relative z-10 w-full max-w-md text-center">
        <span className="glass inline-flex items-center gap-2 rounded-full px-4 py-1.5 text-xs font-medium tracking-wide text-accent">
          404
        </span>
        <h1 className="mt-6 text-3xl font-semibold tracking-tight text-balance sm:text-4xl">
          Ez az oldal nem található
        </h1>
        {/* Most people who land here mistyped a QR link, so lead with that
            rather than a generic apology. */}
        <p className="mt-4 leading-relaxed text-pretty text-muted-foreground">
          Lehet, hogy elgépelted a linket, vagy a kód egy része lemaradt. Olvasd
          be újra a QR-kódot, vagy kérd el a linket a házigazdától.
        </p>
        <Link
          href={localePath(defaultLocale, '/')}
          className="btn-shine mt-8 inline-flex items-center justify-center rounded-full bg-primary px-7 py-3.5 text-sm font-semibold text-primary-foreground transition-transform hover:scale-[1.03]"
        >
          Vissza a főoldalra
        </Link>
      </main>
    </div>
  )
}
