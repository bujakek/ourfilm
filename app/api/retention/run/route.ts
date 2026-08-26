import { NextResponse, type NextRequest } from 'next/server'

import { runRetention } from '@/lib/legal/retention-run'

/**
 * The retention rule's trigger. Nothing calls it on its own.
 *
 * Under `/api/` for the same reason as the Stripe webhook: no human navigates
 * here, and the URL gets pasted into a scheduler's configuration. It sits
 * outside `proxy.ts`'s `/host/:path*` matcher, so the shared secret below is
 * the entire authorization — there is no session to fall back on.
 *
 * **A missing `RETENTION_CRON_SECRET` refuses every request.** Not "runs
 * unauthenticated in development": an endpoint that permanently deletes
 * albums must fail closed, and a developer who wants to run it can set the
 * variable.
 *
 * POST only. A GET that deletes data is one a link prefetcher can fire.
 */
export const dynamic = 'force-dynamic'
export const maxDuration = 60

export async function POST(request: NextRequest) {
  const secret = process.env.RETENTION_CRON_SECRET
  if (!secret) {
    return NextResponse.json(
      { error: 'RETENTION_CRON_SECRET is not configured' },
      { status: 503 },
    )
  }

  // Vercel Cron sends the project's own `CRON_SECRET` in this header; a manual
  // invocation sends whatever is configured here. Either way it is a bearer
  // token compared in full.
  const provided = request.headers.get('authorization')
  if (provided !== `Bearer ${secret}`) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }

  try {
    const result = await runRetention()
    // The slugs of what was warned and deleted, and nothing about the people
    // involved: no email addresses, no host names, no photo paths. This body
    // ends up in a scheduler's log.
    return NextResponse.json(result)
  } catch (e) {
    console.error('Retention run failed', e)
    return NextResponse.json({ error: 'retention run failed' }, { status: 500 })
  }
}
