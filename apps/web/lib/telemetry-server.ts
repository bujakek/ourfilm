import 'server-only'

import { PostHog } from 'posthog-node'

const POSTHOG_EU_HOST = 'https://eu.i.posthog.com'
const MAX_ERROR_NAME = 80
const MAX_ROUTE = 240

type ServerIssueContext = {
  operation: string
  eventId?: string | null
  route?: string | null
  routeType?: string | null
  method?: string | null
  digest?: string | null
}

/**
 * The server's own product events, and every property each one may carry.
 *
 * A second, deliberately separate list from the browser's in `lib/telemetry.ts`.
 * These are outcomes only the server can see honestly: a payment Stripe
 * confirmed rather than a browser that reached a success URL, an export that
 * finished streaming rather than one a host started, a row that exists.
 *
 * The same rule as everywhere else applies to every property below: no slug,
 * no event name, no guest name, no email address, no Stripe identifier, no
 * error message. `event_id` is a random uuid and is what joins these to the
 * browser funnel; `creation_key` is the draft's own random uuid and joins the
 * onboarding screens to the row they eventually made.
 */
export type ServerEventProperties = {
  /** A host is being sent to Stripe's hosted page. The only place that
   *  distinguishes the two entry points, which Stripe cannot tell apart. */
  checkout_started: {
    event_id: string
    source: 'settings' | 'onboarding'
    currency: 'huf' | 'usd'
    locale: 'en' | 'hu'
  }
  /** A host asked to pay and was refused before Stripe was involved. Every
   *  reason here is a sentence the host read instead of a checkout page. */
  checkout_blocked: {
    event_id: string | null
    source: 'settings' | 'onboarding'
    reason:
      | 'no_slug'
      | 'terms_not_accepted'
      | 'stripe_not_configured'
      | 'billingo_not_configured'
      | 'signed_out'
      | 'not_found'
      | 'already_unlimited'
  }
  /** What Stripe reported, server to server. The only trustworthy end of the
   *  payment funnel — `?checkout=success` proves nothing. */
  checkout_settled: {
    event_id: string | null
    status: 'paid' | 'failed' | 'expired' | 'refunded'
    amount_minor: number | null
    currency: string | null
    /** The event was deleted between paying and Stripe reporting it. */
    event_deleted: boolean
  }
  /**
   * What the host was actually *told* after paying, which is not the same
   * question as what Stripe reported.
   *
   * `checkout_settled` is the truth about the money and cannot see this:
   * a webhook that lands two seconds after the host gave up looks identical
   * to one that landed before they finished reading. `settling` counted
   * against a later `paid` is how long confirmation takes from where the
   * host is standing, and `unconfirmed` is somebody who reached this screen
   * with no payment we could find — a typed URL, or something wrong.
   */
  checkout_confirmation_viewed: {
    event_id: string
    outcome: 'paid' | 'settling' | 'unconfirmed'
    /** Why the event is uncapped, when it is. Null while still settling. */
    plan_source: 'paid' | 'early_couple' | 'operator' | 'admin' | null
  }
  /** A large album was asked for and a job row now exists. Nothing has been
   *  built yet; `album_export_started` is the worker picking it up. */
  album_export_queued: {
    event_id: string
    photo_count: number
    estimated_bytes: number
  }
  /** An archive began: the streaming route started sending, or a worker
   *  claimed the job (`attempt` counts claims; null for the stream). */
  album_export_started: {
    event_id: string
    photo_count: number
    mode: 'stream' | 'worker'
    attempt: number | null
  }
  /**
   * An archive finished — the stream completed, or Storage confirmed the
   * worker's object. `missing_count` is the number this event exists for:
   * those photos are named in a text file inside an archive nobody opens,
   * and were otherwise silent data loss. `hidden_count` is only known on the
   * stream, which built the archive itself.
   */
  album_export_finished: {
    event_id: string
    photo_count: number
    missing_count: number
    hidden_count: number | null
    elapsed_ms: number
    mode: 'stream' | 'worker'
  }
  /** A worker gave up on an attempt. `final` means no retry follows and the
   *  host sees "Nem sikerült"; otherwise the job is queued again. */
  album_export_failed: {
    event_id: string
    code: string
    attempt: number
    final: boolean
  }
  /** Resend accepted the export-ready mail. The gap this pairs with is
   *  `album_export_finished` without this on the same event: a host who does
   *  not know their album is ready. */
  album_export_email_sent: { event_id: string; locale: 'en' | 'hu' }
  album_export_email_failed: { event_id: string; attempts: number }
  /** One run of the sweep endpoint. pg_cron never reads the response, so this
   *  is the only record that the schedule is alive. */
  album_export_sweep: {
    expired: number
    released: number
    failed: number
    objects_removed: number
    orphans_removed: number
    emails_sent: number
    emails_failed: number
  }
  /** The row exists. The end of a funnel that starts four screens and one
   *  magic link earlier. */
  event_created: {
    event_id: string
    creation_key: string | null
    locale: 'en' | 'hu'
    plan: string
    shots: number
    reveal_mode: string
    guests_can_view: boolean
    /** How long the camera is open for, as the host set it up. */
    window_hours: number
    /** The idempotency key found an event a previous attempt had made. */
    repeat: boolean
  }
  /** The one destructive path in the product, and the strongest negative
   *  signal it can emit. */
  event_deleted: {
    event_id: string
    object_count: number
    age_hours: number
  }
  /**
   * A frame reserved after `capture_end_at`, which only the upload grace
   * (`shot_upload_grace()`, 24 h, the client's `MAX_AGE_MS`) allows. How late
   * these arrive is the evidence for that number: minutes would argue for a
   * tighter close, the next morning for keeping it.
   *
   * `claimed_lead_seconds` is how long before the close the device says its
   * camera was opened. Device-supplied, so its tail is where clock skew or a
   * forged claim shows. A replay of an existing reservation is not counted.
   * `capture_id` is the reservation's own idempotency key.
   */
  shot_reserved_in_grace: {
    event_id: string
    capture_id: string
    surface: 'guest' | 'host'
    late_seconds: number
    claimed_lead_seconds: number | null
  }
  /** A host changed a running camera. One event with a `setting` rather than
   *  five, so "what do hosts adjust" is one breakdown. */
  /** A host destroyed one guest's frame. `hidden_before` says whether they
   *  delete straight from the album or clean up what they had already hidden,
   *  which is the number that says whether putting delete behind the full-size
   *  view worked. Never a photo id, a participant id or a name. */
  photo_deleted: { event_id: string; hidden_before: boolean }
  event_setting_changed: {
    event_id: string
    setting: 'name' | 'capture_end' | 'reveal' | 'shots' | 'guests_can_view'
    reveal_mode: string | null
    shots: number | null
    guests_can_view: boolean | null
    /** For `capture_end` only: how far it moved, signed. Negative closes the
     *  camera early, which is the supported way to end a party. */
    moved_minutes: number | null
  }
  /** The auth mail was accepted by Resend. Reported alongside the existing
   *  failure so "is the Hungarian branch of the hook rendering" has a
   *  positive answer as well as a negative one. */
  auth_email_sent: { locale: 'en' | 'hu'; action: string }
  /** A Hungarian invoice exists in Billingo and was emailed to the buyer.
   *  Never the invoice number, the partner id or the buyer's address — those
   *  are in `purchases`, which is where an auditor should be looking anyway. */
  invoice_issued: {
    event_id: string | null
    attempts: number
    /** The webhook's own first try, or the sweep coming back for it. */
    source: 'webhook' | 'sweep'
  }
  /** ...or did not. `blocked` is the Billingo document quota, which no retry
   *  inside the hour can fix; the absence of a matching `invoice_issued` for a
   *  `checkout_settled` with status `paid` is the alert that matters. */
  invoice_failed: {
    event_id: string | null
    attempts: number
    source: 'webhook' | 'sweep'
    status: 'failed' | 'send_failed' | 'blocked'
    error: string
  }
  /** A refunded purchase's invoice was cancelled with a storno document. */
  invoice_cancelled: { event_id: string | null; source: 'webhook' | 'sweep' }
  /** One run of the invoice sweep. Same contract as `album_export_sweep`:
   *  pg_cron never reads the response, so no run for an hour is the alert. */
  invoice_sweep: {
    considered: number
    issued: number
    cancelled: number
    failed: number
  }

  // The stretch between the three renders landing and the row going `ready`.
  // Both ends of it used to be silent on the server: a commit that arrived
  // with no cookie answered `committed: false` and reported nothing, and one
  // that threw reported a `server_error` with no event and no photo on it.
  // See `lib/commit-observed.ts` and `docs/upload-commit-observability.md`.

  /**
   * A commit request reached the function. Sent before anything is checked,
   * so an invocation that later hangs or dies still left this behind.
   *
   * Every identifier here is the *browser's claim*: nothing has been read yet.
   * `photo_ref` is the hash of the id the browser sent (`lib/photo-ref.ts`).
   */
  commit_shot_received: {
    surface: 'guest' | 'host'
    photo_ref: string | null
    claimed_capture_id: string | null
    attempt_id: string | null
  }
  /**
   * …and what became of it. `outcome` is what the caller was told; `row` and
   * `status_after` are read back from `photos` after the commit, so a refusal
   * or an exception still says whether the row exists, whose it is and
   * whether it went `ready` regardless.
   *
   * `event_id` and `capture_id` come from that row (`idempotency_key` is the
   * capture id), or for a host from the event their session owns — never
   * from the request. `claimed_capture_id` is the request's, and
   * `capture_id_matches` is whether the two agree.
   */
  commit_shot_finished: {
    surface: 'guest' | 'host'
    event_id: string | null
    capture_id: string | null
    claimed_capture_id: string | null
    capture_id_matches: boolean | null
    attempt_id: string | null
    photo_ref: string | null
    outcome: 'committed' | 'refused' | 'error'
    /** Refusals: `no_session`, `not_owner`, `no_participant`, `not_matched`,
     *  `empty_response`. Errors: the stage that threw. */
    reason: string | null
    error_name: string | null
    duration_ms: number
    /** `owned` — the row is the caller's; `foreign` — it exists but the
     *  caller's credential does not match it (or there was none); `missing`
     *  — no such photo; `unknown` — the read-back itself failed. */
    row: 'owned' | 'foreign' | 'missing' | 'unknown'
    status_after: string | null
  }
}

export type ServerEvent = keyof ServerEventProperties

type ServerEventValue = string | number | boolean | null | undefined

let client: PostHog | null | undefined
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

function projectToken(): string | null {
  return process.env.NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN || null
}

function posthog(): PostHog | null {
  if (client !== undefined) return client
  const token = projectToken()
  client = token
    ? new PostHog(token, {
        host: POSTHOG_EU_HOST,
        flushAt: 1,
        flushInterval: 0,
        disableGeoip: true,
      })
    : null
  return client
}

function safeToken(value: string, maxLength: number): string {
  return value.replace(/[^a-zA-Z0-9_.:/[\]-]/g, '_').slice(0, maxLength)
}

/**
 * A uuid, or nothing.
 *
 * Every identifier these reports carry is one the database generated at
 * random. Checking the shape is what keeps a slug, a name or an email from
 * reaching PostHog through a field that was only ever meant to hold a uuid.
 */
function safeUuid(value: string | null | undefined): string | null {
  return value && UUID.test(value) ? value : null
}

function environment(): string {
  return process.env.VERCEL_ENV || process.env.NODE_ENV || 'unknown'
}

/** Route templates are useful; concrete slugs and query credentials are not. */
export function safeServerRoute(
  route: string | null | undefined,
): string | null {
  if (!route) return null
  const withoutQuery = route.split(/[?#]/, 1)[0]
  return safeToken(
    withoutQuery
      .replace(/(\/e\/)[^/\s]+/g, '$1[slug]')
      .replace(/(\/host\/events\/)(?!new(?:\/|$))[^/\s]+/g, '$1[slug]'),
    MAX_ROUTE,
  )
}

/**
 * A PostgREST refusal, which supabase-js hands back as a plain object with no
 * `name` unless `throwOnError` is on. Its `code` is a fixed Postgres or
 * PostgREST identifier — `23503`, `PGRST204` — never user data, and it is the
 * whole difference between "the database said no" and knowing why. Without it
 * four days of a foreign-key violation read as `UnknownError`.
 */
const POSTGREST_CODE = /^[A-Z0-9]{1,10}$/i

function postgrestCode(error: unknown): string | null {
  if (typeof error !== 'object' || error === null) return null
  if (!('code' in error) || typeof error.code !== 'string') return null
  if (!('message' in error) || typeof error.message !== 'string') return null
  const isPostgrestInstance =
    error instanceof Error && error.name === 'PostgrestError'
  const isPlainRefusal = !(error instanceof Error) && 'details' in error
  if (!isPostgrestInstance && !isPlainRefusal) return null
  return POSTGREST_CODE.test(error.code) ? error.code : ''
}

export function safeServerErrorName(error: unknown): string {
  const code = postgrestCode(error)
  if (code !== null) return code ? `PostgrestError:${code}` : 'PostgrestError'

  const name =
    error instanceof Error
      ? error.name
      : typeof error === 'object' &&
          error !== null &&
          'name' in error &&
          typeof error.name === 'string'
        ? error.name
        : 'UnknownError'
  const bounded = name.slice(0, MAX_ERROR_NAME)
  return /^(?:Error|[a-zA-Z][a-zA-Z0-9_.:-]*(?:Error|Exception))$/.test(bounded)
    ? bounded
    : 'UnknownError'
}

/**
 * Report a bounded server failure. Error messages, stacks, headers, bodies,
 * email addresses and concrete request URLs deliberately never enter this API.
 */
export async function reportServerIssue(
  error: unknown,
  context: ServerIssueContext,
): Promise<void> {
  const next = posthog()
  if (!next) return

  try {
    await next.captureImmediate({
      event: 'server_error',
      disableGeoip: true,
      properties: {
        operation: safeToken(context.operation, 80),
        event_id: safeUuid(context.eventId),
        error_name: safeServerErrorName(error),
        route: safeServerRoute(context.route),
        route_type: context.routeType ? safeToken(context.routeType, 40) : null,
        method: context.method ? safeToken(context.method, 12) : null,
        digest: context.digest ? safeToken(context.digest, 160) : null,
        environment: environment(),
        $process_person_profile: false,
      },
    })
  } catch (reportingError) {
    // Reporting must never turn an original recoverable failure into another
    // product failure. The server log is the last-resort breadcrumb.
    console.warn('Product health telemetry did not send', reportingError)
  }
}

/**
 * Bound one property of a server event.
 *
 * Exported for the test that pins it. A number has to be finite — `NaN` and
 * `Infinity` serialise to `null` anyway and are always a computation that went
 * wrong upstream — and a string is reduced to a token, so a value that reached
 * one of these fields by mistake cannot arrive as prose.
 */
export function safeServerValue(
  key: string,
  value: ServerEventValue,
): string | number | boolean | null {
  if (value === undefined || value === null) return null
  if (typeof value === 'boolean') return value
  if (typeof value === 'number') return Number.isFinite(value) ? value : null
  if (key.endsWith('_id') || key.endsWith('_key')) return safeUuid(value)
  // A SHA-256 in hex (`lib/photo-ref.ts`), or nothing. Checked as strictly as
  // an id, because the thing it stands in for is one.
  if (key.endsWith('_ref')) return SHA256_HEX.test(value) ? value : null
  return safeToken(value, 80)
}

const SHA256_HEX = /^[0-9a-f]{64}$/

/**
 * Report one bounded server product event.
 *
 * The sibling of `reportServerIssue`, and the same promise: only the typed
 * properties above are sent, each one reduced to a scalar a human name cannot
 * survive. It exists because the payment funnel, the export and the create
 * flow all have outcomes the browser either cannot see or is about to navigate
 * away from — a redirect to Stripe, a stream that ends after the response, a
 * `window.location.replace` a buffered client-side event does not outlive.
 *
 * `captureImmediate` rather than the queue, for the reason the queue exists to
 * avoid on a long-lived server and cannot help with here: a serverless
 * function is frozen the moment it answers, taking any unflushed batch with
 * it. Every caller already awaits something.
 */
export async function reportServerEvent<Event extends ServerEvent>(
  event: Event,
  properties: ServerEventProperties[Event],
): Promise<void> {
  const next = posthog()
  if (!next) return

  const safe: Record<string, string | number | boolean | null> = {}
  for (const [key, value] of Object.entries(properties)) {
    safe[key] = safeServerValue(key, value as ServerEventValue)
  }

  try {
    await next.captureImmediate({
      event,
      disableGeoip: true,
      properties: {
        ...safe,
        environment: environment(),
        $process_person_profile: false,
      },
    })
  } catch (reportingError) {
    // Same rule as `reportServerIssue`: telemetry never turns a working
    // request into a failed one.
    console.warn('Product health telemetry did not send', reportingError)
  }
}

export function __resetServerTelemetryForTests() {
  client = undefined
}
