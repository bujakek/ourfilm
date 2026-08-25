'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'

import { isRevealMode, isShotOption, resolveRevealAt } from '@/lib/camera'
import { eventLocalToIso } from '@/lib/format'
import { getOwnedEventBySlug } from '@/lib/events'
import { PHOTO_BUCKET } from '@/lib/storage'
import { createClient } from '@/lib/supabase/server'

/**
 * Everything a host can change about a running camera.
 *
 * All of these write through the host's own session, so ownership RLS is the
 * check — there is no `if (event.owner_id === user.id)` anywhere below because
 * a policy already answered it, and an update that matches zero rows is how a
 * refusal arrives.
 *
 * Which is exactly why every one of them inspects the returned row count. An
 * UPDATE has to SELECT the row first, so a missing or non-matching policy
 * returns zero rows with no error at all — checking the count is the difference
 * between "saved" and "silently did nothing".
 */

/** The paths any change to an event can invalidate. Guests read the event on
 *  every screen, so a settings change that skipped these would leave a phone
 *  showing an old capture window until something else happened to refresh it. */
function revalidateEvent(slug: string) {
  revalidatePath(`/admin/events/${slug}`)
  revalidatePath(`/admin/events/${slug}/settings`)
  revalidatePath('/admin')
  revalidatePath(`/e/${slug}`, 'layout')
}

/**
 * Hide or restore a single photo.
 *
 * Soft delete only — `hidden_at` is set, never a row removed. A host clearing
 * an unflattering shot at 1am should not be able to destroy a guest's photo
 * permanently by tapping the wrong tile.
 *
 * Hiding does **not** give the guest their frame back. `participant_shots_used`
 * counts every photo regardless of `hidden_at`, because the object still exists
 * and still cost them a shot — and because refunding on hide would make
 * moderation a way to hand out extra film.
 */
export async function setPhotoHidden(
  slug: string,
  photoId: string,
  hidden: boolean,
) {
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('photos')
    .update({ hidden_at: hidden ? new Date().toISOString() : null })
    .eq('id', photoId)
    .select('id')

  if (error) throw error
  if (!data || data.length === 0) {
    throw new Error('A kép nem módosult — lehet, hogy nincs jogosultságod.')
  }

  revalidatePath(`/admin/events/${slug}`)
  revalidatePath(`/e/${slug}/gallery`)
}

/** Let guests open the developed gallery, or keep it to the host alone.
 *  Capture is unaffected either way — guests keep shooting into an album they
 *  cannot browse, which is a legitimate way to run a wedding. */
export async function setGuestsCanView(slug: string, canView: boolean) {
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('events')
    .update({ guests_can_view: canView })
    .eq('slug', slug)
    .select('id')

  if (error) throw error
  if (!data || data.length === 0) throw new Error('Az esemény nem módosult.')

  revalidateEvent(slug)
  revalidatePath(`/e/${slug}/gallery`)
}

/**
 * Move the capture window.
 *
 * Both ends arrive as `datetime-local` strings and are read as the event's own
 * wall clock. Setting the end in the past is allowed and is the supported way
 * to stop a camera early — a host standing in the room at the end of the night
 * should not have to compute a future timestamp to close it now.
 *
 * The reveal follows automatically for an `event_end` event: the database
 * trigger recomputes `reveal_at` on every update, so moving the end moves the
 * reveal with it and no caller has to remember.
 */
export async function setCaptureWindow(
  slug: string,
  startLocal: string,
  endLocal: string,
) {
  const event = await getOwnedEventBySlug(slug)
  if (!event) throw new Error('Nincs ilyen esemény.')

  const startIso = eventLocalToIso(startLocal, event.time_zone)
  const endIso = eventLocalToIso(endLocal, event.time_zone)
  if (!startIso || !endIso) {
    throw new Error('Add meg, mikortól meddig lehet fotózni.')
  }
  if (new Date(endIso) <= new Date(startIso)) {
    throw new Error('A befejezés legyen későbbi a kezdésnél.')
  }

  // Extending the window past an already-passed reveal is allowed on purpose.
  // A host whose party runs long has an album that is already open and guests
  // who are still shooting into it — which is coherent, and refusing it would
  // block the more urgent action to protect the tidier invariant.

  const supabase = await createClient()
  const { data, error } = await supabase
    .from('events')
    .update({ capture_start_at: startIso, capture_end_at: endIso })
    .eq('slug', slug)
    .select('id')

  if (error) throw error
  if (!data || data.length === 0) throw new Error('Az esemény nem módosult.')

  revalidateEvent(slug)
  revalidatePath(`/e/${slug}/gallery`)
}

/** Change when the album develops. `reveal_at` is recomputed by the trigger for
 *  the two pinned modes; only `custom` carries its own instant. */
export async function setReveal(
  slug: string,
  mode: string,
  customLocal: string | null,
) {
  if (!isRevealMode(mode)) throw new Error('Ismeretlen leleplezési mód.')

  const event = await getOwnedEventBySlug(slug)
  if (!event) throw new Error('Nincs ilyen esemény.')

  const customIso = customLocal
    ? eventLocalToIso(customLocal, event.time_zone)
    : null

  if (mode === 'custom') {
    if (!customIso) throw new Error('Add meg a leleplezés időpontját.')
    if (new Date(customIso) < new Date(event.capture_end_at)) {
      throw new Error('A leleplezés nem lehet korábbi a fotózás végénél.')
    }
  }

  const revealAt = resolveRevealAt({
    mode,
    captureStartAt: new Date(event.capture_start_at),
    captureEndAt: new Date(event.capture_end_at),
    customRevealAt: customIso ? new Date(customIso) : null,
  })

  const supabase = await createClient()
  const { data, error } = await supabase
    .from('events')
    .update({ reveal_mode: mode, reveal_at: revealAt.toISOString() })
    .eq('slug', slug)
    .select('id')

  if (error) throw error
  if (!data || data.length === 0) throw new Error('Az esemény nem módosult.')

  revalidateEvent(slug)
  revalidatePath(`/e/${slug}/gallery`)
}

/**
 * Open the gallery now.
 *
 * Writes a real reveal instant rather than flipping a display flag, so it
 * survives a refresh, a redeploy, and anybody else's session. The mode becomes
 * `custom` because that is what it now is — an instant the host chose.
 *
 * Guests see the album only if `guests_can_view` is also on. That is why the
 * confirmation says "amennyiben a vendéggaléria engedélyezve van" rather than
 * promising something this action cannot deliver on its own.
 */
export async function revealNow(slug: string) {
  const supabase = await createClient()
  const now = new Date().toISOString()

  const { data, error } = await supabase
    .from('events')
    .update({ reveal_mode: 'custom', reveal_at: now })
    .eq('slug', slug)
    .select('id')

  if (error) throw error
  if (!data || data.length === 0) throw new Error('Az esemény nem módosult.')

  revalidateEvent(slug)
  revalidatePath(`/e/${slug}/gallery`)
}

/**
 * Change how many frames each guest gets.
 *
 * Lowering it never deletes anything. A participant already past the new limit
 * keeps every photo they took and simply cannot take more — `reserve_shot`
 * compares their count against whatever the column says now, so the change
 * takes effect on the next shutter press and not retroactively.
 */
export async function setShotsPerParticipant(slug: string, shots: number) {
  if (!isShotOption(shots)) throw new Error('Válassz egy érvényes értéket.')

  const supabase = await createClient()
  const { data, error } = await supabase
    .from('events')
    .update({ shots_per_participant: shots })
    .eq('slug', slug)
    .select('id')

  if (error) throw error
  if (!data || data.length === 0) throw new Error('Az esemény nem módosult.')

  revalidateEvent(slug)
}

/** One page of a Storage listing. `list()` returns a page, not a total — the
 *  API caps what it will hand back however large a `limit` you ask for, so the
 *  loop below is what makes the enumeration complete, not this number. */
const LIST_PAGE = 100

/** Bound on the paging loop. 20k objects is an order of magnitude past any
 *  real album, so reaching it means `offset` is not advancing rather than that
 *  someone shot ten thousand photos — and without the bound that is an
 *  infinite loop. Treated as a failure, never as "done". */
const MAX_LIST_PAGES = 200

/** `remove()` carries every path in one request body, so a large album goes in
 *  batches rather than a single enormous call. */
const REMOVE_BATCH = 100

/**
 * Erase an event: every object, every row, permanently.
 *
 * This is the one destructive path in the product, and the only thing behind
 * the FAQ's promise that a host can delete an event and its contents. It also
 * covers a GDPR erasure request, which is why it removes objects rather than
 * only rows.
 *
 * Like the export, it runs on the host's own session rather than the service
 * key: the storage policies already scope object writes to folders the caller
 * owns, and `getOwnedEventBySlug` returning null is the ownership check.
 *
 * Order matters. Objects first, rows second — deleting the event cascades the
 * photo rows away, and without them there is no record of which objects to
 * remove. Reversed, the files would be orphaned in the bucket forever, still
 * fetchable at their public URLs, which is precisely what an erasure request
 * is asking you not to do.
 *
 * That last paragraph is also why every step below is verified rather than
 * assumed. A single unpaginated `list()` sees one page — about 500 photos,
 * since each is two objects — and everything past it would be orphaned in a
 * *public* bucket with the only record of its existence cascaded away. Erasure
 * that silently half-succeeds is worse than erasure that fails, because the
 * host is told the photos are gone. So: page until the listing is exhausted,
 * check that every removal actually removed, and confirm the folder is empty
 * before the rows go. Any doubt throws with the rows still intact, which keeps
 * the objects findable for a retry.
 */
export async function deleteEvent(slug: string) {
  const supabase = await createClient()

  const { data: event, error: eventError } = await supabase
    .from('events')
    .select('id, event_name')
    .eq('slug', slug)
    .maybeSingle()
  if (eventError) throw eventError
  if (!event) throw new Error('Nincs ilyen esemény.')

  // Collect every path first, remove second. Deleting inside the paging loop
  // would shift the offsets out from under it and skip whole pages.
  const paths: string[] = []
  let listingComplete = false

  for (let page = 0; page < MAX_LIST_PAGES; page++) {
    const { data: listed, error: listError } = await supabase.storage
      .from(PHOTO_BUCKET)
      .list(event.id, {
        limit: LIST_PAGE,
        offset: paths.length,
        // Explicit, so the ordering the offsets index into cannot change
        // between one page and the next.
        sortBy: { column: 'name', order: 'asc' },
      })
    if (listError) throw listError

    // Advance by what came back, not by LIST_PAGE, and stop only on an empty
    // page. A short page must not end the loop: the API is free to return
    // fewer objects than asked for, and treating that as the end is exactly
    // the bug that left albums half-deleted.
    if (!listed || listed.length === 0) {
      listingComplete = true
      break
    }
    paths.push(...listed.map((object) => `${event.id}/${object.name}`))
  }

  if (!listingComplete) {
    throw new Error('Nem sikerült végigolvasni a képeket. Próbáld újra.')
  }

  for (let i = 0; i < paths.length; i += REMOVE_BATCH) {
    const batch = paths.slice(i, i + REMOVE_BATCH)
    const { data: removed, error: removeError } = await supabase.storage
      .from(PHOTO_BUCKET)
      .remove(batch)
    if (removeError) throw removeError
    // `remove()` reports what it deleted and silently omits what it could not,
    // so the count is the only signal that a path survived. Throwing here
    // leaves the rows in place, so a retry can still find the stragglers.
    if (!removed || removed.length !== batch.length) {
      throw new Error('Nem sikerült minden képet törölni. Próbáld újra.')
    }
  }

  // Capture stays open throughout, so a guest can land a photo after the
  // listing above and before the rows go. Confirm the folder is empty instead
  // of assuming it — this is the last moment at which an object left behind is
  // still findable.
  const { data: leftover, error: leftoverError } = await supabase.storage
    .from(PHOTO_BUCKET)
    .list(event.id, { limit: 1 })
  if (leftoverError) throw leftoverError
  if (leftover && leftover.length > 0) {
    throw new Error('Közben új kép érkezett. Indítsd újra a törlést.')
  }

  // Cascades the photo rows.
  const { data: deleted, error: deleteError } = await supabase
    .from('events')
    .delete()
    .eq('id', event.id)
    .select('id')
  if (deleteError) throw deleteError
  if (!deleted || deleted.length === 0) {
    throw new Error('Az esemény nem törlődött.')
  }

  revalidatePath('/admin')
  redirect('/admin')
}
