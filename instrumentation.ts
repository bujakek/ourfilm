import type { Instrumentation } from 'next'

/** Captures failures that escape a page, action, route handler or proxy. */
export const onRequestError: Instrumentation.onRequestError = async (
  error,
  request,
  context,
) => {
  // `posthog-node` is deliberately absent from Edge bundles. Our configured
  // functions use Node; keeping this guard makes a future Edge route safe.
  if (process.env.NEXT_RUNTIME === 'edge') return

  const { reportServerIssue } = await import('@/lib/telemetry-server')
  const digest =
    error instanceof Error && 'digest' in error
      ? String(error.digest ?? '') || null
      : null

  await reportServerIssue(error, {
    operation: 'unhandled_request',
    // Next's matched route template is safe and more useful than the concrete
    // request path. The latter can contain an event slug or auth credential.
    route: context.routePath,
    routeType: context.routeType,
    method: request.method,
    digest,
  })
}
