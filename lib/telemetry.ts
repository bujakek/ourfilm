import 'client-only'

/**
 * Product analytics, and the one thing it exists for: knowing when a guest's
 * photo did not make it.
 *
 * The queue in `lib/upload-queue.ts` already knows every outcome — confirmed,
 * refunded, restored after a killed tab, dropped — and until now it told a
 * `console.error` in the guest's own browser, which nobody at a wedding opens.
 * This module carries those outcomes to PostHog so the question "did anyone at
 * this event lose a photo, and why" has an answer.
 *
 * The conditions this was adopted under, each of which `telemetryConfig` pins:
 *
 * - **EU cloud.** Supabase is in Zurich and the customers are Hungarian; the
 *   ingest host is `eu.i.posthog.com` and nothing else.
 * - **No cookies, no local storage, no identify.** There is no consent banner
 *   in the QR flow and adding one to a one-field join screen is a real cost.
 *   `cookieless_mode: 'always'` plus memory persistence means nothing is
 *   written to the device; the privacy page's "no non-essential cookie or
 *   similar tracking technology" sentence stays true.
 * - **No session replay, no autocapture, no surveys.** Replay would record
 *   photos and guest names into a third-party tool.
 * - **Behind our own origin.** `api_host` is `/ingest`, rewritten to PostHog in
 *   `next.config.mjs`, so `connect-src 'self'` holds and an ad blocker does
 *   not silently drop the upload reports this was introduced for.
 * - **Nothing about the photo or the person.** Events carry the event id and
 *   capture id (both random uuids), counts and reasons. Every URL property is
 *   masked by `sanitizeProperties` so the unguessable slug — the album's whole
 *   privacy model — never leaves the device.
 *
 * Loading is deferred (`components/analytics/posthog-loader.tsx`), so an
 * outcome can arrive before the client exists. `track` buffers until `attach`.
 */

export const POSTHOG_INGEST_PATH = '/ingest'
export const POSTHOG_UI_HOST = 'https://eu.posthog.com'

/**
 * Every event the guest page reports, in the order a guest meets them. The
 * question each one answers is in CLAUDE.md under Analytics; if an event
 * cannot be named there, it should not be here.
 */
export type TelemetryEvent =
  // Arriving
  | 'guest_page_viewed'
  | 'guest_join_refused'
  // Shooting
  | 'camera_opened'
  | 'shutter_pressed'
  | 'capture_prepared'
  // Uploading
  | 'upload_attempt_failed'
  | 'upload_confirmed'
  | 'upload_refunded'
  | 'upload_restored'
  | 'upload_discarded'
  | 'upload_dropped'
  | 'upload_refused'
  | 'upload_store_unavailable'
  // After
  | 'frame_delivered'

export type TelemetryProperties = Record<
  string,
  string | number | boolean | null | undefined
>

/** The one method needed from PostHog, so this module never imports it. */
export type TelemetryClient = {
  capture(
    event: string,
    properties?: Record<string, unknown>,
    options?: { send_instantly?: boolean },
  ): unknown
}

/** Outcomes that arrive before the client has loaded. Bounded: a page that
 *  never gets a client must not grow a list for ever. */
const MAX_BUFFERED = 50

let client: TelemetryClient | null = null
let buffered: Array<{
  event: TelemetryEvent
  properties: TelemetryProperties
}> = []

export function telemetryKey(): string | null {
  // Referenced literally: Next inlines `NEXT_PUBLIC_*` only when the whole
  // expression is spelled out.
  return process.env.NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN || null
}

/**
 * Record an upload outcome.
 *
 * `send_instantly` because these are rare and the moments they describe —
 * a tab about to be backgrounded, a queue giving up — are exactly when a
 * batched request would still be sitting in the client's queue.
 */
export function track(event: TelemetryEvent, properties: TelemetryProperties) {
  const enriched: TelemetryProperties = {
    ...properties,
    online: typeof navigator === 'undefined' ? null : navigator.onLine,
    visible:
      typeof document === 'undefined'
        ? null
        : document.visibilityState === 'visible',
  }
  if (client) {
    client.capture(event, enriched, { send_instantly: true })
    return
  }
  if (buffered.length >= MAX_BUFFERED) return
  buffered.push({ event, properties: enriched })
}

/** Hand over the loaded client and flush what arrived before it. */
export function attachTelemetry(next: TelemetryClient) {
  client = next
  const pending = buffered
  buffered = []
  for (const { event, properties } of pending) {
    next.capture(event, properties, { send_instantly: true })
  }
}

export function telemetryIsAttached() {
  return client !== null
}

/**
 * Both slug-bearing route shapes. `/host/events/new` is a fixed route, not a
 * slug, and stays readable.
 */
const SLUG_SEGMENTS = [
  /(\/e\/)[^/?#\s]+/g,
  /(\/host\/events\/)(?!new(?=[/?#\s]|$))[^/?#\s]+/g,
]

export function maskSlugs(value: string): string {
  return SLUG_SEGMENTS.reduce(
    (masked, pattern) => masked.replace(pattern, '$1[slug]'),
    value,
  )
}

/**
 * PostHog's `sanitize_properties` hook: every string property, on every
 * event. `$current_url`, `$pathname`, `$referrer` and the `$initial_*` set all
 * carry the page URL, and enumerating them is how one gets missed.
 */
export function sanitizeProperties<T extends Record<string, unknown>>(
  properties: T,
): T {
  const out: Record<string, unknown> = { ...properties }
  for (const [key, value] of Object.entries(out)) {
    if (typeof value === 'string') out[key] = maskSlugs(value)
    else if (value && typeof value === 'object' && !Array.isArray(value)) {
      out[key] = sanitizeProperties(value as Record<string, unknown>)
    }
  }
  // `$pageview` carries `document.title`, and on an event page that is the
  // host's event name — "Anna és Péter esküvője" — which the URL masking
  // above never touches. Seen in the first live export. On any slug route the
  // title is replaced wholesale rather than edited, because the event name is
  // free text and there is no pattern to mask it by.
  if (typeof out.title === 'string' && onSlugRoute(out)) {
    out.title = MASKED_TITLE
  }
  return out as T
}

export const MASKED_TITLE = '[event] — OurFilm'

function onSlugRoute(properties: Record<string, unknown>): boolean {
  return ['$current_url', '$pathname'].some((key) => {
    const value = properties[key]
    return (
      typeof value === 'string' &&
      (value.includes('/e/[slug]') || value.includes('/host/events/[slug]'))
    )
  })
}

/**
 * The `posthog.init` options. A plain object so the conditions above are
 * testable without a browser; `tests/unit/telemetry.test.ts` pins each one.
 */
export function telemetryConfig() {
  return {
    api_host: POSTHOG_INGEST_PATH,
    ui_host: POSTHOG_UI_HOST,
    cookieless_mode: 'always' as const,
    persistence: 'memory' as const,
    disable_session_recording: true,
    disable_surveys: true,
    disable_web_experiments: true,
    // Nothing fetched from `/ingest/static/*`: recorder, surveys and the
    // exception autocapture bundle stay out of the guest page entirely.
    disable_external_dependency_loading: true,
    autocapture: false,
    capture_heatmaps: false,
    capture_dead_clicks: false,
    capture_exceptions: false,
    // App Router navigations go through the History API; this is how PostHog
    // sees them without a router hook of our own.
    capture_pageview: 'history_change' as const,
    capture_pageleave: false,
    // No feature flags yet, so no `/flags` request on every page load. Flip
    // this when the first flag exists.
    advanced_disable_flags: true,
    sanitize_properties: sanitizeProperties,
  }
}

export function __resetTelemetryForTests() {
  client = null
  buffered = []
}
