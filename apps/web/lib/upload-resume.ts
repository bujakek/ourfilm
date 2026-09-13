/**
 * Where a retried capture picks up.
 *
 * A capture is reserve → three PUTs → commit, and a retry used to repeat all
 * of it. This is the whole of the decision that replaced that, as a pure
 * function over two things: what `reserve_shot` reported about the row and
 * its objects, and the shot the device is holding.
 *
 * The server's report is the only input about progress, deliberately. The
 * endings this exists for are answers the device never received — a PUT that
 * landed after the timeout, a commit whose response was lost — so a checkpoint
 * kept on the device would be wrong in exactly the cases that matter.
 *
 * No `server-only` or `client-only` import: `lib/capture.ts` reads the row with
 * `reservationProgress`, and the queue decides with `planResume`.
 */

export type RenderKind = 'full' | 'view' | 'thumb'

export const RENDER_KINDS: readonly RenderKind[] = ['full', 'view', 'thumb']

export type ReservationProgress = {
  status: 'pending' | 'ready'
  /** Byte size of each render already in Storage; null where there is none. */
  stored: Record<RenderKind, number | null>
}

/** The columns `reserve_shot` returns for it. Optional: an older database has
 *  none of them, and that must read as "unknown", never as "nothing stored". */
export type ProgressRow = {
  photo_status?: string | null
  full_bytes?: number | null
  view_bytes?: number | null
  thumb_bytes?: number | null
}

export function reservationProgress(
  row: ProgressRow,
): ReservationProgress | null {
  const status = row.photo_status
  if (status !== 'pending' && status !== 'ready') return null
  return {
    status,
    stored: {
      full: size(row.full_bytes),
      view: size(row.view_bytes),
      thumb: size(row.thumb_bytes),
    },
  }
}

/** An object with no size, or a size of zero, is one worth sending again. */
function size(value: number | null | undefined): number | null {
  return typeof value === 'number' && Number.isFinite(value) && value > 0
    ? value
    : null
}

export type ResumeShot = {
  compressed: boolean
  blobSize: number
  width: number | null
  height: number | null
}

/** What the commit needs about the master, when it is known without a decode. */
export type MasterFacts = { width: number; height: number; byteSize: number }

/**
 * - `committed` — the row is `ready`. Its commit went through on an earlier
 *   attempt and the answer never came back. Nothing is sent again; re-sending
 *   would overwrite objects the CDN may already be serving.
 * - `commit` — all three renders are in Storage. Only the commit is left.
 * - `upload` — `renders` still have to go up. `decode` says whether the
 *   master has to be decoded for them (a view or thumb among them, or a raw
 *   row); `master` is null when only a decode can say what it is.
 */
export type ResumePlan =
  | { kind: 'committed' }
  | { kind: 'commit'; present: number; master: MasterFacts }
  | {
      kind: 'upload'
      present: number
      renders: RenderKind[]
      decode: boolean
      master: MasterFacts | null
    }

export function planResume(
  progress: ReservationProgress | null | undefined,
  shot: ResumeShot,
): ResumePlan {
  if (progress?.status === 'ready') return { kind: 'committed' }

  // A raw row is decoded again on every attempt, and each decode is a
  // different master of a different size: nothing in Storage can be matched
  // to it. The queue writes the master it prepares back to the store, so this
  // lasts one attempt.
  const master =
    shot.compressed && shot.width !== null && shot.height !== null
      ? { width: shot.width, height: shot.height, byteSize: shot.blobSize }
      : null

  if (!progress || !master) {
    return {
      kind: 'upload',
      present: 0,
      renders: [...RENDER_KINDS],
      decode: true,
      master,
    }
  }

  const renders = RENDER_KINDS.filter((kind) => {
    const stored = progress.stored[kind]
    if (stored === null) return true
    // The master goes up as the exact bytes on disk, so a size that differs is
    // a different master. View and thumb are re-encoded every attempt, and any
    // complete one will do.
    return kind === 'full' && stored !== master.byteSize
  })
  const present = RENDER_KINDS.length - renders.length

  if (renders.length === 0) return { kind: 'commit', present, master }
  return {
    kind: 'upload',
    present,
    renders,
    decode: renders.some((kind) => kind !== 'full'),
    master,
  }
}
