/**
 * Take a photo down: remove its bytes, keep its row.
 *
 *   pnpm takedown <photo-id>            # remove the three renders, set hidden_at
 *   pnpm takedown <photo-id> --status   # read only: is anything still stored?
 *
 * Why this exists now. The `event-photos` bucket is public, so a photo's URL is
 * a stable address that keeps answering for as long as the object exists —
 * `hidden_at` drops the photo from the app and revokes nothing. Under the
 * private bucket, hiding was effectively removal: no new signature was minted
 * and any existing one died within the hour. That is no longer true, and the
 * published privacy notice and terms promise more than hiding: a person
 * pictured, or a parent about a photo of their child, may ask for the picture
 * to be hidden *or removed* ("elrejtését vagy eltávolítását"). Without this
 * script the only way to honour that would be deleting the couple's entire
 * event. See `docs/public-cdn-and-export-worker.md`, decision D2.
 *
 * The row is never deleted, on purpose. It is the record that a takedown
 * happened and when, and the frame it spent stays spent: `participant_shots_used`
 * counts `hidden_at` rows precisely so that hiding cannot become a way to shoot
 * forever (CLAUDE.md, "Hidden photos do count"). A host-facing permanent
 * delete is a separate decision; this is the operator lever until then.
 *
 * Deliberately a CLI rather than a screen, like `pnpm grant`: there is no
 * operator console, takedowns are rare and answered by a person, and removing
 * objects from a folder the host owns is exactly the kind of privileged write
 * that should need the service role rather than a session.
 *
 * Public objects are CDN-cached. The edge can keep serving a removed object
 * for a while, so this asks Storage to purge the cache for each path as well;
 * that call is best effort, and a takedown should be described to the
 * requester as "removed, and gone from caches shortly" rather than "gone".
 *
 * Idempotent. Running it twice reports that nothing was left to remove. Runs
 * against whatever `.env.local` points at.
 */

import { createClient } from '@supabase/supabase-js'

import { PHOTO_BUCKET } from '../lib/storage.ts'
import type { Database } from '../lib/supabase/database.types.ts'

const url = process.env.NEXT_PUBLIC_SUPABASE_URL
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
if (!url || !serviceKey) {
  throw new Error(
    'Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY. ' +
      'Run with: pnpm takedown … (which loads .env.local).',
  )
}

const supabase = createClient<Database>(url, serviceKey, {
  auth: { persistSession: false },
})

type Args = {
  photoId: string
  mode: 'takedown' | 'status'
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

function usage(message: string): never {
  console.error(`${message}

  pnpm takedown <photo-id>
  pnpm takedown <photo-id> --status`)
  process.exit(1)
}

function parseArgs(argv: string[]): Args {
  const [photoId, ...rest] = argv
  if (!photoId || photoId.startsWith('-')) usage('Missing photo id.')
  // Refused here rather than by Postgres: a malformed uuid in `.eq()` comes
  // back as a 22P02 whose message names the column, not the mistake.
  if (!UUID.test(photoId)) usage(`Not a photo id: ${photoId}`)

  let mode: Args['mode'] = 'takedown'
  for (const flag of rest) {
    switch (flag) {
      case '--status':
        mode = 'status'
        break
      default:
        usage(`Unknown argument: ${flag}`)
    }
  }

  return { photoId, mode }
}

type Row = {
  id: string
  event_id: string
  storage_path: string
  thumb_path: string
  view_path: string | null
  hidden_at: string | null
  status: Database['public']['Enums']['photo_status']
}

async function readRow(photoId: string): Promise<Row> {
  const { data, error } = await supabase
    .from('photos')
    .select(
      'id, event_id, storage_path, thumb_path, view_path, hidden_at, status',
    )
    .eq('id', photoId)
    .maybeSingle()
  if (error) throw error
  if (!data) throw new Error(`No photo with id "${photoId}".`)
  return data
}

/** Master, view and thumb — every object a photo has, in the order the row
 *  names them. `view_path` is nullable for rows older than the view render. */
function objectPaths(row: Row): string[] {
  return [row.storage_path, row.view_path, row.thumb_path].filter(
    (p): p is string => Boolean(p),
  )
}

function printRow(row: Row) {
  console.log(`  photo:     ${row.id}`)
  console.log(`  event:     ${row.event_id}`)
  console.log(`  status:    ${row.status}`)
  console.log(`  hidden_at: ${row.hidden_at ?? '—'}`)
}

async function status(photoId: string) {
  const row = await readRow(photoId)
  printRow(row)
  const bucket = supabase.storage.from(PHOTO_BUCKET)
  for (const path of objectPaths(row)) {
    const { data: exists, error } = await bucket.exists(path)
    if (error) throw error
    console.log(`  ${exists ? 'stored ' : 'absent '} ${path}`)
  }
}

async function takedown(photoId: string) {
  const row = await readRow(photoId)
  printRow(row)

  const paths = objectPaths(row)
  const bucket = supabase.storage.from(PHOTO_BUCKET)

  // One call for all three. `remove()` does not fail on a path that is already
  // gone — it simply leaves it out of what it reports as removed — which is
  // what makes a second run safe to describe as "nothing left".
  const { data: removed, error } = await bucket.remove(paths)
  if (error) throw error
  const removedNames = new Set((removed ?? []).map((object) => object.name))

  let removedCount = 0
  for (const path of paths) {
    const gone = removedNames.has(path)
    if (gone) removedCount++
    console.log(`  ${gone ? 'removed' : 'absent '} ${path}`)
  }
  if (removedCount === 0) console.log('  nothing left to remove')

  // The CDN may keep answering for a removed object. Best effort: a project
  // where the purge endpoint is unavailable still gets the removal, and the
  // requester is told the cache lags either way.
  for (const path of paths) {
    const { error: purgeError } = await bucket.purgeCache(path)
    if (purgeError) {
      console.log(`  cache:   could not purge ${path} (${purgeError.message})`)
    }
  }

  if (row.hidden_at) {
    console.log(`  hidden_at kept: ${row.hidden_at}`)
    return
  }

  // Set only when null. An existing `hidden_at` is when the host moderated it,
  // and that is a fact about the album worth keeping, not something a later
  // takedown should overwrite.
  const hiddenAt = new Date().toISOString()
  const { error: hideError } = await supabase
    .from('photos')
    .update({ hidden_at: hiddenAt })
    .eq('id', row.id)
    .is('hidden_at', null)
  if (hideError) throw hideError
  console.log(`  hidden_at set:  ${hiddenAt}`)
}

async function main() {
  const args = parseArgs(process.argv.slice(2))
  if (args.mode === 'status') await status(args.photoId)
  else await takedown(args.photoId)
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
