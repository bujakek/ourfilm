import 'client-only'

/**
 * Small, privacy-bounded product health telemetry.
 *
 * PostHog answers whether the QR, camera and upload path worked. Raw console
 * output, user input, photo bytes and complete URLs do not belong there.
 */

export const POSTHOG_INGEST_PATH = '/ingest'
export const POSTHOG_UI_HOST = 'https://eu.posthog.com'

type CameraState = 'open' | 'closed'
type UploadIssueStage = 'prepare' | 'reserve' | 'upload' | 'commit'
type StoreStage =
  'missing' | 'open' | 'open_timeout' | 'blocked' | 'put' | 'list' | 'remove'

export type TelemetryEventProperties = {
  guest_page_viewed: {
    event_id: string
    joined: boolean
    camera: CameraState
    gallery?: 'open' | 'locked'
    frames?: number
    shots_remaining?: number
    /** How big the developed album is, where one is on screen. `frames` is
     *  this guest's own strip and is a different number. */
    photos?: number
  }
  guest_join_refused: { event_id: string; reason: string }
  camera_opened: {
    event_id: string
    shots_remaining: number
    outstanding: number
  }
  shutter_pressed: {
    event_id: string
    capture_id: string
    shots_remaining: number
    outstanding: number
    away_ms: number | null
    input_bytes: number
    heic: boolean
  }
  capture_preparation_slow: {
    event_id: string
    capture_id: string
    ms: number
    heic: boolean
    input_bytes: number
    bytes: number
    width: number
    height: number
  }
  upload_confirmed: {
    event_id: string
    capture_id: string
    shots_remaining: number
    elapsed_ms: number | null
  }
  upload_issue: {
    event_id: string
    capture_id: string
    stage: UploadIssueStage
    failure: string
    attempts: number
    terminal: boolean
  }
  upload_restored: {
    event_id: string
    capture_id: string
    age_ms: number
  }
  upload_discarded: {
    event_id: string
    capture_id: string
    reason: 'expired' | 'exhausted' | 'empty'
    age_ms: number
  }
  upload_store_unavailable: {
    event_id: string | null
    stage: StoreStage
    error: string
  }
  client_error: {
    boundary: 'page' | 'root'
    error_name: string
    digest: string | null
    route: string | null
    stack: string | null
  }

  // The host's side. Cookieless persistence means there is no person to join
  // a funnel on, so each of these carries the correlation key its own funnel
  // is keyed by: `creation_key` for the four onboarding screens (the draft's
  // own random uuid, minted before any row exists) and `event_id` afterwards.
  //
  // Everything here is best effort in a way the guest events are not: PostHog
  // loads on idle, and a screen that navigates immediately — to Stripe, to a
  // fresh event — can leave before the buffer flushes. Every outcome that has
  // to be counted exactly is reported by the server instead.

  /** One of the four questions answered. The denominator for the next. */
  onboarding_step_completed: {
    creation_key: string
    step: OnboardingStep
    index: number
  }
  /** Free or unlimited, at the one moment a host is thinking about how many
   *  people are coming. `payments_enabled` is false where the paid tile reads
   *  "Hamarosan" rather than a price. */
  onboarding_plan_chosen: {
    creation_key: string
    plan: string
    payments_enabled: boolean
  }
  /** The last screen's CTA, and what came back. `auth_required` is the
   *  ordinary path — the account is asked for here — not a failure. */
  onboarding_create_attempted: {
    creation_key: string
    plan: string
    outcome: 'created' | 'auth_required' | 'stale_end' | 'error'
    source: 'flow' | 'magic_link'
  }
  draft_restored: { creation_key: string; step: number; age_ms: number | null }
  draft_discarded: { creation_key: string; step: number }
  /**
   * A magic link came back to a browser with no draft in it.
   *
   * The create flow's one unrecoverable failure: the answers live in the
   * `localStorage` of the browser that gave them, so a host who fills the form
   * on a phone and opens the mail on a laptop loses the event entirely. It
   * looks like an ordinary "not found" screen and has never been counted.
   */
  draft_missing_on_complete: { reason: 'no_draft' | 'not_pending' }

  /** The album link left the device — or failed to. Nothing reaches a guest
   *  before this happens, so a zero-participant event starts here. */
  invite_shared: {
    event_id: string
    surface: 'guest' | 'host'
    method: 'share_sheet' | 'clipboard' | 'unavailable'
  }
  /** The free cap, seen by the person who can act on it. */
  quota_banner_viewed: {
    event_id: string
    participant_count: number
    participant_limit: number
    full: boolean
  }
  quota_upgrade_clicked: { event_id: string; full: boolean }
  photo_moderated: { event_id: string; hidden: boolean }
  /** The Album button. The server reports what the stream then did. */
  album_export_requested: { event_id: string; photo_count: number }
  /** Somebody is looking at the developed album — the payoff of the whole
   *  format, and until now unmeasured. */
  gallery_photo_opened: { event_id: string; index: number; photos: number }
  /** A render would not load. Signed URLs expire after an hour, so a tab left
   *  open and scrolled later is the expected cause. */
  gallery_image_failed: { event_id: string; surface: 'grid' | 'lightbox' }
  /** The guest-to-host loop, and the only growth mechanism in the product. */
  create_own_album_clicked: { event_id: string | null }
}

/** The four questions, in the order they are asked. */
export type OnboardingStep = 'name' | 'end' | 'reveal' | 'guests'

export type TelemetryEvent = keyof TelemetryEventProperties
export type TelemetryProperties = Record<
  string,
  string | number | boolean | null | undefined
>

/** The one PostHog method needed by this module. */
export type TelemetryClient = {
  capture(
    event: string,
    properties?: Record<string, unknown>,
    options?: { send_instantly?: boolean },
  ): unknown
}

type BufferedEvent = {
  event: TelemetryEvent
  properties: TelemetryProperties
  urgent: boolean
}

/** A page without a configured or loadable client must stay bounded. */
const MAX_BUFFERED = 50

let client: TelemetryClient | null = null
let buffered: BufferedEvent[] = []

export function telemetryKey(): string | null {
  // Referenced literally: Next inlines `NEXT_PUBLIC_*` only when the whole
  // expression is spelled out.
  return process.env.NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN || null
}

export function telemetryEnvironment(): string {
  return (
    process.env.NEXT_PUBLIC_OURFILM_ENV || process.env.NODE_ENV || 'unknown'
  )
}

function send(next: TelemetryClient, entry: BufferedEvent) {
  if (entry.urgent) {
    next.capture(entry.event, entry.properties, { send_instantly: true })
  } else {
    next.capture(entry.event, entry.properties)
  }
}

/**
 * Routine funnel events use PostHog's batching. Only rare failures that may be
 * followed by a tab closing are sent immediately.
 */
export function track<Event extends TelemetryEvent>(
  event: Event,
  properties: TelemetryEventProperties[Event],
  options: { urgent?: boolean } = {},
) {
  const entry: BufferedEvent = {
    event,
    properties: {
      ...properties,
      environment: telemetryEnvironment(),
      online: typeof navigator === 'undefined' ? null : navigator.onLine,
      visible:
        typeof document === 'undefined'
          ? null
          : document.visibilityState === 'visible',
    },
    urgent: options.urgent === true,
  }

  if (client) {
    send(client, entry)
    return
  }
  if (buffered.length >= MAX_BUFFERED) return
  buffered.push(entry)
}

/** Hand over the loaded client and flush events captured during idle loading. */
export function attachTelemetry(next: TelemetryClient) {
  client = next
  const pending = buffered
  buffered = []
  for (const entry of pending) send(next, entry)
}

export function telemetryIsAttached() {
  return client !== null
}

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

const URL_PROPERTIES = new Set([
  '$current_url',
  '$pathname',
  '$referrer',
  '$initial_current_url',
  '$initial_pathname',
  '$initial_referrer',
  'current_url',
  'pathname',
  'referrer',
  'url',
])

/** Complete query strings are unnecessary and can contain magic-link tokens. */
export function stripQueryAndHash(value: string): string {
  const query = value.indexOf('?')
  const hash = value.indexOf('#')
  const cuts = [query, hash].filter((index) => index >= 0)
  return cuts.length === 0 ? value : value.slice(0, Math.min(...cuts))
}

function sanitizeString(key: string, value: string): string {
  const masked = maskSlugs(value)
  return URL_PROPERTIES.has(key) ? stripQueryAndHash(masked) : masked
}

/**
 * Sanitize every event property, including PostHog's nested initial-property
 * objects. URL-like properties lose their entire query and fragment.
 */
export function sanitizeProperties<T extends Record<string, unknown>>(
  properties: T,
): T {
  const out: Record<string, unknown> = { ...properties }
  for (const [key, value] of Object.entries(out)) {
    if (typeof value === 'string') out[key] = sanitizeString(key, value)
    else if (value && typeof value === 'object' && !Array.isArray(value)) {
      out[key] = sanitizeProperties(value as Record<string, unknown>)
    }
  }
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

type BeforeSendEvent = {
  event: string
  properties?: Record<string, unknown>
}

/** `sanitize_properties` is deprecated in posthog-js; sanitize whole events. */
export function sanitizeEvent<Event extends BeforeSendEvent>(
  event: Event | null,
): Event | null {
  if (!event?.properties) return event
  return {
    ...event,
    properties: sanitizeProperties(event.properties),
  }
}

function safeErrorName(error: Error): string {
  const value = error.name.slice(0, 80)
  return /^(?:Error|[a-zA-Z][a-zA-Z0-9_.:-]*(?:Error|Exception))$/.test(value)
    ? value
    : 'UnknownError'
}

function safeDiagnosticToken(value: string, maxLength: number): string | null {
  const safe = value.replace(/[^a-zA-Z0-9_.:-]/g, '_').slice(0, maxLength)
  return safe || null
}

/** Preserve code locations but redact the error message and URL queries. */
export function safeErrorStack(error: Error): string | null {
  if (!error.stack) return null
  const safeLines = error.stack
    .split('\n')
    .slice(1)
    // Chrome/Firefox use `at …`; Safari uses `function@url`. Discard any
    // continuation text so a multi-line error message cannot hitch a ride.
    .filter((line) => /^\s*at\s/.test(line) || /@(?:https?:\/\/|\/)/.test(line))
    .slice(0, 20)
    .map((line) =>
      line.replace(/https?:\/\/[^\s)]+/g, (url) =>
        stripQueryAndHash(maskSlugs(url)),
      ),
    )
  return [`${safeErrorName(error)}: [redacted]`, ...safeLines]
    .join('\n')
    .slice(0, 8_000)
}

export function trackClientError(
  error: Error & { digest?: string },
  boundary: 'page' | 'root',
) {
  track(
    'client_error',
    {
      boundary,
      error_name: safeErrorName(error),
      digest: error.digest ? safeDiagnosticToken(error.digest, 160) : null,
      route:
        typeof window === 'undefined'
          ? null
          : maskSlugs(window.location.pathname),
      stack: safeErrorStack(error),
    },
    { urgent: true },
  )
}

/** The deliberately narrow PostHog browser configuration. */
export function telemetryConfig() {
  return {
    api_host: POSTHOG_INGEST_PATH,
    ui_host: POSTHOG_UI_HOST,
    cookieless_mode: 'always' as const,
    persistence: 'memory' as const,
    person_profiles: 'never' as const,
    disable_session_recording: true,
    disable_surveys: true,
    disable_web_experiments: true,
    disable_external_dependency_loading: true,
    autocapture: false,
    capture_heatmaps: false,
    capture_dead_clicks: false,
    capture_exceptions: false,
    capture_performance: false,
    capture_pageview: false,
    capture_pageleave: false,
    disable_capture_url_hashes: true,
    save_campaign_params: false,
    save_referrer: false,
    advanced_disable_flags: true,
    logs: { captureConsoleLogs: false },
    before_send: sanitizeEvent,
  }
}

export function __resetTelemetryForTests() {
  client = null
  buffered = []
}
