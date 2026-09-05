'use client'

import Link from 'next/link'
import { useEffect } from 'react'

import { PageGrain } from '@/components/site/page-grain'
import { Button, buttonVariants } from '@/components/ui/button'
import { defaultLocale, localePath } from '@/lib/i18n'
import { trackClientError } from '@/lib/telemetry'

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
    trackClientError(error, 'page')
  }, [error])

  return (
    <div className="relative flex min-h-screen items-center justify-center px-4 py-16">
      <PageGrain />
      <main className="relative z-10 w-full max-w-md text-center">
        <h1 className="text-3xl font-semibold tracking-tight text-balance sm:text-4xl">
          Something went wrong
        </h1>
        <p className="mt-4 leading-relaxed text-pretty text-muted-foreground">
          We could not load this page. Try again — if you were uploading photos,
          they have not been lost.
        </p>
        <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:justify-center">
          <Button type="button" onClick={reset}>
            Try again
          </Button>
          <Link
            href={localePath(defaultLocale, '/')}
            className={buttonVariants({ variant: 'secondary' })}
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
