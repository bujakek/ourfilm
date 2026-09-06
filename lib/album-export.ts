import { createHash } from 'node:crypto'

/**
 * Keep one streamed Vercel response comfortably below Hobby's five-minute
 * wall-clock limit. At 220 MiB a part needs ~6.2 Mbit/s to transfer in 300s,
 * before allowing for the much faster Storage -> Vercel hop. The margin is
 * intentional: a wedding export must fail as one small part, never as a
 * multi-gigabyte archive after the browser has already spent minutes on it.
 */
export const EXPORT_PART_TARGET_BYTES = 220 * 1024 * 1024

/** Older rows can predate byte_size. Budget them pessimistically rather than
 * letting an unknown master make a supposedly small part unexpectedly huge. */
export const UNKNOWN_PHOTO_BYTES = 6 * 1024 * 1024

/** ZIP local/central headers plus the small EXIF date segment we add at export.
 * JPEGs are already compressed, so client-zip stores them rather than trying to
 * squeeze them again; this overhead is deliberately conservative. */
const ZIP_ENTRY_OVERHEAD_BYTES = 2 * 1024

type ChronologicalPhoto = {
  id: string
  created_at: string
  taken_at: string | null
}

type SizedPhoto = {
  byte_size: number | null
}

export type AlbumExportItem<T> = {
  /** Zero-based position in the complete album, used for stable filenames. */
  albumIndex: number
  photo: T
}

export type AlbumExportPart<T> = {
  /** One-based part number shown to the host and used in the URL. */
  number: number
  estimatedBytes: number
  items: AlbumExportItem<T>[]
}

export function estimatedExportBytes(photo: SizedPhoto): number {
  const stored =
    photo.byte_size !== null && photo.byte_size > 0
      ? photo.byte_size
      : UNKNOWN_PHOTO_BYTES
  return stored + ZIP_ENTRY_OVERHEAD_BYTES
}

/** The ZIP numbering follows when each shutter fired, not when it uploaded. */
export function orderPhotosForExport<T extends ChronologicalPhoto>(
  photos: readonly T[],
): T[] {
  const when = (photo: T) => Date.parse(photo.taken_at ?? photo.created_at)
  return [...photos].sort(
    (a, b) =>
      when(a) - when(b) || Date.parse(a.created_at) - Date.parse(b.created_at),
  )
}

/**
 * Greedy, chronological size-bounded parts. A single unexpectedly huge file is
 * allowed to exceed the target rather than being dropped; every normal phone
 * master is orders of magnitude below it.
 */
export function planAlbumExport<T extends SizedPhoto>(
  ordered: readonly T[],
  targetBytes = EXPORT_PART_TARGET_BYTES,
): AlbumExportPart<T>[] {
  if (ordered.length === 0) return []

  const parts: AlbumExportPart<T>[] = []
  let items: AlbumExportItem<T>[] = []
  let estimatedBytes = 0

  const flush = () => {
    if (items.length === 0) return
    parts.push({
      number: parts.length + 1,
      estimatedBytes,
      items,
    })
    items = []
    estimatedBytes = 0
  }

  ordered.forEach((photo, albumIndex) => {
    const bytes = estimatedExportBytes(photo)
    if (items.length > 0 && estimatedBytes + bytes > targetBytes) flush()
    items.push({ photo, albumIndex })
    estimatedBytes += bytes
  })
  flush()

  return parts
}

/**
 * Detects an album changing between opening the download screen and clicking a
 * later part. This is consistency, not authorization, so a short digest is
 * enough: if another photo arrives we send the host back for a fresh plan
 * instead of silently shifting part boundaries and duplicating/skipping files.
 */
export function albumExportSnapshot(
  ordered: readonly Pick<ChronologicalPhoto, 'id'>[],
): string {
  return createHash('sha256')
    .update(ordered.map((photo) => photo.id).join('\n'))
    .digest('hex')
    .slice(0, 20)
}
