'use client'

import { BackgroundGlow } from '@/components/site/background-glow'
import Link from 'next/link'
import { useEffect } from 'react'
import { defaultLocale, localePath } from '@/lib/i18n'

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    // The digest is the only handle on the server-side stack, which Next
    // withholds from the browser in production. Without logging it, a
    // production error here is untraceable.
    console.error('Unhandled error', error.digest ?? '', error)
  }, [error])

  return (
    <div className="relative flex min-h-screen items-center justify-center px-4 py-16">
      <BackgroundGlow />
      <main className="relative z-10 w-full max-w-md text-center">
        <h1 className="text-3xl font-semibold tracking-tight text-balance sm:text-4xl">
          Valami félresikerült
        </h1>
        <p className="mt-4 leading-relaxed text-pretty text-muted-foreground">
          Nem sikerült betölteni az oldalt. Próbáld meg újra — ha a képeidet
          töltötted fel, azok nem vesztek el.
        </p>
        <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:justify-center">
          <button
            type="button"
            onClick={reset}
            className="btn-shine inline-flex items-center justify-center rounded-full bg-primary px-7 py-3.5 text-sm font-semibold text-primary-foreground transition-transform hover:scale-[1.03]"
          >
            Próbáld újra
          </button>
          <Link
            href={localePath(defaultLocale, '/')}
            className="glass glass-hover inline-flex items-center justify-center rounded-full px-7 py-3.5 text-sm font-semibold text-foreground"
          >
            Vissza a főoldalra
          </Link>
        </div>
        {error.digest ? (
          <p className="mt-6 text-xs text-muted-foreground/60">
            Hibaazonosító: {error.digest}
          </p>
        ) : null}
      </main>
    </div>
  )
}
