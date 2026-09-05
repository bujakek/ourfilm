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
    if (!key || telemetryIsAttached()) return

    let cancelled = false
    const start = () => {
      void import('posthog-js').then(({ default: posthog }) => {
        if (cancelled || telemetryIsAttached()) return
        posthog.init(key, telemetryConfig())
        attachTelemetry(posthog)
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
