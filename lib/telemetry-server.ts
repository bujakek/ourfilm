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

export function safeServerErrorName(error: unknown): string {
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
        event_id:
          context.eventId && UUID.test(context.eventId)
            ? context.eventId
            : null,
        error_name: safeServerErrorName(error),
        route: safeServerRoute(context.route),
        route_type: context.routeType ? safeToken(context.routeType, 40) : null,
        method: context.method ? safeToken(context.method, 12) : null,
        digest: context.digest ? safeToken(context.digest, 160) : null,
        environment:
          process.env.VERCEL_ENV || process.env.NODE_ENV || 'unknown',
        $process_person_profile: false,
      },
    })
  } catch (reportingError) {
    // Reporting must never turn an original recoverable failure into another
    // product failure. The server log is the last-resort breadcrumb.
    console.warn('Product health telemetry did not send', reportingError)
  }
}

export function __resetServerTelemetryForTests() {
  client = undefined
}
