# Image preparation in a Web Worker

**Status:** proposal, nothing built · **Written:** 2026-09-06 · **Validated
against the repo and revised:** 2026-09-10 (line references are as of commit
`02de33d`)

Every shot runs decode → resize → three JPEG encodes in `apps/web/lib/image.ts`.
This document proposes moving `compress` and `prepare` onto a Web Worker,
leaving reserve, upload and commit exactly where they are.

The 6 September draft of this plan was built around a constraint that turned
out not to exist — see §1 — and justified itself with a number that does not
measure what the change fixes — see §2. Both are corrected here, and §2 is now
the gate the whole project passes through before any of it is built.

---

## The problem

Preparation is the only CPU-heavy step in the product. On a phone it is
0.3–1.5 s of wall clock per photo, and while it runs, taps, animations and the
developing strip are competing with it for the main thread. It is worst on a
reload with stored shots: the queue drains them back to back the moment the
page hydrates, so the page looks open but does not respond until the backlog is
through.

The upload itself does not block anything — `fetch` is asynchronous — so the
thing to move is preparation, not transport.

## What the last 24 hours of production say

From the PostHog export of 5–6 September (19 shots, 15 of them on iPhones
running iOS 18.7 and 26.x, in both Safari and Chrome for iOS):

- **Every iPhone shot arrived as JPEG.** Zero HEIC. Input sizes were
  0.9–3.1 MB, median about 2 MB, which is a 12 MP JPEG; a HEIC of the same
  frame would be under half that. The live camera hand-off transcodes on the
  way out of the file input, so **libheif is not on the iPhone path at all.**
  It stays for Android phones that emit HEIC, as a rare case.
- Every shot was confirmed. Three hit a connection failure and both affected
  captures landed on retry in about 27 s. Typical shutter-to-confirmed time was
  under 2 s.

This is why the worker does not have to carry `heic-to`'s ~3 MB up front. It
becomes a lazy import inside the worker, and on the common path it is never
fetched.

---

## 1. Turbopack bundles workers correctly (settled — the old constraint is gone)

The comment at the top of `apps/web/lib/image.ts` records an August 2026 attempt
that concluded Turbopack emits `new Worker(new URL('./x.worker.ts',
import.meta.url))` as a **static `.ts` asset** rather than compiling it. The
6 September plan was built entirely around that constraint: a separate esbuild
step, a hashed file under `public/workers/`, a manifest, and `predev`/`prebuild`
integration.

**Re-run on Next 16.3.0 on 10 September, that conclusion does not hold.** A
throwaway worker with a relative import, built with `next build`, produced:

| Emitted                                    | What it is                                               |
| ------------------------------------------ | -------------------------------------------------------- |
| `static/chunks/turbopack-worker-<hash>.js` | the worker entry; `importScripts` its chunk list         |
| `static/chunks/<hash>.js`                  | the compiled, minified worker module, dependency inlined |
| `static/media/<name>.worker.<hash>.ts`     | the raw TypeScript — **not** what the Worker receives    |

The call site is rewritten to a runtime helper that hands the Worker
constructor the _entry chunk_, passing the chunk list through the URL hash. All
three chunks serve as `application/javascript`. `next dev` does the same thing.

The August observation was real; the conclusion drawn from it was not. The
`.ts` asset **is** emitted — it appears to be asset/source-map bookkeeping —
and stopping at "I see a `.ts` in `static/media`" is what produced the wrong
answer. Any future re-check must look at what the `new Worker` call site
actually receives, not at what exists in `static/media`.

Corroborating, in the installed docs: `turbopackWorkerAssetPrefix` is described
as a prefix for "Web Worker URLs (**entrypoint + module chunks**)", and magic
comments are documented as applying to `new Worker()` expressions. Neither
sentence makes sense unless workers are compiled.

**What this deletes from the plan:** the esbuild devDependency,
`scripts/build-worker.mjs`, the `predev`/`prebuild`/`verify` integration,
`public/workers/`, the hash manifest, and the deploy-skew failure mode the
manifest existed to prevent.

**What it introduces, and must be verified on a phone:** the runtime helper
strips `type: 'module'` and constructs a **classic** worker. So the HEIC lazy
import inside the worker is not a native `import()` — which a classic worker
rejects — but a Turbopack chunk load over `importScripts`. That should work and
was not part of the spike. It is on the device checklist below.

`apps/web/next.config.mjs:30` already sends `worker-src 'self' blob:`, so the
CSP needs no change. Update the comment in `apps/web/lib/image.ts` in the same
commit that adds the worker; leaving it would send the next person down the
same path.

---

## 2. Measure the block before building anything (the gate)

The 6 September plan justified one to two days of work with "0.3–1.5 s per
photo" drawn from `capture_preparation_slow`. That number does not measure the
thing a worker fixes.

`capture_preparation_slow` reports `outcome.ms` from `settle()` in
`apps/web/lib/upload-queue.ts` — wall clock across `materialize`, an IndexedDB
`put`, `compress`, and a second `put`. It is elapsed time, not main-thread block
time, and the two parts of `compress` that dominate it are already off the main
thread in both engines:

| Step                                   | Where it runs                            |
| -------------------------------------- | ---------------------------------------- |
| `createImageBitmap` (decode)           | browser's own thread                     |
| `createImageBitmap` with `resizeWidth` | browser's own thread                     |
| `ctx.drawImage`                        | main thread                              |
| `convertToBlob` (JPEG encode)          | engine-specific; Chromium offloads       |
| two `store.put` calls                  | IndexedDB, off-thread, counted in the ms |

So an unknown and possibly small fraction of that 0.3–1.5 s is recoverable by
changing threads.

**Before phase 3, land a `PerformanceObserver` on `longtask` around
preparation** and report the total blocked milliseconds beside the existing
`ms`. It is roughly twenty lines, it ships behind the telemetry that already
exists, and it either justifies the project with a real number or ends it. This
is the same standard the resize check in `resizedBitmap` and both `loading.tsx`
A/B tests in `CLAUDE.md` are held to: verify, never assume.

**Go / no-go:** if blocked time is a small fraction of elapsed time, stop after
phase 2 and keep the seam. The bridge is worth having on its own; the worker
behind it is not worth a day if there is no long task to move.

---

## 3. Scope

**In:** `compress` and `prepare` move to a worker.

**Out:** the upload. It fixes nothing observable — `fetch` is already off the
main thread, and once encoding is in the worker there is no long task left to
contend with. The server actions cannot move regardless: `reserveShotAction`
and `commitShotAction` are React client references that post to the page's own
URL with framework headers, so reserve and commit stay on the main thread
either way, and the upload would be the only network step in the worker,
sandwiched between two that are not. Moving it would also mean re-plumbing the
queue's timeouts and `AbortSignal` handling as messages and reproducing
`apps/web/lib/upload-failure.ts`'s judgement of "did the request leave the
phone" across the boundary — the code with the subtlest history in the product.

Revisit only if telemetry after phase 3 shows PUTs stalling while the main
thread is busy.

**Also out:** keeping the original file or its gain map (see §7); background
upload with the tab closed (not possible on iOS without a native shell; the
IndexedDB queue is the answer there); the reload double-count on the shutter
gate and the full-size preview in the strip, which are separate smaller fixes.

---

## 4. Design

```
 main thread                              worker (one per queue, lazy)
 ───────────                              ────────────────────────────
 createUploadQueue({                      onmessage: { kind, id, ... }
   compress: bridge.compress, ──────────▶   compress(file)  → master blob
   prepare:  bridge.prepare,  ──────────▶   prepare(stored) → full/view/thumb
   upload:   uploadShotRenders (unchanged)
   reserve / commit: server actions (unchanged)
 })
 bridge: capability check → worker or main-thread functions
         request/response by id, one in flight, timeout, respawn on error
```

- **`apps/web/lib/image-core.ts`** — the pure pipeline, extracted from
  `apps/web/lib/image.ts` with no `client-only` import: `decode`, `scaledSize`,
  `resizedBitmap`, `toJpeg`, `encodeAt`, `compressForStorage`,
  `prepareStoredShot`. Both the worker and the main-thread fallback import this
  one module, so there is exactly one implementation of the resize, the Safari
  `resizeWidth` size check and the encoder settings. `apps/web/lib/image.ts`
  becomes the main-thread wrapper it is today, re-exporting.

  `toJpeg`'s non-`OffscreenCanvas` branch uses `document.createElement`, which
  has no meaning in a worker. It stays in `image-core.ts` and is simply never
  reached there, because the bridge's capability check requires
  `OffscreenCanvas` before it will use the worker at all.

- **`apps/web/workers/image.worker.ts`** — the worker entry. A message loop:
  `{ kind: 'compress' | 'prepare' | 'ping', id, payload }` in, `{ id, ok, result
| error }` out. `heic-to` is a lazy `import()` inside the worker, taken only
  when a HEIC arrives; the plain entry, not `heic-to/next`, because `/next`
  inlines its own worker and inside a worker there is no main thread to protect.

- **`apps/web/lib/image-bridge.ts`** — `createImageBridge()` returns
  `{ compress, prepare, dispose }` with the signatures the queue already takes.
  On first use it checks `typeof Worker`, `OffscreenCanvas` and a successful
  `ping` within 2 s; failing any, it returns the main-thread functions and never
  tries again for that page. One request in flight at a time (the queue already
  guarantees this; the bridge asserts it). A worker `error` or a timeout rejects
  the pending promise with a `WorkerDied` error, terminates and respawns; the
  queue's existing retry then re-runs the shot.

- **Wiring — two call sites, not one.** `apps/web/components/event/guest-event-view.tsx:392`
  and `apps/web/components/host/host-camera.tsx:80` both pass
  `compressForStorage` and `prepareStoredShot`. The host camera shoots the
  host's own roll on `scope: 'host'` and is easy to miss. Each gets its own
  bridge, disposed in the same cleanup that calls `queue.stop()`.

### 4.1 The error protocol is load-bearing

**Serialising errors "by name and message only" silently regresses prepare
telemetry, and this is the part of the design most likely to be got wrong.**

`apps/web/lib/prepare-error.ts` carries `step: 'decode' | 'encode'` on a
`PrepareError`, and two readers depend on it after the boundary:

- `prepareStepOf(error)` → `issue.step`, in `runCapture`
- `failureClass(error)` recurses into `error.cause` to name the _real_
  exception's class

Drop `step` and `cause` at `postMessage` and `isPrepareError` returns false, so
`failureClass` falls through to `error.name.toLowerCase()` and **every prepare
failure collapses into one `prepareerror` bucket with no step.** That is exactly
the diagnostic added to explain the two photos lost in September 2026.

So the worker serialises `{ name: 'PrepareError', step, causeName }` and the
bridge rebuilds that shape on the main side. Every check in this path is
deliberately duck-typed — `isPrepareError`, `isConnectionFailure`, supabase's
own `__isStorageError` — precisely so a reconstructed object works. Pin it in
the queue suite so a future protocol change cannot quietly flatten it again.

`WorkerDied` goes into `isConnectionFailure` in
`apps/web/lib/upload-failure.ts`: the server never heard about the shot, so the
attempt is refunded. It can only arise from `prepare`, but the branch is
harmless on the other stages.

### 4.2 What a dead worker costs at each call site

- **During `compress`** (inside `settle`) — benign. `settle` catches, reports a
  non-terminal `stage: 'prepare'` issue and leaves the raw row; `prepare` then
  runs the original pipeline from the original bytes. It costs a decode per
  attempt, never the photo.
- **During `prepare`** (inside `runCapture`, after the reservation) — this is
  the one that needs the `WorkerDied` refund, or four bad respawns delete a
  photo the server never saw.

### 4.3 Constraints that do not change

- **Strictly sequential.** A worker's bitmaps count against the same tab on
  iOS; memory moves, it does not shrink. Two decodes at once still take mobile
  Safari with them. The queue already enforces one at a time.
- **Older iPhones take the fallback.** `OffscreenCanvas` with a 2D context and
  `convertToBlob` need Safari 16.4 (March 2023). iOS 16 and older is under 1 %
  of active iPhones in 2026, but the fallback has to exist and be tested,
  because a guest whose upload silently fails is the one outcome this product
  cannot afford.
- **`readCaptureTime` is already isomorphic** (`apps/web/lib/exif.ts` touches no
  browser API), so it crosses into the worker unchanged.
- **Blobs cross `postMessage` by reference**, so sending a 2 MB file in and
  three Blobs back is close to free. `PreparedPhoto`'s `takenAt: Date` survives
  structured clone.
- Vitest/jsdom cannot run a worker, so the protocol is unit-tested as plain
  functions and the thread hop is verified on phones.

---

## 5. Phases

1. **Extract, no behaviour change.** Split `apps/web/lib/image-core.ts` out of
   `apps/web/lib/image.ts`; existing tests keep passing; `pnpm verify` green.
   Half a day.
2. **Bridge with fallback only.** `createImageBridge()` that always returns the
   main-thread functions, wired into **both** call sites. Proves the seam
   without a worker. Unit-tested. Half a day.
3. **Measure (§2).** `longtask` observation around preparation, shipped and left
   to collect for a day. **Go / no-go for phases 4–6.** Half a day.
4. **Worker.** Worker entry, capability check, respawn, the error protocol in
   §4.1, `WorkerDied` in `upload-failure.ts`, all with tests. No build step —
   see §1. Half a day to one day.
5. **Real devices.** Checklist below. One day, needs phones.
6. **Telemetry.** Add `thread: 'worker' | 'main'` to `capture_preparation_slow`
   and a `worker_unavailable` reason on the existing `upload_issue` shape, so
   the fallback rate is visible. No new PII; both are enums. Same day as 5.

   `apps/web/components/host/host-camera.tsx` has an empty `onIssue` and no
   `onPrepared`, so a host-side fallback is currently invisible. Give it the
   handlers or accept that the number is guest-only, but decide it rather than
   discover it.

The `browser-image-compression` question (§6) is answered during phase 4.

---

## 6. Encoder: ours or `browser-image-compression`

Both are legitimate for the master, and the worker plan is the same either way
because the encoder is one function behind the `compress` dependency.

Ours (`apps/web/lib/image.ts`, about sixty lines for the master) already carries
the stepped resize for the thumbnail and the Safari `resizeWidth` size check,
both there for documented reasons. Those two stay ours regardless — the library
produces one output per call. It decodes once and encodes three times from the
same bitmap.

`browser-image-compression` handles orientation, canvas-size limits, progress
and abort, and would replace the master step only. **One thing to test before
adopting it:** as read in its source, when no size target is given it keeps
iterating — 0.95× quality and 0.95× dimensions per pass, up to ten — whenever
the output is larger than the input. A phone JPEG re-encoded at a fixed quality
is usually a few percent larger than its input, so this would trigger on
ordinary shots and produce inconsistent quality between daylight and low-light
photos. It may be avoidable with a `maxSizeMB` above any plausible output; one
afternoon on a phone confirms it either way. Its own worker is a blob that
`importScripts` a self-hosted copy of the library, so adopting it means wrapping
its worker rather than replacing ours.

**Default is our encoder**, because it is already in the tree and tested. The
library only wins if the size loop is provably avoidable.

---

## 7. What the output looks like, and why colour is not the deciding factor

Observed on real phones: the master our encoder produces and the one
`browser-image-compression` produces are visually the same, and both look
flatter than the photo in the camera roll.

The reason is the **HDR gain map**. An iPhone JPEG carries a second image
telling an HDR screen how much brighter to render highlights; that is the
"spark" of the original. The canvas only ever sees tone-mapped SDR pixels, so
any canvas re-encode drops it — ours, the library's, any worker's. Display P3 is
a wider gamut for saturated reds and greens; it is correct to ask for and free
to keep, but next to the gain map loss it is a rounding error, which is exactly
what the side-by-side shows.

The only way to keep the gain map is to not re-encode: pass a JPEG through with
EXIF stripped at the byte level. **That is ruled out for this product** — the
original is not kept, on purpose, and the byte-level strip is fiddly because the
gain map is located by offsets that move when EXIF is removed. This plan does
not chase the original's look. Every render is a canvas re-encode, and the
choice of encoder is about control and quality under test, not colour.

---

## 8. Real-device checklist (blocks merge)

- iPhone on the current iOS and on the oldest Safari available (16.4 is the
  floor for the worker; anything older must take the fallback and still upload).
- Android Chrome, one mid-range device, including one that emits HEIC if
  available — the only path libheif still serves.
- **The HEIC lazy import inside the classic Turbopack worker** (§1). This is
  new and was not part of the bundling spike.
- Inputs: live JPEG capture on iPhone (the common case, per the export), a 48 MP
  HEIC via a test page for the lazy import.
- Orientation correct for all four EXIF rotations.
- Output dimensions 3200 on the long edge; view 1600; thumb 400.
- Display P3 retained: JPEG ICC profile ~520 bytes, not 456 (sRGB). Kept because
  it is free, not because it is visible.
- No EXIF, no GPS in any render.
- Ten captures in a row without the tab being reclaimed; memory in Safari's Web
  Inspector stays flat between shots.
- Reload with five stored shots: shutter responsive within a second, strip
  animates while the backlog drains.
- Production build on a Vercel preview: the worker loads under the CSP, the
  network tab shows `/_next/static/chunks/turbopack-worker-<hash>.js` and its
  module chunks, no console CSP violation.
- Kill the worker mid-shot (DevTools → terminate): shot retries, attempt count
  unchanged, photo lands.
- A forced prepare failure still reports its `step` (`decode` / `encode`) and
  the real exception class through the worker (§4.1).
- Both cameras: the guest flow and `/host/events/<slug>`.

---

## References

- Turbopack worker bundling verified locally on Next 16.3.0, 10 September 2026:
  `next build` and `next dev` both emit `turbopack-worker-<hash>.js` plus
  compiled module chunks; the `.ts` in `static/media` is not what the Worker
  constructor receives.
- Next.js Turbopack docs, `turbopackWorkerAssetPrefix` and worker magic
  comments: `node_modules/next/dist/docs/01-app/03-api-reference/08-turbopack.md`
- OffscreenCanvas `convertToBlob`, Safari 16.4 floor:
  https://developer.mozilla.org/en-US/docs/Web/API/OffscreenCanvas/convertToBlob
- `createImageBitmap` in workers with `imageOrientation`:
  https://developer.mozilla.org/en-US/docs/Web/API/WorkerGlobalScope/createImageBitmap
- iOS version share, 2026: https://telemetrydeck.com/survey/apple/iOS/majorSystemVersions/
- `browser-image-compression` source, size loop and worker creation:
  https://github.com/Donaldcwl/browser-image-compression
- PostHog export, 5–6 September 2026: 19 shots, 0 HEIC, all confirmed.
