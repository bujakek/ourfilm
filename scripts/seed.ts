/**
 * Development seed: one event with a handful of photos.
 *
 *   pnpm seed
 *
 * Exists so Phases 2-4 (event page, upload, gallery) can be built and looked at
 * before admin exists to create events. Idempotent — re-running reuses the same
 * event rather than piling up duplicates.
 *
 * Runs against whatever .env.local points at and writes real rows and real
 * objects. It needs the service role key because `events.owner_id` is
 * `not null` and only a host may insert an event, which is exactly the rule
 * this script has to step around.
 *
 * Photos are produced from the landing-page artwork through the same pipeline
 * shape the browser will use in Phase 3: a 4096px-bounded JPEG at q92 plus a
 * ~400px thumb. Seeding tiny placeholders instead would make the gallery look
 * fine while hiding exactly the layout and payload problems worth catching.
 */

import { createClient } from '@supabase/supabase-js'
import { createHash, randomUUID } from 'node:crypto'
import { readdir, readFile } from 'node:fs/promises'
import path from 'node:path'
import sharp from 'sharp'

import type { Database } from '../lib/supabase/database.types.ts'
import { generateEventSlug } from '../lib/slug.ts'

const EVENT_NAME = 'Anna & Péter'
const MAX_EDGE = 4096
const THUMB_EDGE = 400
const VIEW_EDGE = 1600
const QUALITY = 92
const THUMB_QUALITY = 80
const VIEW_QUALITY = 85

const url = process.env.NEXT_PUBLIC_SUPABASE_URL
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
if (!url || !serviceKey) {
  throw new Error(
    'Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY. ' +
      'Run with: node --env-file=.env.local … (see the seed script in package.json).',
  )
}

const supabase = createClient<Database>(url, serviceKey, {
  auth: { persistSession: false },
})

/** Participant names. No null any more: joining requires a name, so every
 *  photo in a real event has one and the seed should not pretend otherwise. */
const UPLOADERS = ['Réka', 'Máté', 'Nagymama', 'Bence', 'Zsófi']

const HOUR_MS = 60 * 60 * 1000

async function main() {
  // --- host -----------------------------------------------------------------
  // No address is hardcoded here on purpose: a personal email does not belong
  // in a committed script. Set SEED_HOST_EMAIL, or rely on the fallback when
  // the project has exactly one account.
  const { data: userList, error: userError } =
    await supabase.auth.admin.listUsers()
  if (userError) throw userError

  const wanted = process.env.SEED_HOST_EMAIL
  const host = wanted
    ? userList.users.find((u) => u.email === wanted)
    : userList.users.length === 1
      ? userList.users[0]
      : undefined

  if (!host) {
    const known = userList.users.map((u) => u.email).join(', ') || 'none'
    throw new Error(
      wanted
        ? `No auth user for SEED_HOST_EMAIL=${wanted}. Known accounts: ${known}`
        : `Set SEED_HOST_EMAIL to pick a host — this project has ` +
            `${userList.users.length} accounts: ${known}`,
    )
  }

  // --- event ----------------------------------------------------------------
  const { data: owned, error: ownedError } = await supabase
    .from('events')
    .select('id, slug')
    .eq('owner_id', host.id)
    .eq('event_name', EVENT_NAME)
    .maybeSingle()
  if (ownedError) throw ownedError

  let eventId: string
  let slug: string

  if (owned) {
    ;({ id: eventId, slug } = owned)
    console.log(`reusing event ${slug}`)
  } else {
    const { data: created, error: createError } = await supabase
      .from('events')
      .insert({
        slug: generateEventSlug(EVENT_NAME),
        event_name: EVENT_NAME,
        owner_id: host.id,
        // A camera that is open right now and stays open for a week, revealing
        // instantly. The point of a dev event is that every screen is
        // reachable without waiting or editing a timestamp — a seeded event
        // whose window has not opened would render the "not started yet" state
        // and nothing else.
        capture_start_at: new Date(Date.now() - HOUR_MS).toISOString(),
        capture_end_at: new Date(Date.now() + 7 * 24 * HOUR_MS).toISOString(),
        reveal_mode: 'instant',
        reveal_at: new Date(Date.now() - HOUR_MS).toISOString(),
        shots_per_participant: 24,
        guests_can_view: true,
      })
      .select('id, slug')
      .single()
    if (createError) throw createError
    ;({ id: eventId, slug } = created)
    console.log(`created event ${slug}`)
  }

  // --- participants ---------------------------------------------------------
  //
  // Seeded directly rather than through `join_event`, because that RPC takes a
  // session token hash and there is no browser here to hold the cookie. The
  // hashes below are of throwaway strings and match nothing a real device would
  // present — a seeded participant is a row to look at, not a session to
  // resume.
  const participantIds: string[] = []

  for (const name of UPLOADERS) {
    const { data: participant, error: participantError } = await supabase
      .from('participants')
      .upsert(
        {
          event_id: eventId,
          display_name: name,
          session_token_hash: createHash('sha256')
            .update(`seed:${eventId}:${name}`)
            .digest('hex'),
        },
        { onConflict: 'event_id,session_token_hash' },
      )
      .select('id')
      .single()
    if (participantError) throw participantError
    participantIds.push(participant.id)
  }

  console.log(`seeded ${participantIds.length} participants`)

  // --- photos ---------------------------------------------------------------
  const { count } = await supabase
    .from('photos')
    .select('id', { count: 'exact', head: true })
    .eq('event_id', eventId)

  if (count && count > 0) {
    console.log(`${count} photos already present — skipping upload`)
    console.log(`\n  /e/${slug}\n`)
    return
  }

  const imageDir = path.join(import.meta.dirname, '..', 'public', 'images')
  const sources = (await readdir(imageDir))
    .filter((f) => f.endsWith('.webp'))
    .sort()
    .slice(0, UPLOADERS.length)

  for (const [i, file] of sources.entries()) {
    const source = await readFile(path.join(imageDir, file))
    const photoId = randomUUID()

    const full = await sharp(source)
      .rotate() // bake in EXIF orientation, as the browser pipeline does
      .resize(MAX_EDGE, MAX_EDGE, { fit: 'inside', withoutEnlargement: true })
      .jpeg({ quality: QUALITY })
      .toBuffer()
    const meta = await sharp(full).metadata()

    const thumb = await sharp(source)
      .rotate()
      .resize(THUMB_EDGE, THUMB_EDGE, {
        fit: 'inside',
        withoutEnlargement: true,
      })
      .jpeg({ quality: THUMB_QUALITY })
      .toBuffer()

    // The lightbox render, same as the browser pipeline produces. Without it
    // seeded albums would fall back to the 4096px master and quietly hide the
    // very decode cost this exists to avoid.
    const view = await sharp(source)
      .rotate()
      .resize(VIEW_EDGE, VIEW_EDGE, {
        fit: 'inside',
        withoutEnlargement: true,
      })
      .jpeg({ quality: VIEW_QUALITY })
      .toBuffer()

    const fullPath = `${eventId}/${photoId}.jpg`
    const thumbPath = `${eventId}/${photoId}_thumb.jpg`
    const viewPath = `${eventId}/${photoId}_view.jpg`

    for (const [objectPath, body] of [
      [fullPath, full],
      [thumbPath, thumb],
      [viewPath, view],
    ] as const) {
      const { error } = await supabase.storage
        .from('event-photos')
        .upload(objectPath, body, {
          contentType: 'image/jpeg',
          cacheControl: '31536000',
          upsert: true,
        })
      if (error) throw error
    }

    // Object first, row second: a failed insert leaves a harmless orphan,
    // whereas the reverse puts a broken tile in the gallery.
    const { error: rowError } = await supabase.from('photos').insert({
      id: photoId,
      event_id: eventId,
      // Every photo belongs to a participant now. The seed spreads them across
      // the fixtures so the gallery shows more than one name and the shot
      // counter is exercised on more than one roll.
      participant_id: participantIds[i % participantIds.length],
      status: 'ready',
      storage_path: fullPath,
      thumb_path: thumbPath,
      view_path: viewPath,
      width: meta.width ?? null,
      height: meta.height ?? null,
      byte_size: full.byteLength,
      mime_type: 'image/jpeg',
    })
    if (rowError) throw rowError

    console.log(
      `  ${file} → ${(full.byteLength / 1024).toFixed(0)}KB full, ` +
        `${(thumb.byteLength / 1024).toFixed(0)}KB thumb`,
    )
  }

  console.log(`\nseeded ${sources.length} photos\n\n  /e/${slug}\n`)
}

await main()
