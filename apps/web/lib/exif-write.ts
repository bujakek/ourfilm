/**
 * The web app's face of the EXIF splice.
 *
 * The bytes live in `@ourfilm/shared/exif-splice`, shared with the export
 * worker so two runtimes cannot stamp archives differently. What stays here
 * is the one function that knows about zones: rendering an instant in the
 * event's own zone is `lib/format.ts`'s job, and the shared module refuses to
 * learn it.
 */
// The explicit .ts extension is load-bearing, not a slip: it is what lets bare
// `node` import this module, and `pnpm test:exif` round-trips what is written
// here back through the reader. Dropping it to match the repo's other imports
// silently kills that test.
import { eventStamp, eventUtcOffset } from './format.ts'
import { exifDateSegmentFrom } from '@ourfilm/shared/exif-splice'

export { exifDateSegmentFrom, withExifDate } from '@ourfilm/shared/exif-splice'

/**
 * An APP1 segment carrying the capture time and nothing else.
 *
 * Both `DateTimeOriginal` and `DateTimeDigitized` are written, plus IFD0's
 * `DateTime`, because readers disagree about which one they trust — Photos
 * reads the first, some desktop tools only ever look at the last. Each gets its
 * matching offset tag, so the wall clock is not left to be guessed at.
 */
export function exifDateSegment(iso: string, timeZone?: string): Uint8Array {
  // The event's own zone, not the server's. A capture stamp and its offset are
  // the two halves of one fact, so both read from the same zone or the file
  // claims a time that disagrees with the offset beside it.
  return exifDateSegmentFrom(
    eventStamp(iso, timeZone),
    eventUtcOffset(iso, timeZone),
  )
}
