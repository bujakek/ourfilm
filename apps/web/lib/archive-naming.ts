import { formatFileStamp } from './format'

/**
 * How the album ZIP names and orders its entries.
 *
 * Extracted from the export route so the rules have one home that any runtime
 * can import: the Vercel route today, the browser and the export worker
 * planned in `docs/public-cdn-and-export-worker.md` tomorrow. Nothing here may
 * reach for `server-only`, React or a Supabase client — the whole point is
 * that the naming of a couple's archive is a pure function of the rows, and
 * two runtimes producing differently-named archives with no error anywhere is
 * exactly the drift this file exists to rule out.
 *
 * `tests/unit/fixtures/archive-naming.json` pins the output. Change a rule
 * here and that fixture is where the change has to be visible.
 */

/** The minimum a row has to carry to be named. `HostPhoto` satisfies it. */
export type ArchivePhoto = {
  id: string
  taken_at: string | null
  created_at: string
  hidden_at: string | null
  /** The participant's display name; null when the join is missing, in
   *  which case the entry simply carries no name segment. No placeholder:
   *  a word like "Vendég" is copy, and copy has a locale. */
  uploaderName: string | null
}

/**
 * Oldest first, so the numbering follows the order the night actually
 * happened in — which is `taken_at`, not `created_at`. Guests shoot all
 * evening and upload in a batch the next morning, so upload order would
 * number one guest's whole camera roll as if the night were theirs alone.
 * `created_at` is the fallback for photos whose file carried no EXIF, and the
 * tiebreak, so two frames from the same second keep a stable order.
 *
 * Returns a new array; the input is not touched.
 */
export function sortForArchive<T extends ArchivePhoto>(
  photos: readonly T[],
): T[] {
  const when = (photo: T) => Date.parse(photo.taken_at ?? photo.created_at)
  return [...photos].sort(
    (a, b) =>
      when(a) - when(b) || Date.parse(a.created_at) - Date.parse(b.created_at),
  )
}

/**
 * One entry's name inside the archive: `rejtett/007-2026-08-15_1432-Réka.jpg`.
 *
 * - The 3-digit index is the position in the *sorted* album, 1-based, so a
 *   folder listing reads in the order the night happened.
 * - The capture time goes in the name too, not only in the entry's date: a
 *   file dragged out of the folder keeps its place in the day, and the couple
 *   can still tell when a shot was taken years from now. Rendered in the
 *   event's zone, never the server's — Vercel runs UTC, so a photo taken at
 *   14:32 in Budapest would otherwise be named 1232.
 * - Hidden photos ship too, but in their own folder: the host keeps everything
 *   without a moderated shot turning up among the rest.
 * - The name is reduced to letters and digits from any script, runs of
 *   anything else collapsing to one hyphen. `\p{L}` rather than `a-z` is the
 *   difference between `Kovács-Réka` and `Kov-cs-R-ka`. A photo with no name
 *   gets no name segment at all rather than a placeholder — a placeholder is
 *   a word in some language, and the archive has no locale to pick one in.
 */
export function archiveEntryName(
  photo: ArchivePhoto,
  index: number,
  zone: string,
): string {
  const n = String(index + 1).padStart(3, '0')
  const who = photo.uploaderName
    ? `-${photo.uploaderName.replace(/[^\p{L}\p{N}]+/gu, '-')}`
    : ''
  const folder = photo.hidden_at ? 'rejtett/' : ''
  const stamp = photo.taken_at
    ? `-${formatFileStamp(photo.taken_at, zone)}`
    : ''
  return `${folder}${n}${stamp}${who}.jpg`
}

/** Sort, then name every entry — the two steps every consumer takes together. */
export function archiveEntryNames<T extends ArchivePhoto>(
  photos: readonly T[],
  zone: string,
): { photo: T; name: string }[] {
  return sortForArchive(photos).map((photo, index) => ({
    photo,
    name: archiveEntryName(photo, index, zone),
  }))
}
