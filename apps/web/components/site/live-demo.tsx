import { LiveDemoFallback } from './live-demo-fallback'

/**
 * The "try it" section.
 *
 * This used to read a real seeded sample album out of the database and fall
 * back to the hardcoded simulation when it could not. The disposable camera
 * pivot removed the RPCs it read through, and a sample album no longer makes
 * sense as a thing to link to: a camera has a capture window and a reveal, so a
 * permanently-open public demo event would be a fourth event state that exists
 * only for the marketing page.
 *
 * The fallback was always the designed behaviour for an unseeded database, so
 * the section looks exactly as it did. Kept as a seam rather than inlined into
 * the page: if a demo ever comes back, this is the one file that changes.
 */
export function LiveDemo() {
  return <LiveDemoFallback />
}
