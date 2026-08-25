'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'

import {
  commitShot,
  releaseShot,
  reserveShot,
  type ShotRefusal,
  type SignedUpload,
} from '@/lib/capture'
import {
  joinEvent,
  newParticipantSession,
  readParticipantTokenHash,
  writeParticipantCookie,
} from '@/lib/participants'

/**
 * Everything a guest can do, and the only way they can do it.
 *
 * The guest browser holds no Supabase credentials for writing any more. It used
 * to insert its own `photos` row with the anon key, which meant the shot limit
 * would have been a suggestion — anyone could have opened a console and posted
 * a 37th frame. These actions hold the httpOnly session cookie, call
 * service-role RPCs, and are the entire write surface.
 *
 * Photo bytes still never pass through here. `reserve` hands back signed upload
 * URLs and the browser PUTs straight to Storage, which is what keeps a 2MB
 * upload off a serverless function.
 */

export type JoinState = {
  error: string | null
  /** Set when the free participant cap turned this guest away, so the page can
   *  render the explanation rather than a form that will fail again. */
  capReached?: boolean
}

/**
 * Join an event and open the camera.
 *
 * The cookie is minted here and never leaves the server: `writeParticipantCookie`
 * sets it httpOnly, so the page that follows cannot read the token it was
 * identified by. That is the difference between this and the name cookie it
 * replaced, which client JavaScript wrote and could therefore forge.
 */
export async function joinEventAction(
  _prev: JoinState,
  formData: FormData,
): Promise<JoinState> {
  const slug = String(formData.get('slug') ?? '').trim()
  const name = String(formData.get('name') ?? '').trim()

  if (!slug) return { error: 'Hiányzó esemény.' }
  if (!name) return { error: 'Írd be a neved.' }

  // A fresh token per join. A guest re-joining on the same device gets a new
  // cookie and, because the RPC upserts on the *old* hash only if it matches,
  // a new participant row — which is why the form is only shown to someone who
  // has no usable cookie in the first place.
  const session = newParticipantSession()
  const result = await joinEvent({ slug, name, session })

  if (!result.ok) {
    if (result.reason === 'cap_reached') {
      return {
        error:
          'Ez az ingyenes esemény legfeljebb 5 résztvevővel használható. ' +
          'Kérd meg a szervezőt, hogy oldja fel a teljes eseményt.',
        capReached: true,
      }
    }
    if (result.reason === 'not_found') return { error: 'Nincs ilyen esemény.' }
    return { error: 'Írd be a neved.' }
  }

  await writeParticipantCookie(slug, session.token)

  // The cookie is read on the server, so the browser has to fetch a new render
  // to see anything change. That navigation happens **here**, not in an effect
  // on the client.
  //
  // The form used to watch for a successful action state and call
  // `router.refresh()`. That is a worse shape for the same job: `useActionState`
  // hands back a fresh state object on every render, so an effect keyed on it
  // has no stable resting point, and the success path ends up depending on
  // render timing rather than on the action having succeeded. Redirecting from
  // the action is unambiguous and terminal.
  revalidatePath(`/e/${slug}`, 'layout')
  // Outside any try/catch: redirect() signals by throwing.
  redirect(`/e/${slug}/camera`)
}

export type ReserveState =
  | {
      ok: true
      photoId: string
      shotsRemaining: number
      uploads: {
        full: SignedUpload
        view: SignedUpload
        thumb: SignedUpload
      }
    }
  | { ok: false; refusal: ShotRefusal }

/**
 * Claim one frame off this guest's roll.
 *
 * The count comes back from the database, which is the only place it is real.
 * The camera renders whatever this returns and never its own arithmetic.
 */
export async function reserveShotAction(
  eventId: string,
  idempotencyKey: string,
): Promise<ReserveState> {
  const tokenHash = await readParticipantTokenHash()
  if (!tokenHash) return { ok: false, refusal: 'no_session' }

  const result = await reserveShot({ eventId, tokenHash, idempotencyKey })
  if (!result.ok) return { ok: false, refusal: result.refusal }

  return {
    ok: true,
    photoId: result.shot.photoId,
    shotsRemaining: result.shot.shotsRemaining,
    uploads: result.shot.uploads,
  }
}

/** Mark a frame's renders as landed. Returns the authoritative count. */
export async function commitShotAction({
  slug,
  photoId,
  width,
  height,
  byteSize,
  takenAt,
}: {
  slug: string
  photoId: string
  width: number
  height: number
  byteSize: number
  takenAt: string | null
}): Promise<{ committed: boolean; shotsRemaining: number }> {
  const tokenHash = await readParticipantTokenHash()
  if (!tokenHash) return { committed: false, shotsRemaining: 0 }

  const result = await commitShot({
    photoId,
    tokenHash,
    width,
    height,
    byteSize,
    takenAt,
  })

  // The gallery may already be open — an instant-reveal event shows photos as
  // they arrive — so its cache has to drop. The camera page itself does not:
  // it is driven by the count this call returns.
  if (result.committed) revalidatePath(`/e/${slug}/gallery`)

  return result
}

/**
 * Give a frame back after a failed upload.
 *
 * Best effort. The reservation expires by itself after ten minutes, so this
 * only makes the common case immediate — a guest whose upload just failed is
 * usually about to press the shutter again.
 */
export async function releaseShotAction(photoId: string): Promise<void> {
  const tokenHash = await readParticipantTokenHash()
  if (!tokenHash) return
  await releaseShot({ photoId, tokenHash })
}
