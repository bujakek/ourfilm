/**
 * Wipe every event and everything hanging off one, keeping the accounts.
 *
 *   pnpm reset:data                                  # dry run — counts only
 *   pnpm reset:data --yes --project <supabase-ref>   # actually deletes
 *
 * This is a *data* wipe, not a schema reset: no migration is written, no
 * policy, function or bucket is touched, and `pnpm supabase migration list`
 * reads the same afterwards. What goes is the content.
 *
 * `auth.users` and `public.profiles` are never touched. Everyone keeps their
 * login, their magic-link identity and their role — they just come back to an
 * empty `/host`. That is the whole point of the script existing rather than a
 * `supabase db reset`, which would take the accounts with it.
 *
 * Storage is deleted explicitly, and has to be. `delete from events` cascades
 * through `photos`, but Postgres knows nothing about the objects in the
 * `event-photos` bucket — dropping the rows without emptying the bucket leaves
 * every master, view and thumb sitting there costing money with nothing left
 * that can name them. So the bucket is emptied first, while the folders are
 * still explainable, and the rows go second.
 *
 * Runs against whatever `.env.local` points at, with the service role key,
 * because `events` is RLS-scoped to its owner and this deletes everyone's.
 *
 * The `--project` interlock is not ceremony. This repo has exactly one
 * Supabase project and it is the one production runs on; a wipe that only
 * needed `--yes` is one shell-history arrow-up away from being a very bad
 * afternoon. Take a dump first if the data is worth anything:
 *
 *   pnpm supabase db dump --linked --data-only -f backup.sql
 */

import { createClient } from '@supabase/supabase-js'

import type { Database } from '../lib/supabase/database.types.ts'

const url = process.env.NEXT_PUBLIC_SUPABASE_URL
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
if (!url || !serviceKey) {
  throw new Error(
    'Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY. ' +
      'Run with: pnpm reset:data … (which loads .env.local).',
  )
}

const supabase = createClient<Database>(url, serviceKey, {
  auth: { persistSession: false },
})

const PHOTO_BUCKET = 'event-photos'

/** `https://<ref>.supabase.co` — the ref is what `--project` must echo. */
const projectRef = new URL(url).hostname.split('.')[0]

/**
 * Deleted directly. Everything else in the schema either cascades from
 * `events` (`photos`, `participants`, `purchases`, `event_grants`,
 * `stripe_checkout_attempts`) or is deliberately kept (`profiles`).
 */
const WIPED = [
  // Stripe's idempotency ledger. All test-mode, and Stripe does not resend
  // events this old, so there is nothing left for it to protect.
  { table: 'stripe_webhook_events', key: 'id' },
  // Founder-led intake. Survives the cascade with `event_id` nulled, so it has
  // to be named or it would quietly outlive the wipe.
  { table: 'early_couple_applications', key: 'id' },
  // Cascades into photos, participants, purchases, event_grants and
  // stripe_checkout_attempts. One statement, five tables.
  { table: 'events', key: 'id' },
  // Fixed-window counters. Keyed by request shape, not by event, so nothing
  // cascades them away.
  { table: 'rate_limits', key: 'key' },
] as const

/** Read alongside the wipe list so the report can prove they survived. */
const KEPT = ['profiles'] as const

type Counts = Record<string, number | null>

async function countRows(tables: readonly string[]): Promise<Counts> {
  const counts: Counts = {}
  for (const table of tables) {
    const { count, error } = await supabase
      // The table list is a const tuple of real table names; the generated
      // client cannot narrow a loop variable back to that union.
      .from(table as 'events')
      .select('*', { count: 'exact', head: true })
    if (error) throw error
    counts[table] = count
  }
  return counts
}

async function countUsers(): Promise<number> {
  let total = 0
  for (let page = 1; ; page++) {
    const { data, error } = await supabase.auth.admin.listUsers({
      page,
      perPage: 200,
    })
    if (error) throw error
    total += data.users.length
    if (data.users.length < 200) return total
  }
}

/**
 * Every object in the bucket, one event folder at a time.
 *
 * The layout is flat — `{event_id}/{photo_id}.jpg` and its `_thumb`/`_view`
 * siblings, plus `cover.jpg` — so one level of listing is the whole tree. The
 * root listing is what drives it rather than the `photos` table, which means a
 * folder orphaned by an earlier failed run gets swept too.
 */
async function listPhotoObjects(): Promise<string[]> {
  const paths: string[] = []

  const { data: folders, error: rootError } = await supabase.storage
    .from(PHOTO_BUCKET)
    .list('', { limit: 1000 })
  if (rootError) throw rootError

  for (const folder of folders ?? []) {
    // A real object at the root has metadata; a folder is a synthetic entry
    // with none. Only folders are worth descending into.
    if (folder.id !== null) {
      paths.push(folder.name)
      continue
    }
    for (let offset = 0; ; offset += 1000) {
      const { data: files, error } = await supabase.storage
        .from(PHOTO_BUCKET)
        .list(folder.name, { limit: 1000, offset })
      if (error) throw error
      for (const file of files ?? []) paths.push(`${folder.name}/${file.name}`)
      if (!files || files.length < 1000) break
    }
  }

  return paths
}

async function removeObjects(paths: string[]) {
  // `remove()` takes a list; batched because a few thousand paths in one
  // request is a payload nobody needs to find the limit of.
  const BATCH = 200
  for (let i = 0; i < paths.length; i += BATCH) {
    const batch = paths.slice(i, i + BATCH)
    const { error } = await supabase.storage.from(PHOTO_BUCKET).remove(batch)
    if (error) throw error
    console.log(
      `  removed ${Math.min(i + BATCH, paths.length)}/${paths.length}`,
    )
  }
}

function printCounts(label: string, counts: Counts, users: number) {
  console.log(`\n${label}`)
  for (const [table, count] of Object.entries(counts)) {
    const kept = (KEPT as readonly string[]).includes(table)
    console.log(
      `  ${table.padEnd(28)} ${String(count ?? '?').padStart(5)}${kept ? '   (kept)' : ''}`,
    )
  }
  console.log(
    `  ${'auth.users'.padEnd(28)} ${String(users).padStart(5)}   (kept)`,
  )
}

async function main() {
  const argv = process.argv.slice(2)
  let confirmed = false
  let claimedProject: string | null = null

  for (let i = 0; i < argv.length; i++) {
    switch (argv[i]) {
      case '--yes':
        confirmed = true
        break
      case '--project':
        claimedProject = argv[++i] ?? null
        break
      default:
        console.error(`Unknown argument: ${argv[i]}

  pnpm reset:data                                # dry run
  pnpm reset:data --yes --project ${projectRef}`)
        process.exit(1)
    }
  }

  // Every table that appears in the report, wiped and kept together, so the
  // before/after pair is directly comparable.
  const reported = [...WIPED.map((w) => w.table), ...KEPT]

  const before = await countRows(reported)
  const users = await countUsers()
  const objects = await listPhotoObjects()

  console.log(`Supabase project: ${projectRef}  (${url})`)
  printCounts('Before:', before, users)
  console.log(
    `  ${`storage ${PHOTO_BUCKET}`.padEnd(28)} ${String(objects.length).padStart(5)} objects`,
  )

  if (!confirmed || claimedProject !== projectRef) {
    console.log(
      confirmed && claimedProject !== projectRef
        ? `\nRefusing: --project ${claimedProject ?? '(missing)'} does not match ${projectRef}.`
        : '\nDry run. Nothing was deleted.',
    )
    console.log(`\nTo delete all of the above except the kept rows:

  pnpm supabase db dump --linked --data-only -f backup.sql   # optional, first
  pnpm reset:data --yes --project ${projectRef}`)
    process.exit(confirmed ? 1 : 0)
  }

  console.log(`\nDeleting ${objects.length} storage objects…`)
  await removeObjects(objects)

  for (const { table, key } of WIPED) {
    const { error } = await supabase
      .from(table as 'events')
      // PostgREST refuses an unfiltered delete. "Primary key is not null" is
      // every row, spelled in a way it accepts.
      .delete()
      .not(key, 'is', null)
    if (error) throw error
    console.log(`deleted all rows from ${table}`)
  }

  const after = await countRows(reported)
  const usersAfter = await countUsers()
  const objectsAfter = await listPhotoObjects()

  printCounts('After:', after, usersAfter)
  console.log(
    `  ${`storage ${PHOTO_BUCKET}`.padEnd(28)} ${String(objectsAfter.length).padStart(5)} objects`,
  )

  const leftovers = WIPED.map((w) => w.table).filter((t) => (after[t] ?? 0) > 0)
  if (leftovers.length > 0 || objectsAfter.length > 0) {
    throw new Error(
      `Not everything went: ${[...leftovers, objectsAfter.length ? 'storage' : ''].filter(Boolean).join(', ')}`,
    )
  }
  if (usersAfter !== users) {
    throw new Error(`Account count changed: ${users} → ${usersAfter}`)
  }
  console.log('\nDone. Accounts and roles untouched.')
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
