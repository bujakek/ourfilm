'use client'

import { useEffect } from 'react'

import {
  attachTelemetry,
  telemetryConfig,
  telemetryIsAttached,
  telemetryKey,
} from '@/lib/telemetry'

/**
 * Loads PostHog after the page has painted, and only where a key exists.
 *
 * Deliberately not `instrumentation-client.ts`: that runs before hydration on
 * every page, and a QR landing on venue wifi should not wait behind an
 * analytics bundle several times the size of the upload path. The first
 * outcome the queue reports — a restored shot, on mount — is buffered by
 * `lib/telemetry.ts` until this attaches, so nothing is lost to the delay.
 *
 * Renders nothing. Mounted once in `app/(product)/layout.tsx`.
 */
export function PostHogLoader() {
  useEffect(() => {
    const key = telemetryKey()
    // A magic-link credential lives in this route's query string until the
    // exchange redirects. Nothing, including an SDK initialization request,
    // needs to run there.
    if (
      !key ||
      telemetryIsAttached() ||
      window.location.pathname === '/auth/callback'
    )
      return

    let cancelled = false
    const start = () => {
      void import('posthog-js')
        .then(({ default: posthog }) => {
          if (cancelled || telemetryIsAttached()) return
          posthog.init(key, telemetryConfig())
          attachTelemetry(posthog)
        })
        .catch((error: unknown) => {
          // PostHog cannot report its own chunk failing to load. Keep the app
          // unaffected and leave one local breadcrumb for development.
          console.warn('Product health telemetry did not load', error)
        })
    }

    // Idle when the browser offers it, a short timer where it does not (Safari
    // has no `requestIdleCallback`). The timeout bounds a busy page.
    if (typeof requestIdleCallback === 'function') {
      const idle = requestIdleCallback(start, { timeout: 4000 })
      return () => {
        cancelled = true
        cancelIdleCallback(idle)
      }
    }
    const timer = setTimeout(start, 1500)
    return () => {
      cancelled = true
      clearTimeout(timer)
    }
  }, [])

  return null
}
