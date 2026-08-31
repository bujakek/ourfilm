'use client'

import Link from 'next/link'
import { useEffect } from 'react'

import { BackgroundGlow } from '@/components/site/background-glow'
import { defaultLocale, localePath } from '@/lib/i18n'

/**
 * The body of every `error.tsx` in the app.
 *
 * There is one `error.tsx` per root layout — the public site and the product
 * area each own their own document — and neither is a good place to keep a
 * second copy of this markup. English only: an error boundary renders when the
 * page that knew the locale is the thing that failed.
 */
export function ErrorScreen({
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
          Something went wrong
        </h1>
        <p className="mt-4 leading-relaxed text-pretty text-muted-foreground">
          We could not load this page. Try again — if you were uploading photos,
          they have not been lost.
        </p>
        <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:justify-center">
          <button
            type="button"
            onClick={reset}
            className="btn-shine inline-flex items-center justify-center rounded-full bg-primary px-7 py-3.5 text-sm font-semibold text-primary-foreground transition-transform hover:scale-[1.03]"
          >
            Try again
          </button>
          <Link
            href={localePath(defaultLocale, '/')}
            className="glass glass-hover inline-flex items-center justify-center rounded-full px-7 py-3.5 text-sm font-semibold text-foreground"
          >
            Back to home
          </Link>
        </div>
        {error.digest ? (
          <p className="mt-6 text-xs text-muted-foreground/60">
            Error ID: {error.digest}
          </p>
        ) : null}
      </main>
    </div>
  )
}
