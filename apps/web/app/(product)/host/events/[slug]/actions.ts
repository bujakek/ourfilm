'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'

import {
  eventNameProblem,
  isRevealChoice,
  isShotOption,
  resolveRevealAt,
} from '@/lib/camera'
import { eventLocalToIso } from '@/lib/format'
import { getOwnedEventBySlug } from '@/lib/events'
import { PHOTO_BUCKET } from '@/lib/storage'
import { createAdminClient } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'
import {
  reportServerEvent,
  reportServerIssue,
  type ServerEventProperties,
} from '@/lib/telemetry-server'

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

type Setting = ServerEventProperties['event_setting_changed']['setting']

/**
 * Report a settings write the database refused, and hand the error back so the
 * caller can throw it — `throw await refused(error, 'reveal')`.
 *
 * Both refusals go through here, and the second is the reason it exists. An
 * UPDATE that matches zero rows carries no error at all: it is what a missing
 * or non-matching policy looks like from this side, and it reaches the host as
 * "Az esemény nem módosult" with nothing recorded anywhere. That is precisely
 * the failure the docblock above warns about, and it has never been counted.
 */
async function refused(error: unknown, setting: Setting) {
  await reportServerIssue(error, {
    operation: `event_setting_${setting}`,
    route: '/host/events/[slug]/settings',
    routeType: 'action',
  })
  return error
}

async function refusedPhoto(error: unknown) {
  await reportServerIssue(error, {
    operation: 'photo_hidden',
    route: '/host/events/[slug]',
    routeType: 'action',
  })
  return error
}

async function refusedDelete(error: unknown) {
  await reportServerIssue(error, {
    operation: 'photo_deleted',
    route: '/host/events/[slug]',
    routeType: 'action',
  })
  return error
}

/** One event for all five controls, so "what do hosts adjust, and when" is a
 *  single breakdown rather than five series to line up by hand. */
function changed(
  eventId: string,
  setting: Setting,
  values: Partial<
    Omit<ServerEventProperties['event_setting_changed'], 'event_id' | 'setting'>
  > = {},
) {
  return reportServerEvent('event_setting_changed', {
    event_id: eventId,
    setting,
    reveal_mode: null,
    shots: null,
    guests_can_view: null,
    moved_minutes: null,
    ...values,
  })
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

  // Moderation is not a setting, so it is reported under its own operation.
  // The zero-row case matters here for the same reason it does below: it is a
  // policy refusal arriving with no error attached.
  if (error) throw await refusedPhoto(error)
  if (!data || data.length === 0) {
    throw await refusedPhoto(
      new Error('A kép nem módosult — lehet, hogy nincs jogosultságod.'),
    )
  }

  revalidatePath(`/host/events/${slug}`)
  revalidatePath(`/e/${slug}`)
}

/**
 * Delete one photo for good — and keep its row.
 *
 * The row surviving is the whole shape, not a shortcut.
 * `participant_shots_used` counts photo rows, so a `delete from photos` would
 * hand the guest their frame back: the host would have found a way to give out
 * extra film, and "no preview, no retakes" would stop being true for anybody
 * whose photo was tidied away. What goes is the three storage objects; what
 * stays is a tombstone carrying `deleted_at` and `hidden_at`.
 *
 * That is also exactly what `scripts/takedown-photo.ts` has done since the
 * bucket went public, which is the point — this is the host-facing face of the
 * operator's lever, not a second mechanism beside it.
 *
 * **Objects first, row second**, the ordering `deleteEvent` keeps and for the
 * same reason: the row is the only record of which objects belong to the
 * photo, so marking it deleted first would orphan three files in the bucket
 * with nothing left pointing at them.
 *
 * Runs on the host's own session. Ownership is RLS — the update affecting zero
 * rows *is* the refusal — and there is no explicit owner check anywhere in this
 * file, deliberately.
 */
export async function deletePhoto(slug: string, photoId: string) {
  const supabase = await createClient()

  const { data: photo, error: readError } = await supabase
    .from('photos')
    .select('id, event_id, storage_path, thumb_path, view_path, hidden_at')
    .eq('id', photoId)
    .is('deleted_at', null)
    .maybeSingle()
  if (readError) throw await refusedDelete(readError)
  if (!photo) throw await refusedDelete(new Error('Nincs ilyen kép.'))

  // The last photo stays. An album with nothing in it is not a state the rest
  // of the product has an answer for — the export refuses, the gallery says
  // there is nothing yet — and a host who wants that wants to delete the
  // event, which is its own deliberate path.
  const { count, error: countError } = await supabase
    .from('photos')
    .select('id', { count: 'exact', head: true })
    .eq('event_id', photo.event_id)
    .eq('status', 'ready')
    .is('deleted_at', null)
  if (countError) throw await refusedDelete(countError)
  if ((count ?? 0) <= 1) {
    throw await refusedDelete(
      new Error('Ez az utolsó kép az eseményen, ezért nem törölhető.'),
    )
  }

  const paths = [photo.storage_path, photo.view_path, photo.thumb_path].filter(
    (path): path is string => Boolean(path),
  )
  const bucket = supabase.storage.from(PHOTO_BUCKET)

  const { data: removed, error: removeError } = await bucket.remove(paths)
  if (removeError) throw await refusedDelete(removeError)
  // `remove()` reports what it deleted and silently omits what it could not,
  // so the count is the only signal a path survived. Throwing here leaves the
  // row intact, so a retry can still find the stragglers — the same contract
  // `deleteEvent` keeps.
  const gone = new Set((removed ?? []).map((object) => object.name))
  const missed = paths.filter((path) => !gone.has(path))
  if (missed.length > 0 && (removed ?? []).length > 0) {
    throw await refusedDelete(
      new Error('Nem sikerült minden fájlt törölni. Próbáld újra.'),
    )
  }

  // The objects are public and CDN-cached, so the edge can keep answering for
  // one after it is gone. Best effort, exactly as the takedown script has it:
  // a project where the purge endpoint is unavailable still gets the removal.
  for (const path of paths) await bucket.purgeCache(path)

  const { data: updated, error: updateError } = await supabase
    .from('photos')
    .update({
      deleted_at: new Date().toISOString(),
      // Set only when null. An existing `hidden_at` is when the host moderated
      // it, and that is a fact about the album worth keeping.
      ...(photo.hidden_at ? {} : { hidden_at: new Date().toISOString() }),
    })
    .eq('id', photoId)
    .select('id')
  if (updateError) throw await refusedDelete(updateError)
  if (!updated || updated.length === 0) {
    throw await refusedDelete(
      new Error('A kép nem törlődött — lehet, hogy nincs jogosultságod.'),
    )
  }

  // After the row is written, never beside it: a delete that threw halfway is
  // not a delete. `hidden_before` is the interesting dimension — it says
  // whether hosts delete straight from the grid or clean up what they had
  // already hidden, which is what tells us whether this design held. No photo
  // id, no participant id, no name.
  await reportServerEvent('photo_deleted', {
    event_id: photo.event_id,
    hidden_before: photo.hidden_at !== null,
  })

  revalidatePath(`/host/events/${slug}`)
  revalidatePath(`/e/${slug}`)
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

  if (error) throw await refused(error, 'guests_can_view')
  if (!data || data.length === 0) {
    throw await refused(
      new Error('Az esemény nem módosult.'),
      'guests_can_view',
    )
  }

  await changed(data[0].id, 'guests_can_view', { guests_can_view: canView })

  revalidateEvent(slug)
  revalidatePath(`/e/${slug}`)
}

/**
 * Rename an event.
 *
 * **The slug does not move, and that is the point.** It is minted once from
 * the name the host first typed and then printed onto QR codes, taped to a
 * table and shared in a group chat — so re-deriving it here would turn a typo
 * fix into a wall of dead cards halfway through a wedding. `event_name` is a
 * label; `slug` is an address, and only the first one is editable. The card
 * says so in as many words, because a host who expects the link to follow the
 * name would otherwise find out from a guest.
 *
 * Nothing else is derived from the name either: the ZIP export names its file
 * from the slug, and the photos are keyed on the event id. So this really is
 * one column, and every screen picks the new name up from `revalidateEvent`.
 *
 * The refusals are `eventNameProblem`'s, which is the same function the card's
 * own Save button consults — a name the field accepts and this rejects would be
 * a host meeting the rule only after tapping. The sentences here are Hungarian
 * like the rest of this file and are the backstop for a direct call; the card
 * writes its own in whichever language it is rendered in, and never shows one
 * of these.
 */
export async function renameEvent(slug: string, name: string) {
  const trimmed = name.trim()
  const problem = eventNameProblem(trimmed)
  if (problem === 'required') throw new Error('Adj nevet az eseménynek.')
  if (problem === 'too_long') throw new Error('Ez a név túl hosszú.')

  const supabase = await createClient()
  const { data, error } = await supabase
    .from('events')
    .update({ event_name: trimmed })
    .eq('slug', slug)
    .select('id')

  if (error) throw await refused(error, 'name')
  if (!data || data.length === 0) {
    throw await refused(new Error('Az esemény nem módosult.'), 'name')
  }

  // The name itself is never reported — it is the one field a guest reads and
  // a host writes freely, so it is exactly the kind of string that must not
  // reach a third party. That it changed is the whole event.
  await changed(data[0].id, 'name')

  revalidateEvent(slug)
  revalidatePath(`/e/${slug}`)
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

  if (error) throw await refused(error, 'capture_end')
  if (!data || data.length === 0) {
    throw await refused(new Error('Az esemény nem módosult.'), 'capture_end')
  }

  // Signed, and it is the sign that carries the meaning: negative closes the
  // camera early, which is a host standing in the room ending the night, and
  // positive is a party running long. Both say the default window was wrong.
  await changed(data[0].id, 'capture_end', {
    moved_minutes: Math.round(
      (new Date(endIso).getTime() - new Date(event.capture_end_at).getTime()) /
        60_000,
    ),
  })

  revalidateEvent(slug)
  revalidatePath(`/e/${slug}`)
}

/** Change when the album develops. Both available modes are pinned to the
 * capture window, so neither accepts a separate date. */
export async function setReveal(slug: string, mode: string) {
  if (!isRevealChoice(mode)) throw new Error('Ismeretlen leleplezési mód.')

  const event = await getOwnedEventBySlug(slug)
  if (!event) throw new Error('Nincs ilyen esemény.')

  const revealAt = resolveRevealAt({
    mode,
    captureStartAt: new Date(event.capture_start_at),
    captureEndAt: new Date(event.capture_end_at),
    customRevealAt: null,
  })

  const supabase = await createClient()
  const { data, error } = await supabase
    .from('events')
    .update({ reveal_mode: mode, reveal_at: revealAt.toISOString() })
    .eq('slug', slug)
    .select('id')

  if (error) throw await refused(error, 'reveal')
  if (!data || data.length === 0) {
    throw await refused(new Error('Az esemény nem módosult.'), 'reveal')
  }

  await changed(data[0].id, 'reveal', { reveal_mode: mode })

  revalidateEvent(slug)
  revalidatePath(`/e/${slug}`)
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

  if (error) throw await refused(error, 'shots')
  if (!data || data.length === 0) {
    throw await refused(new Error('Az esemény nem módosult.'), 'shots')
  }

  await changed(data[0].id, 'shots', { shots })

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
    .select('id, event_name, created_at')
    .eq('slug', slug)
    .maybeSingle()
  if (eventError) throw eventError
  if (!event) throw new Error('Nincs ilyen esemény.')

  // An album being prepared right now holds a lease on this event. Deleting
  // underneath it would cascade the job away mid-build and leave a ZIP in the
  // exports bucket with no row to expire it. Refuse while the lease is live
  // — bounded by the lease itself, so a worker that died cannot block a
  // deletion for longer than ten minutes. The read needs the service role:
  // `album_exports` has no policies, by design.
  const { data: inFlight, error: inFlightError } = await createAdminClient()
    .from('album_exports')
    .select('id')
    .eq('event_id', event.id)
    .eq('status', 'processing')
    .gt('locked_until', new Date().toISOString())
    .limit(1)
  if (inFlightError) throw inFlightError
  if (inFlight && inFlight.length > 0) {
    throw new Error('Még készül az album. Várd meg, és utána próbáld újra.')
  }

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

  // Reported after the rows are gone, and only then — a deletion that threw
  // halfway is not a deletion. Nothing about the album survives this, so the
  // count of objects and the age of the event are the only two things left
  // that can say what was lost. An album erased days after a wedding and one
  // erased minutes after a mistaken creation are the same row in the database
  // and completely different news.
  //
  // The name goes nowhere near this. The event id is about to stop resolving
  // to anything, which is what makes it safe to keep: it joins this to the
  // creation and the payment that came before it and to nothing else.
  await reportServerEvent('event_deleted', {
    event_id: event.id,
    object_count: paths.length,
    age_hours:
      Math.round(
        ((Date.now() - new Date(event.created_at).getTime()) / 3_600_000) * 10,
      ) / 10,
  })

  revalidatePath('/host')
  redirect('/host')
}
