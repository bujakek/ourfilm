/**
 * Delete one host's account and everything of theirs that can be deleted.
 *
 *   pnpm delete:account <email>                                  # dry run — counts only
 *   pnpm delete:account <email> --yes --project <supabase-ref>   # actually deletes
 *   pnpm delete:account <email> --yes --project <ref> --include-applications
 *
 * This answers the "Delete account" request that `/host/account` sends by
 * email. Nothing in the app deletes an account: the link is a `mailto:`.
 *
 * What goes, in this order, and why the order matters:
 *
 *   1. Storage. Every object under `event-photos/{event_id}/` for each event
 *      they own, and every prepared archive in `event-exports`, plus a CDN
 *      purge for the public photo paths. Postgres knows nothing about bucket
 *      objects: cascading the rows first would leave bytes nothing can name.
 *   2. Their events. `events.owner_id` is `on delete restrict`, so the user
 *      cannot be deleted while one exists. Deleting an event cascades through
 *      `photos`, `participants`, `event_grants`, `event_emails`,
 *      `album_exports` and `stripe_checkout_attempts`. Guests' photos on those
 *      events go with them — that is what deleting a host's events means, and
 *      the account page says so.
 *   3. The auth user. Cascades to `profiles` (display name, locale, role).
 *
 * What stays, deliberately:
 *
 *   - `purchases`. Both foreign keys are `on delete set null` and the billing
 *     snapshot on the row (name, address, tax number, invoice ids) is
 *     self-contained, because the privacy notice promises eight years of
 *     accounting records and Hungarian law requires them. The script lists
 *     them so the reply to the requester can say so.
 *   - Stripe and Billingo. Those are other controllers' systems; the script
 *     prints the Stripe customer ids so a person can decide there.
 *   - `early_couple_applications` (name, email, free-text answers), unless
 *     `--include-applications` is passed: it has its own `retention_until`, and
 *     whether a request overrides that is a person's call, not the script's.
 *
 * Refuses an `admin` account. Demote it first, on purpose.
 *
 * Runs against whatever `.env.local` points at, with the service role key. The
 * `--project` interlock is the same one `reset:data` has, for the same reason:
 * this repo has one Supabase project and it is production. There is no undo;
 * take a dump first if the data is worth anything:
 *
 *   pnpm supabase db dump --linked --data-only -f backup.sql
 *
 * Re-running after a partial failure is safe: every step tolerates what an
 * earlier run already removed.
 */

import { createClient } from '@supabase/supabase-js'

import { EXPORT_BUCKET, PHOTO_BUCKET } from '../lib/storage.ts'
import type { Database } from '../lib/supabase/database.types.ts'

const url = process.env.NEXT_PUBLIC_SUPABASE_URL
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
if (!url || !serviceKey) {
  throw new Error(
    'Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY. ' +
      'Run with: pnpm delete:account … (which loads .env.local).',
  )
}

const supabase = createClient<Database>(url, serviceKey, {
  auth: { persistSession: false },
})

/** `https://<ref>.supabase.co` — the ref is what `--project` must echo. */
const projectRef = new URL(url).hostname.split('.')[0]

type Args = {
  email: string
  confirmed: boolean
  claimedProject: string | null
  includeApplications: boolean
}

function usage(message: string): never {
  console.error(`${message}

  pnpm delete:account <email>
  pnpm delete:account <email> --yes --project ${projectRef} [--include-applications]`)
  process.exit(1)
}

function parseArgs(argv: string[]): Args {
  const [email, ...rest] = argv
  if (!email || email.startsWith('-')) usage('Missing email address.')

  const args: Args = {
    email: email.trim().toLowerCase(),
    confirmed: false,
    claimedProject: null,
    includeApplications: false,
  }
  for (let i = 0; i < rest.length; i++) {
    switch (rest[i]) {
      case '--yes':
        args.confirmed = true
        break
      case '--project':
        args.claimedProject = rest[++i] ?? null
        break
      case '--include-applications':
        args.includeApplications = true
        break
      default:
        usage(`Unknown argument: ${rest[i]}`)
    }
  }
  return args
}

async function findUser(email: string) {
  for (let page = 1; ; page++) {
    const { data, error } = await supabase.auth.admin.listUsers({
      page,
      perPage: 200,
    })
    if (error) throw error
    const hit = data.users.find((u) => u.email?.toLowerCase() === email)
    if (hit) return hit
    if (data.users.length < 200) return null
  }
}

async function listFolder(bucket: string, folder: string): Promise<string[]> {
  const paths: string[] = []
  for (let offset = 0; ; offset += 1000) {
    const { data, error } = await supabase.storage
      .from(bucket)
      .list(folder, { limit: 1000, offset })
    if (error) throw error
    for (const file of data ?? []) paths.push(`${folder}/${file.name}`)
    if (!data || data.length < 1000) return paths
  }
}

async function removeObjects(bucket: string, paths: string[], purge: boolean) {
  const BATCH = 200
  for (let i = 0; i < paths.length; i += BATCH) {
    const batch = paths.slice(i, i + BATCH)
    const { error } = await supabase.storage.from(bucket).remove(batch)
    if (error) throw error
    console.log(
      `  ${bucket}: removed ${Math.min(i + BATCH, paths.length)}/${paths.length}`,
    )
  }
  if (!purge) return
  // Public objects are CDN-cached and the edge can keep answering for a while.
  // Best effort, like `pnpm takedown`: describe the result to the requester as
  // "removed, and gone from caches shortly".
  let failed = 0
  for (const path of paths) {
    const { error } = await supabase.storage.from(bucket).purgeCache(path)
    if (error) failed++
  }
  if (failed > 0) console.log(`  cache: could not purge ${failed} path(s)`)
}

function errorMessage(e: unknown): string {
  // Supabase rejects with plain objects, not `Error`s, so an `instanceof`
  // check alone prints `[object Object]` at the moment the operator needs it.
  return e instanceof Error
    ? e.message
    : typeof e === 'object' && e !== null && 'message' in e
      ? String((e as { message: unknown }).message)
      : String(e)
}

async function main() {
  const args = parseArgs(process.argv.slice(2))

  const user = await findUser(args.email)
  if (!user) throw new Error(`No account with the email ${args.email}.`)

  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .maybeSingle()
  if (profileError) throw profileError
  if (profile?.role === 'admin') {
    throw new Error(
      'Refusing: this is an admin account. Demote it deliberately first.',
    )
  }

  const { data: events, error: eventsError } = await supabase
    .from('events')
    .select('id, slug, event_name')
    .eq('owner_id', user.id)
  if (eventsError) throw eventsError
  const eventIds = (events ?? []).map((e) => e.id)

  let photoCount = 0
  let participantCount = 0
  const photoObjects: string[] = []
  const exportObjects: string[] = []
  if (eventIds.length > 0) {
    const photos = await supabase
      .from('photos')
      .select('*', { count: 'exact', head: true })
      .in('event_id', eventIds)
    if (photos.error) throw photos.error
    photoCount = photos.count ?? 0

    const participants = await supabase
      .from('participants')
      .select('*', { count: 'exact', head: true })
      .in('event_id', eventIds)
    if (participants.error) throw participants.error
    participantCount = participants.count ?? 0

    for (const id of eventIds)
      photoObjects.push(...(await listFolder(PHOTO_BUCKET, id)))

    const exportsResult = await supabase
      .from('album_exports')
      .select('storage_path')
      .in('event_id', eventIds)
      .not('storage_path', 'is', null)
    if (exportsResult.error) throw exportsResult.error
    for (const row of exportsResult.data ?? []) {
      if (row.storage_path) exportObjects.push(row.storage_path)
    }
  }

  const purchases = await supabase
    .from('purchases')
    .select(
      'id, status, amount_minor, currency, invoice_status, stripe_customer_id',
    )
    .eq('owner_id', user.id)
  if (purchases.error) throw purchases.error

  // Two queries rather than one `.or()`: interpolating the address into a
  // PostgREST filter string would let a comma break the filter, and `ilike`
  // treats `_` and `%` as wildcards — `john_doe@…` would also match
  // `johnXdoe@…`, and `--include-applications` would delete a stranger's row.
  const byUser = await supabase
    .from('early_couple_applications')
    .select('id, retention_until')
    .eq('user_id', user.id)
  if (byUser.error) throw byUser.error
  const byEmail = await supabase
    .from('early_couple_applications')
    .select('id, retention_until')
    .ilike('email', args.email.replace(/[\\%_]/g, '\\$&'))
  if (byEmail.error) throw byEmail.error
  const applications = [
    ...new Map(
      [...byUser.data, ...byEmail.data].map((a) => [a.id, a]),
    ).values(),
  ]

  console.log(`Supabase project: ${projectRef}  (${url})`)
  console.log(`\nAccount: ${user.email}  (${user.id})`)
  console.log(`  role                 ${profile?.role ?? '(no profile)'}`)
  console.log('\nWill be deleted:')
  console.log(`  events               ${String(eventIds.length).padStart(5)}`)
  for (const e of events ?? []) console.log(`    ${e.slug}  ${e.event_name}`)
  console.log(`  photos (rows)        ${String(photoCount).padStart(5)}`)
  console.log(`  participants         ${String(participantCount).padStart(5)}`)
  console.log(
    `  ${PHOTO_BUCKET} objects ${String(photoObjects.length).padStart(5)}`,
  )
  console.log(
    `  ${EXPORT_BUCKET} objects ${String(exportObjects.length).padStart(5)}`,
  )
  console.log('  auth user + profile      1')

  console.log('\nWill be kept:')
  console.log(
    `  purchases            ${String(purchases.data?.length ?? 0).padStart(5)}   (accounting record; owner_id is nulled)`,
  )
  for (const p of purchases.data ?? []) {
    console.log(
      `    ${p.id}  ${p.status}  ${p.amount_minor ?? '?'} ${p.currency ?? ''}  invoice: ${p.invoice_status}`,
    )
  }
  const customers = [
    ...new Set(
      (purchases.data ?? [])
        .map((p) => p.stripe_customer_id)
        .filter((c): c is string => Boolean(c)),
    ),
  ]
  console.log(
    `  Stripe customers     ${customers.length ? customers.join(', ') : '—'}   (decide in Stripe by hand)`,
  )
  console.log(
    `  early couple applications ${applications.length}   (${args.includeApplications ? 'deleted: --include-applications' : 'kept unless --include-applications'})`,
  )
  for (const a of applications) {
    console.log(`    ${a.id}  retention until ${a.retention_until}`)
  }

  if (!args.confirmed || args.claimedProject !== projectRef) {
    console.log(
      args.confirmed
        ? `\nRefusing: --project ${args.claimedProject ?? '(missing)'} does not match ${projectRef}.`
        : '\nDry run. Nothing was deleted.',
    )
    console.log(`\nTo delete the above:

  pnpm supabase db dump --linked --data-only -f backup.sql   # optional, first
  pnpm delete:account ${args.email} --yes --project ${projectRef}`)
    process.exit(args.confirmed ? 1 : 0)
  }

  console.log('\nDeleting…')
  await removeObjects(PHOTO_BUCKET, photoObjects, true)
  await removeObjects(EXPORT_BUCKET, exportObjects, false)

  if (eventIds.length > 0) {
    const { error } = await supabase.from('events').delete().in('id', eventIds)
    if (error) throw error
    console.log(`deleted ${eventIds.length} event(s)`)
  }

  if (args.includeApplications && applications.length > 0) {
    const { error } = await supabase
      .from('early_couple_applications')
      .delete()
      .in(
        'id',
        applications.map((a) => a.id),
      )
    if (error) throw error
    console.log(`deleted ${applications.length} application(s)`)
  }

  const { error: deleteError } = await supabase.auth.admin.deleteUser(user.id)
  if (deleteError) throw deleteError
  console.log('deleted auth user (profile cascades)')

  // Read it all back rather than trusting the calls above.
  const leftovers: string[] = []
  if (await findUser(args.email)) leftovers.push('auth user')
  if (eventIds.length > 0) {
    const left = await supabase
      .from('events')
      .select('*', { count: 'exact', head: true })
      .in('id', eventIds)
    if (left.error) throw left.error
    if ((left.count ?? 0) > 0) leftovers.push('events')
    for (const id of eventIds) {
      if ((await listFolder(PHOTO_BUCKET, id)).length > 0) {
        leftovers.push(`storage ${id}/`)
      }
    }
  }
  for (const path of exportObjects) {
    const { data: exists, error } = await supabase.storage
      .from(EXPORT_BUCKET)
      .exists(path)
    if (error) throw error
    if (exists) leftovers.push(`export ${path}`)
  }
  if (leftovers.length > 0) {
    throw new Error(`Not everything went: ${leftovers.join(', ')}`)
  }

  console.log(`
Done. Verified: account, events, photo folders and archives are gone.

For the reply to the requester:
  - photos are removed, and gone from CDN caches shortly
  - provider backups expire on the provider's own cycle
  - invoices and accounting records are kept (8 years, Hungarian law)
  - Stripe/Link and Billingo hold their own data under their own notices`)
}

main().catch((e: unknown) => {
  console.error(errorMessage(e))
  process.exit(1)
})
