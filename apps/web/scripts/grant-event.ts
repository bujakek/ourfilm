/**
 * Comp an event: lift its participant cap without a payment.
 *
 *   pnpm grant <event-slug> [--reason early_couple|operator] [--note "…"]
 *   pnpm grant <event-slug> --revoke [--note "…"]
 *   pnpm grant <event-slug> --status
 *
 * This is the Early Couple Program's entitlement step. The pipeline in
 * `early_couple_applications` handles the intake and the two calls; this is
 * what happens after the couple has created their event and you have agreed to
 * comp it.
 *
 * Deliberately a CLI rather than a screen. There is no operator console in the
 * product, the program is founder-led and low-volume, and a grant is exactly
 * the kind of privileged write that should need the service role key rather
 * than a session — `event_grants` has RLS on and no policies at all, so a host
 * cannot grant themselves anything even if they find the endpoint.
 *
 * Runs against whatever .env.local points at. Granting is idempotent; running
 * it twice reports the grant the first run made.
 *
 * On revoking: see the comment on `public.revoke_event_plan`. It is an
 * emergency lever, not a lifecycle step — `event_is_full_plan()` is consulted
 * on every join, so revoking during an event starts turning guests away.
 */

import { createClient } from '@supabase/supabase-js'

import type { Database } from '../lib/supabase/database.types.ts'

const REASONS = ['early_couple', 'operator'] as const
type Reason = (typeof REASONS)[number]

const url = process.env.NEXT_PUBLIC_SUPABASE_URL
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
if (!url || !serviceKey) {
  throw new Error(
    'Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY. ' +
      'Run with: pnpm grant … (which loads .env.local).',
  )
}

const supabase = createClient<Database>(url, serviceKey, {
  auth: { persistSession: false },
})

type Args = {
  slug: string
  reason: Reason
  note: string | null
  mode: 'grant' | 'revoke' | 'status'
}

function usage(message: string): never {
  console.error(`${message}

  pnpm grant <event-slug> [--reason early_couple|operator] [--note "…"]
  pnpm grant <event-slug> --revoke [--note "…"]
  pnpm grant <event-slug> --status`)
  process.exit(1)
}

function parseArgs(argv: string[]): Args {
  const [slug, ...rest] = argv
  if (!slug || slug.startsWith('-')) usage('Missing event slug.')

  let reason: Reason = 'early_couple'
  let note: string | null = null
  let mode: Args['mode'] = 'grant'

  for (let i = 0; i < rest.length; i++) {
    const flag = rest[i]
    switch (flag) {
      case '--revoke':
        mode = 'revoke'
        break
      case '--status':
        mode = 'status'
        break
      case '--reason': {
        const value = rest[++i]
        if (!REASONS.includes(value as Reason)) {
          usage(`--reason must be one of: ${REASONS.join(', ')}`)
        }
        reason = value as Reason
        break
      }
      case '--note': {
        const value = rest[++i]
        if (!value) usage('--note needs a value.')
        note = value
        break
      }
      default:
        usage(`Unknown argument: ${flag}`)
    }
  }

  return { slug, reason, note, mode }
}

/** What the host's settings screen will say, read back from the database
 *  rather than assumed — the whole point is to confirm the write landed. */
async function readState(slug: string) {
  const { data: event, error } = await supabase
    .from('events')
    .select('id, event_name, slug, locale')
    .eq('slug', slug)
    .maybeSingle()
  if (error) throw error
  if (!event) throw new Error(`No event with slug "${slug}".`)

  const { data: quota, error: quotaError } = await supabase
    .rpc('event_participant_quota', { p_event_id: event.id })
    .maybeSingle()
  if (quotaError) throw quotaError

  return { event, quota }
}

function report(
  event: { event_name: string; slug: string },
  quota: {
    participant_count: number
    participant_limit: number
    unlimited: boolean
    plan_source: string | null
  } | null,
) {
  console.log(`  ${event.event_name}  (${event.slug})`)
  if (!quota) {
    console.log('  quota: unavailable')
    return
  }
  console.log(
    `  participants: ${quota.participant_count}` +
      (quota.unlimited ? ' (uncapped)' : ` / ${quota.participant_limit}`),
  )
  console.log(`  plan source:  ${quota.plan_source ?? 'free'}`)
}

async function main() {
  const args = parseArgs(process.argv.slice(2))

  if (args.mode === 'status') {
    const { event, quota } = await readState(args.slug)
    report(event, quota)
    return
  }

  if (args.mode === 'revoke') {
    const { data, error } = await supabase.rpc('revoke_event_plan', {
      p_event_slug: args.slug,
      // The generated Args type spells an optional SQL default as `?: string`,
      // never `| null`, so an absent note is `undefined` rather than null.
      p_note: args.note ?? undefined,
    })
    if (error) throw error
    console.log(data ? 'Grant revoked.' : 'No active grant to revoke.')
    const after = await readState(args.slug)
    report(after.event, after.quota)
    return
  }

  const { data, error } = await supabase
    .rpc('grant_event_plan', {
      p_event_slug: args.slug,
      p_reason: args.reason,
      p_note: args.note ?? undefined,
    })
    .maybeSingle()
  if (error) throw error

  console.log(
    data?.already_active
      ? `Already granted (${args.reason}) — nothing changed.`
      : `Granted: ${args.reason}.`,
  )
  const after = await readState(args.slug)
  report(after.event, after.quota)
}

main().catch((e: unknown) => {
  // Supabase rejects with a plain `PostgrestError`, not an `Error`, so an
  // `instanceof` check alone prints `[object Object]` at the one moment the
  // operator needs to read what went wrong.
  const message =
    e instanceof Error
      ? e.message
      : typeof e === 'object' && e !== null && 'message' in e
        ? String((e as { message: unknown }).message)
        : String(e)
  console.error(message)
  process.exit(1)
})
