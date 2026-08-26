'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'

import { isRevealMode, isShotOption, resolveRevealAt } from '@/lib/camera'
import { eventLocalToIso } from '@/lib/format'
import { getOwnedEventBySlug } from '@/lib/events'
import { purgeEventObjects } from '@/lib/event-purge'
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
  revalidatePath(`/host/events/${slug}`)
  revalidatePath(`/host/events/${slug}/settings`)
  revalidatePath('/host')
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

  revalidatePath(`/host/events/${slug}`)
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
 * Move the moment the camera closes.
 *
 * **The end only.** `capture_start_at` is stamped once, when the event is
 * created, and nothing offers to change it — so it is read off the row here
 * rather than accepted from the caller. The check constraint on the table wants
 * `end > start` either way, and refusing that with a sentence beats letting
 * Postgres refuse it with a constraint name.
 *
 * The value arrives as a `datetime-local` string and is read as the event's own
 * wall clock. Setting the end in the past is allowed and is the supported way to
 * stop a camera early — a host standing in the room at the end of the night
 * should not have to compute a future timestamp to close it now. Only "before
 * the event existed" is out of bounds.
 *
 * The reveal follows automatically for an `event_end` event: the database
 * trigger recomputes `reveal_at` on every update, so moving the end moves the
 * reveal with it and no caller has to remember.
 */
export async function setCaptureEnd(slug: string, endLocal: string) {
  const event = await getOwnedEventBySlug(slug)
  if (!event) throw new Error('Nincs ilyen esemény.')

  const endIso = eventLocalToIso(endLocal, event.time_zone)
  if (!endIso) {
    throw new Error('Add meg, meddig lehet fotózni.')
  }
  if (new Date(endIso) <= new Date(event.capture_start_at)) {
    throw new Error('A fotózás vége nem lehet korábbi az esemény kezdeténél.')
  }

  // Extending the window past an already-passed reveal is allowed on purpose.
  // A host whose party runs long has an album that is already open and guests
  // who are still shooting into it — which is coherent, and refusing it would
  // block the more urgent action to protect the tidier invariant.

  const supabase = await createClient()
  const { data, error } = await supabase
    .from('events')
    .update({ capture_end_at: endIso })
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

/**
 * Erase an event: every object, every row, permanently.
 *
 * This is the one destructive path a host can reach, and the thing behind the
 * promise that an event and its contents can be deleted. It also covers a GDPR
 * erasure request, which is why it removes objects rather than only rows.
 *
 * Like the export, it runs on the host's own session rather than the service
 * key: the storage policies already scope object writes to folders the caller
 * owns, and `getOwnedEventBySlug` returning null is the ownership check.
 *
 * Order matters. Objects first, rows second — deleting the event cascades the
 * photo rows away, and without them there is no record of which objects to
 * remove. Reversed, the files would be orphaned in the bucket, which is
 * precisely what an erasure request is asking you not to do.
 *
 * The paging, the removal and the emptiness check all live in
 * `lib/event-purge.ts`, shared with the retention run so the two cannot drift.
 * It throws rather than half-succeeding, which leaves the rows intact and the
 * objects findable for a retry.
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

  await purgeEventObjects(supabase.storage, event.id)

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

  revalidatePath('/host')
  redirect('/host')
}
