/**
 * The product facts the legal copy is allowed to state, each with the code
 * that proves it.
 *
 * The supplied legal draft offered alternative sentences for four behaviours
 * and told us to pick only the one the implementation demonstrates. Recording
 * the choice as data — rather than as a paragraph someone once decided to
 * paste — means a change to the pipeline can be made to fail a test rather
 * than silently turn a legal page into a false statement.
 *
 * No clocks, no environment, no imports: this is a set of claims about the
 * code, and it is read by the copy modules and by `tests/unit/legal-copy`.
 */

/**
 * When a frame stops being available to the guest.
 *
 * `after_upload`. `reserve_shot` inserts a `pending` row that counts against
 * the roll, but `participant_shots_used()` stops counting it once
 * `shot_reservation_ttl()` (10 minutes) has passed, and
 * `releaseShotAction` hands it back immediately when an upload fails. Only a
 * `commit_shot` — which happens after the three renders are in Storage —
 * makes the spend permanent. Retrying with the same `idempotency_key`
 * re-claims the same frame rather than spending another.
 */
export const SHOT_CONSUMPTION: 'after_upload' | 'at_capture' = 'after_upload'

/**
 * Whether a guest sees the shot before it is committed.
 *
 * `none`. `components/event/camera-view.tsx` grabs a bitmap straight off the
 * video element and uploads it; there is no preview surface and no retake
 * control anywhere in the guest flow. This is the format, not an omission.
 */
export const RETAKE_SUPPORT: 'none' | 'supported' = 'none'

/**
 * Where the live camera image goes.
 *
 * `local_only`. `getUserMedia` feeds a `<video>` element, `createImageBitmap`
 * reads a frame from it, and `lib/image.ts` encodes it on the device. Nothing
 * streams anywhere: the only bytes that leave the phone are the three JPEG
 * renders PUT to Supabase Storage after `reserve_shot` has agreed to a frame.
 */
export const CAMERA_STREAM: 'local_only' | 'server_assisted' = 'local_only'

/**
 * What happens to EXIF, including GPS.
 *
 * `stripped`. `lib/image.ts` re-encodes every render through a canvas, which
 * cannot carry metadata across — the capture time is lifted out first by
 * `lib/exif.ts` and stored as a column instead. `assertNoExifMetadata()` in
 * `lib/image.ts` re-checks the encoded bytes before upload, and
 * `tests/unit/exif-strip.test.ts` runs that guard against a real JPEG
 * carrying DateTimeOriginal and GPS coordinates.
 *
 * The one thing ever written back is a time-only APP1 segment on ZIP export
 * (`lib/exif-write.ts`), which contains no GPS tags and no code that could
 * produce one.
 */
export const IMAGE_METADATA: 'stripped' | 'retained' = 'stripped'

/**
 * Whether anything non-essential is stored in the visitor's browser.
 *
 * `essential_only`, so no consent banner. The inventory:
 *
 * - Supabase auth cookies (`sb-*`) — the host's signed-in session.
 * - `ourfilm_participant` — the guest's httpOnly session token, which is what
 *   makes a roll of film belong to somebody.
 * - `ourfilm:event-draft:v1` — the create flow's answers, in `localStorage`,
 *   on the visitor's own device until they ask for it to be saved.
 * - `ourfilm:upsell-dismissed` — a dismissed banner.
 * - `ourfilm:guest-legal:*` — which version of the guest terms this device has
 *   acknowledged, so the notice is not shown before every shot.
 *
 * Vercel Web Analytics is enabled in production (`app/layout.tsx`). It is
 * cookieless and page-level, which is why it does not move this flag — but it
 * is the one entry worth re-checking if the analytics configuration ever
 * changes.
 */
export const CLIENT_STORAGE: 'essential_only' | 'has_non_essential' =
  'essential_only'

/**
 * Whether the retention rule the ÁSZF states is actually executed.
 *
 * The states, the warning email and the deletion are implemented
 * (`lib/retention.ts`, `app/api/retention/run/route.ts`) and are idempotent —
 * but nothing on a deployed environment calls the endpoint yet. Until a Vercel
 * Cron entry exists and `RETENTION_CRON_SECRET` is set, the rule is written
 * down and not enforced, which is a launch blocker rather than a copy problem.
 */
export const RETENTION_SCHEDULER: 'implemented_unscheduled' | 'scheduled' =
  'implemented_unscheduled'
