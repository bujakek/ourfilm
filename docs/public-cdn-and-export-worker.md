# Public photo CDN, and moving album export off Vercel

**Status:** Phases 1 and 1.5 merged; Phase 2 built on `feat-export-worker` and proven end to end on the local stack — browser path, schema and RPCs, the six endpoints, the worker, the album-ready mail, the pg_cron sweep and the host UI. Not yet done: the manual setup in §2.9, the stress test at real size, the cutover (`OURFILM_EXPORT_WORKER=true`) and removing the old route · **Written:** 2026-09-07 · **Validated
against the repo and revised:** 2026-09-08 (line references are as of commit
`d28f2bc`)

Three phases, deliberately unequal in risk.

- **Phase 1** turns `event-photos` from a private bucket read through signed
  URLs into a **public bucket read through stable CDN URLs**. It touches the
  whole read path, the privacy policy and two database tests. It ships before
  the first paid weddings.
- **Phase 1.5** moves the Next app to `apps/web` so the repository root stops
  being "the Next app" before a second runtime arrives. One PR, mostly
  documentation.
- **Phase 2** takes ZIP generation off Vercel and puts it in a Railway worker
  that writes finished archives to a **private** `event-exports` bucket.

**Phase 2 depends on Phase 1**, and deliberately so: the worker holds no
Supabase credential at all and fetches masters from the public photo bucket by
URL. That is what keeps it a pipe rather than a second service with read access
to every album (§2.6). Phase 1 is also the urgent one — if it slips, everything
slips, which is the right coupling to have.

Phase 1 is the only irreversible step in the document. Once an object URL has
been served publicly you cannot un-serve it: flipping the bucket back stops new
URLs working and does nothing about a link already in a WhatsApp thread.
Everything in Phase 2 is recoverable — the ZIP is derived data, the Vercel
exporter stays as a fallback, and a failed worker means "the download is slow
today", never a lost photo.

---

## The decision, and what it costs

Photo delivery moves to public, unexpiring, CDN-cacheable object URLs. This is
settled and not re-opened here. A signed URL's cache key includes its token, so
every render mints a URL that no other viewer's cache can hit; a public URL is
one cache key per object for every guest at the wedding.

The bucket becomes the **delivery** layer. The RPCs stay the **discovery and
authorization** layer: `event_gallery_by_slug` keeps its `now() >= e.reveal_at`
clause, `guests_can_view`, `status = 'ready'` and `hidden_at is null` filters,
and remains the only thing that decides which paths a guest is ever told about.

What is knowingly given up:

| Property                         | Before                      | After                        |
| -------------------------------- | --------------------------- | ---------------------------- |
| A leaked photo URL               | dies within the hour        | works forever                |
| Hiding a photo                   | revokes access to the bytes | removes it from the app only |
| A guest's own master, pre-reveal | unreachable                 | reachable (see §1.3)         |
| Enumerating an album             | impossible                  | still impossible             |

The last row is the one that holds this together and must not be eroded:
`photoId` is a v4 uuid, `event_gallery_by_slug` returns nothing before the
reveal, and there is **no anon `select` policy on `storage.objects`**, so the
bucket cannot be listed. A public bucket means "anyone holding this exact URL
may GET it", not "anyone may find out what URLs exist."

---

## Decisions taken

Both were open; both are now closed. Recorded here with what they cost, because
each removes a property the system currently has.

### D1 — the three renders stay derivable from one another. **Accepted.**

`apps/web/lib/storage.ts:16-20` (and `reserve_shot`, which mints the same shape) lay the
renders out as `{eventId}/{photoId}.jpg`, `_view.jpg`, `_thumb.jpg`, so any URL
for one is a URL for all three by string edit. No path change; no migration.

What that costs, and what to do about it:

- **`20260902100000_guest_own_frames.sql:22` becomes untrue and must be
  rewritten.** It names as load-bearing that `my_frames` returns `thumb_path`
  only, so the endpoint "cannot hand out the master". After the flip it can:
  `my_frames` is deliberately not reveal-gated, so a guest watching their own
  52px strip (`apps/web/components/event/film-strip.tsx:129-133`) can delete `_thumb`
  from that URL and fetch their own 3200px master before the album develops.
  Delete constraint #2 and say plainly what is true instead — the endpoint
  returns only the thumb path, and the object layout makes the other renders
  reachable from it. The same comment still says "4096px master"; the master
  has been 3200px since September 2026, so fix that in the same rewrite.
- **No test.** A test asserting the master _is_ reachable documents nothing
  useful and reads as an invitation. The migration comment is the record.
- **The customer-facing claim survives; the internal one does not.** "No preview
  and no retakes" stays true in the sense a guest reads it: there is no preview
  surface, and `reserve_shot` spends a frame per shutter press whatever anyone
  does with a URL. What stops being true is CLAUDE.md's stronger framing that
  this is a property of the system rather than of the UI. Adjust that sentence;
  leave the marketing copy alone.

### D2 — permanent per-photo delete. **Deferred to a follow-up.**

`setPhotoHidden` writes `hidden_at` and nothing else
(`apps/web/app/(product)/host/events/[slug]/actions.ts:117`), and the only product code
that removes Storage objects is whole-event deletion (`deleteEvent`,
`:376-477`). The one other caller of `storage.remove` is the operator script
`apps/web/scripts/reset-data.ts:150`, which is the closer precedent for the takedown
script below than `pnpm grant` is. None of that changes in Phase 1. CLAUDE.md's
"never hard-delete" rule therefore stays as it is, and no amendment is needed
yet.

**What this means after the flip:** hiding a photo removes it from the app and
from nothing else. A URL anyone has ever held keeps working. The only actual
removal is deleting the entire event.

> **One piece of this cannot wait for the follow-up.** The published terms and
> privacy notice promise _removal_, not hiding:
>
> - `apps/web/app/[locale]/adatvedelem/page.tsx:125` / `:186` — "A szülő vagy törvényes
>   képviselő ... kérheti a kép elrejtését **vagy eltávolítását**" / "a parent or
>   guardian may request that a photo be hidden **or removed**."
> - `:111` — the same offer for anyone pictured.
> - `apps/web/app/[locale]/aszf/page.tsx:168` — "We may hide, **remove** or restrict
>   content".
> - `apps/web/app/[locale]/kapcsolat/page.tsx:167` — the takedown form calls the host
>   "aki azonnal elrejtheti a képet" the fastest remedy.
>
> Today `hidden_at` plus a private bucket effectively delivers removal: no new
> signature is minted and any existing one dies within the hour. After the flip
> it does not, and with D2 deferred the only way to honour a takedown — including
> a parent's request about a photo of their child — is to delete the couple's
> entire wedding album.
>
> **The cheapest fix is not D2.** It is an operator script, service-role only,
> alongside `pnpm grant`: given a photo id, remove the three objects and set
> `hidden_at`. No host UI, no product surface, no decision about tombstoning —
> perhaps an hour of work, and it is the difference between being able to answer
> a safeguarding request and not. Build that in Phase 1; build the host-facing
> version whenever the follow-up happens.

# Phase 1 — public photo bucket

## 1.1 Bucket migration (**not** "no migration needed")

`supabase/migrations/20260824174543_private_photo_bucket.sql:17` contains
`update storage.buckets set public = false where id = 'event-photos'`. Flipping
the flag in the dashboard without a migration leaves the repo asserting the
opposite of production, and — worse — `pnpm supabase db reset` recreates a
**private** bucket locally, so every public URL 400s in `next dev` and in
`pnpm test:db`, silently, as broken images.

New migration, e.g. `20260907xxxxxx_public_photo_bucket.sql`:

- `update storage.buckets set public = true where id = 'event-photos';`
- a comment stating why, what it costs (the table above), and what it does
  **not** change: no new policies, `anon` still cannot `LIST`, `INSERT`,
  `UPDATE` or `DELETE`, and the absence of an anon `select` policy is
  deliberate and load-bearing.

Idempotent, so it may land after the manual dashboard flip.

**Because Phase 1 has a migration, `pnpm test:db` is mandatory for it.**

## 1.2 Privacy policy — three sentences, two languages

`apps/web/app/[locale]/adatvedelem/page.tsx` currently tells customers the opposite of
what the system will do:

| Line        | Hungarian                                           | English twin                           |
| ----------- | --------------------------------------------------- | -------------------------------------- |
| :73 / :157  | "a fájlok pedig **nem nyilvános tárhelyen** vannak" | "photos are stored privately"          |
| :81 / :158  | "Supabase (adatbázis és **privát fájltárolás**)"    | "private file storage"                 |
| :118 / :185 | "a képek **privát tárhelyre** kerülnek"             | "We use HTTPS, **private storage**, …" |

:118/:185 is the Article 32 technical-measures disclosure. :73/:157 is the
paragraph a host reads to answer "how private is my album". All three become
false on deploy.

Rewrite all three in both locales **in the same change**, per CLAUDE.md's rule
that a change falsifying a live claim either honors it or updates the copy. The
honest replacement keeps what is still true: the link carries a long random
identifier, the page is `noindex`, which photos are shown is decided
server-side, and the files themselves sit behind unguessable addresses that do
not expire. Do not write "private storage" in any form.

The blog was checked and needs nothing: neither
`apps/web/content/blog/hu/eskuvoi-fotoalbum-adatvedelem.mdx` nor
`apps/web/content/blog/hu/legjobb-eskuvoi-qr-kodos-fotoalbumok.mdx` claims private
storage. The nearest sentence is a checklist item, "album nem nyilvános", about
choosing a private album setting, which stays true.

## 1.3 Replace signed reads with a deterministic URL builder

`apps/web/lib/photo-urls.ts` becomes a pure, synchronous builder. No network call, no
`createSignedUrl`, no `createSignedUrls`, no `READ_TTL_SECONDS`, no admin
client. Either `supabase.storage.from(PHOTO_BUCKET).getPublicUrl(path)` or a
plain string builder over `NEXT_PUBLIC_SUPABASE_URL` — the latter is preferable
because it needs no client instance in a Server Component.

Rewrite the file header: the current 20-line comment explains at length why the
bucket is private and becomes actively misleading.

**Every consumer**, all of which currently `await`:

| File                                                            | Use                                |
| --------------------------------------------------------------- | ---------------------------------- |
| `apps/web/lib/photos.ts:121`                                    | gallery photos (thumb + view)      |
| `apps/web/lib/photos.ts:163`                                    | moderation grid (thumb)            |
| `apps/web/lib/frames.ts:63`                                     | the guest's own film strip (thumb) |
| `apps/web/lib/events.ts:227`                                    | `/host` event previews             |
| `apps/web/app/(product)/e/[slug]/page.tsx:67`                   | event cover                        |
| `apps/web/app/(product)/host/events/[slug]/export/route.ts:103` | ZIP masters                        |

**A behaviour change to handle deliberately.** `signPhotoUrls` omits paths that
fail to sign, and `apps/web/lib/photos.ts:130` does `if (!thumbUrl || !viewUrl) return []`
— today a missing object is silently dropped from the gallery. A deterministic
builder always returns a URL, so a missing object becomes a broken `<img>`
instead. That is better (it is now visible), but `gallery_image_failed` becomes
the only signal and its meaning changes: it can no longer mean "a signed URL
expired". Update that row of the telemetry table in CLAUDE.md and expect the
event's baseline rate to move.

## 1.4 What must not change

- **No new Storage policies.** Public governs anonymous _read of a known
  object_. `anon` keeps no `LIST`, `INSERT`, `UPDATE` or `DELETE`, and there is
  still no anon `select` policy on `storage.objects` — one scoped to the bucket
  would let anyone walk every event id and photo id in the system.
- **The signed-upload write path is untouched.** `reserve_shot` → server action
  mints signed upload URLs (`apps/web/lib/capture.ts:110`) → phone PUTs → `commit_shot`.
- **No Supabase Image Transformations.** The phone still produces master /
  view / thumb at 3200·q90, 1600·q85, 400·q80.
- **`unoptimized` stays on every remote `<Image>`** (`photo-grid.tsx:143`,
  `lightbox.tsx:125`, `film-strip.tsx:133`, `moderation-grid.tsx:92`,
  `event-list.tsx:58`). Stable URLs make removing it newly _possible_, which
  would route wedding bytes through Vercel's optimizer — the opposite of the
  point. There is no `images.remotePatterns` work.
- **`force-dynamic`: nothing to remove.** Nine files carry it — the guest
  event page (`e/[slug]/page.tsx:20`), `host/page.tsx:11`,
  `host/events/[slug]/page.tsx:20`, its settings page (`:32`),
  `host/events/new/page.tsx:12`, `auth/event-complete/page.tsx:5`, the export
  route, and the auth-email and Stripe webhook routes — and none of them for
  signature freshness. The one sentence that ties the two together is
  `apps/web/lib/photo-urls.ts:21` ("pages that use this are already `force-dynamic`, so
  a fresh signature per render costs nothing extra"); it goes with the
  rewrite.
- **CSP needs no change.** `img-src 'self' data: blob: https://*.supabase.co`
  (`apps/web/next.config.mjs:22`) already covers the public route.

## 1.5 Cache headers: photos are done, the cover is not

`apps/web/lib/upload-shot.ts:46` already sets `cacheControl: '31536000'` on all three
renders, so **every existing customer object already carries a one-year
header**. No re-upload, no byte migration; verification is a URL check.

`attachEventCover` (`apps/web/app/(product)/host/events/new/actions.ts:411-425`) sets no
`cacheControl`, so covers get Supabase's default of one hour (not verified
here; check the response header) — the staleness window is an hour, not for
ever. Still, version the cover path:

- `coverStoragePath()` in `apps/web/lib/storage.ts` takes a fresh id:
  `{eventId}/cover-{uuid}.jpg`; the `cover_path` column already stores whatever
  it is given.
- Delete the old object after the `cover_path` write succeeds, not before.

Do it now: `attachEventCover` is reachable only from `createEvent`'s upload
branch and no picker is mounted anywhere, so `cover.jpg` is written exactly once
per event today. It gets much more expensive once a settings picker exists.

## 1.6 Export route — minimum change only

Phase 1 is not the ZIP redesign. Replace the batch-sign block
(`export/route.ts:88-115`, comment and call) with the URL builder and keep the
streaming generator exactly as it is. Delete the "signed in one batch up front"
comment and rewrite the stale header at `:19-21`, which already claims "the
bucket is public so objects fetch without credentials" — wrong today, right
afterwards, and a good illustration of why prose comments belong in the diff's
blast radius.

## 1.7 Tests — invert, do not delete

`apps/web/tests/db/storage.test.ts:48` (`is private`) and `:54` (`does not serve objects
over the public route`) will go red. Rewrite both as positive assertions: the
bucket reports `public: true`, and `/object/public/...` serves the object.

`:75` (`serves an object through a signed URL`) stays green on a public bucket
but exercises `createSignedUrl`, which Phase 1 deletes from the product. Remove
it with the builder; a passing test of a code path nothing uses is a false
comfort.

**Do not touch the other five.** They pin the half of the model that must not
move: anon cannot `INSERT` (`:98`), anon cannot `LIST` (`:125`), signed upload
still works (`:158`), a host cannot cross-read via listing (`:196`), a host can
list its own folder (`:223`). Deleting the `describe('the bucket')` block is
the failure mode to guard against.

Add: a test that the master path is or is not derivable from the thumb path,
whichever D1 decides — so the decision is pinned rather than implicit.

## 1.8 Phase 1 acceptance

| Check                                         | Expected                                |
| --------------------------------------------- | --------------------------------------- |
| Existing customer thumb / view / master       | public URL 200s                         |
| New guest upload                              | still succeeds (signed upload URL)      |
| Gallery before reveal                         | no photo paths returned                 |
| Gallery after reveal                          | photos load                             |
| Hide photo                                    | gone from the next gallery response     |
| Known URL of a hidden photo                   | still 200s — accepted, see §1.2 wording |
| Operator takedown script                      | all three objects actually removed      |
| Same thumb requested twice                    | byte-identical URL                      |
| Repeat CDN request                            | `cf-cache-status: HIT` eventually       |
| Master derivable from thumb                   | yes — accepted (D1-a)                   |
| Cover replaced                                | new URL, no stale image                 |
| Moderation grid, `/host` previews, film strip | render                                  |
| Existing ZIP download                         | still works, EXIF dates intact          |
| `supabase db reset` locally                   | public URLs still work (§1.1)           |

```bash
pnpm format
pnpm verify
pnpm supabase db reset && pnpm test:db   # mandatory: Phase 1 has a migration
```

## 1.9 Rollout

```
1. Code prepared and reviewed (migration, copy, builder, tests)
2. Dashboard: Storage → event-photos → Make public
3. Existing production keeps working — signed URLs are valid on a public bucket
4. Deploy
5. Verify against a real existing event
```

Zero downtime in both directions: a signed URL works on a public bucket, so
step 2 breaks nothing, and un-flipping the bucket is an instant rollback that
needs no redeploy.

**Human steps:** flip the bucket in the Supabase dashboard; confirm an
already-uploaded customer photo resolves over `/object/public/`; run the
acceptance list above against a real paid event.

---

# Phase 1.5 — repository restructure

Between Phase 1 shipping and the worker being written, and **in its own PR**.

```
/
  apps/
    web/        ← the current Next.js app, moved wholesale
    worker/     ← created in Phase 2, into the finished structure
  packages/
    shared/     ← created in Phase 2: exif-write.ts, and only that
  supabase/     ← migrations, config.toml, templates: infrastructure, not web
  package.json
```

The root stops being "the Next app". That is the point: once a second runtime
exists, a root full of `apps/web/next.config.mjs` and `apps/web/components.json` misdescribes the
repository.

**Sequenced here deliberately.** Do it during Phase 1 and every review diff in
the one irreversible phase is buried in renames. Do it during Phase 2 and 400
lines of new worker code move through a restructure at the same time. Between
them, the only thing that moves is the web app, and it moves alone.

**Imports survive; prose does not.** `@/*` is defined per package, so
`@/lib/...` inside `apps/web` keeps resolving and not one import line changes.
What breaks is the documentation: `CLAUDE.md` carries roughly 90 distinct
file-path references across about 95 lines, `AGENTS.md` is 824 lines, and the
three `.cursor/skills/*/SKILL.md` add 707 more. Those paths are this repository's
main asset for agent work. **Budget the doc sweep as the bulk of the task**, and
review it in a PR where it is the only thing to look at.

Two structural calls, both already made:

- **`supabase/` goes to the root** (or `packages/db`), never inside `apps/web`.
  Migrations, `config.toml` and the email templates are infrastructure both apps
  depend on. `scripts/test-db.mjs` and `scripts/check-supabase-types.mjs` follow
  it.
- **`packages/shared` waits for Phase 2, then holds exactly one module.** Under
  the worker design in §2.6 the shared surface is `exif-write.ts` and nothing
  else — the naming rules stay on Vercel. Do not create the package during this
  restructure with nothing in it; create it when the worker imports that file.

Also needs doing: re-point the Vercel project's root directory, and make sure
`apps/web/vercel.json`'s `fra1` pin lands where the new root expects it. Small, but it is
production configuration — another reason not to do this in the same week as the
bucket flip.

---

# Phase 2 — Railway ZIP worker

```
Host clicks Download
        ↓
   Vercel — auth, ownership, source_hash
        ↓
   ≤ 20 photos: the manifest goes back to the browser, which fetches the
   masters and zips them itself (client-zip). Done. Nothing below runs.
        ↓  > 20 photos
   Vercel — dedupe, enqueue
        ↓
   Supabase: album_exports row          (state + result, read by the host UI)
        ↓
   Worker polls Vercel for a job  ──────┐
        ↓                                │  JSON payload:
   fetches masters from the PUBLIC       │  ordered entries, each with a
   photo bucket — no credentials         │  URL, a finished filename and
        ↓                                │  a pre-formatted EXIF stamp,
   builds the ZIP on local disk —        │  plus one signed upload token
   size known — then resumable (TUS)     │
   upload, signed token, 6MB chunks ───┘
        ↓
   PRIVATE event-exports bucket
        ↓
   Vercel marks ready, emails the host
        ↓
   host opens /host/events/<slug>, which mints a fresh signed URL
        ↓
   pg_cron, every few minutes: expire, release stale leases,
   and call /api/exports/sweep for the deletes and email retries
```

The bytes stop passing through Vercel, and the five-minute streaming function
goes away.

## 2.0 Plan reality check — this is a Hobby project

The intention is to stay on Hobby as long as possible. Three of Vercel's Hobby
limits shape the design, and one of them means something is **already broken**.

| Limit                 | Hobby                               | Pro                                |
| --------------------- | ----------------------------------- | ---------------------------------- |
| Function max duration | **300s, default _and_ maximum**     | 300s default, 800s max, 1800s beta |
| Cron minimum interval | **once per day**, ±59 min precision | once per minute                    |
| Request/response body | 4.5 MB                              | 4.5 MB                             |
| Memory                | 2 GB / 1 vCPU                       | up to 4 GB / 2 vCPU                |

**The export route sets no `maxDuration` at all, and never has.** It exports
`dynamic = 'force-dynamic'` and `runtime = 'nodejs'` and nothing about
duration; git history shows no such line was ever there. The `1800` figure
comes from `docs/once-vs-ourfilm.md` (commit `d28f2bc`), which _recommends_
adding it — and on Hobby that recommendation would do nothing, because 300
seconds is both the default and the ceiling. So today the route runs at 300
seconds whichever plan the project is on, and the export streams at the speed
of the host's connection — a 2.4GB album on a 10 Mbps line gets about 375MB in
before a 504. **The album download is therefore already broken for any large
wedding**, and nobody has noticed because no real album has been exported yet.

(Nothing in the repository names the Vercel plan: `apps/web/vercel.json` carries only
the `fra1` pin, no `functions` block. "Hobby" here is what the owner says,
not something the code shows. Confirm it in the dashboard before repeating
the 300-second argument anywhere else.)

That reframes Phase 2. It is not an optimisation of a working feature — it is
the only way whole-album download works at all on this plan, and it has to land
before a wedding produces an album big enough to hit 300 seconds. Roughly: five
minutes of the host's bandwidth.

**Consequences carried through the rest of Phase 2:**

- The Vercel exporter kept as a fallback (§2.10) is a fallback **for small
  albums only**. Do not describe it to yourself as a safety net for the case
  that matters.
- The cleanup and email-retry sweep cannot be a Vercel Cron — once a day is not
  a retry policy for the most important email the product sends. It is a
  Supabase `pg_cron` job instead (§2.8), which also stops it depending on the
  worker being alive.
- Poll intervals and payload size have hard ceilings (§2.3).

**One non-technical flag, stated once.** Vercel's Hobby plan is for
non-commercial use, and this project has live Stripe keys in production. That is
a terms question rather than a technical one, and it is not addressed anywhere
in this document.

**The worker holds no Supabase credential and no database access.** It is a
pipe: give it a list of URLs and filenames, get a ZIP. Everything that requires
knowing what a photo _is_ — ordering, the `rejtett/` folder, guest names,
timezones, the reveal — stays on Vercel, in the main app, where it already
lives. Consequences, and they are most of why this shape was chosen:

- **The archive-naming logic never leaves `apps/web`.** Vercel computes the
  entry names and puts them in the payload, so there is no second
  implementation to drift.
- **No generated types in the worker**, because it reads no tables.
- **No service-role key on Railway.** A worker that could read every album in
  the system is a much larger thing to secure than one that fetches public URLs.
- **No S3 keys anywhere.** The upload is a resumable (TUS) upload authorised by
  a signed upload token — the same `createSignedUploadUrl` call `apps/web/lib/capture.ts`
  makes for every guest photo. The only Supabase credential in the whole path
  is the service role Vercel already holds (§2.6).
- **Phase 1 is what makes this cheap.** Once `event-photos` is public the worker
  needs no credential to read masters at all. Under the private bucket the
  payload would have carried signed read URLs that expire in an hour, while a
  large export can run longer.

What remains shared is the splice half of `exif-write.ts`, which moves to
`packages/shared` and is imported by both apps. Today the module does more
than that — `exifDateSegment(iso, timeZone?)` takes an ISO instant and an IANA
zone and formats the stamp itself — so the zone-aware formatting has to be
split off and kept on Vercel first (§2.6). What the worker then imports is
handed a pre-formatted `2026:06:14 18:32:10` and a `+02:00` offset and carries
no locale, no zone and no domain knowledge. One mechanical function, one
implementation.

## 2.1 Schema

`album_exports`: `id`, `event_id` (fk, `on delete cascade`), `status`
(`queued|processing|ready|failed|expired`), `source_hash`, `photo_count`,
`byte_size`, `storage_path`, `attempt_count`, `next_attempt_at`, `locked_at`,
`locked_until`, `notified_at`, `tus_upload_url` (nullable — the resumable
upload's URL, reported by the worker so a re-claimed job continues from the
last confirmed offset instead of starting over, §2.6),
`created_at`, `started_at`, `completed_at`, `expires_at`, `last_error_code`.
Store `storage_path`, never a signed download URL.

**The table stays even though the worker never reads it.** It is not the queue —
it is the state the host UI polls ("is it ready, how big, how many photos"), the
dedupe key that stops two tabs starting two exports, the record the 48h sweep
queries by `expires_at`, and the row that remembers whether the email went out.

**Supabase Queues (pgmq) was considered and not taken, and Pro does not change
that.** It would replace the claiming mechanics — visibility timeout instead of
`locked_until`, an archive table, delivery counting — but not this table, so it
is an addition rather than a substitution. And because the worker polls Vercel
rather than Supabase, the queue would sit entirely behind one endpoint:
`pgmq_public.read()` to get an id, then a `select` to build the payload, two
round trips and two things that can disagree, against a single
`update … from (select … for update skip locked limit 1) returning *`.

The stronger objection is the design's spine. The worker holds no Supabase
credential (§2.6), and pgmq over PostgREST is reachable only as `anon`,
`authenticated` or `service_role` — there is no off-the-shelf role that can
read one queue and nothing else. Letting Railway consume the queue directly
means handing the container the service key, which is exactly what the shape
exists to avoid. Revisit if the worker grows a third or fourth job type; at one
job and a handful of exports per wedding, the table wins.

**`pg_cron` is taken** — for the sweep, not the queue. See §2.8.

**RLS on, and revoke by name.** This codebase has been bitten twice by
`revoke all … from public` failing to remove Supabase's _direct_ grants to
`anon` and `authenticated` — `20260825080000_lock_down_capture_rpcs.sql` and
`20260818172146` both exist for that. So: RLS enabled with no policies at all
(like `stripe_webhook_events`), and every RPC revoked from `anon, authenticated`
**by name**, granting execute to `service_role` only.

**The deleted-event race is closed by gating deletion, not by racing it.** The
Stripe webhook's known live failure was a host deleting an event mid-checkout:
the cascade took the pending row and the upsert died on the foreign key. An
export job is the same shape, and the simplest correct answer is to refuse the
delete while an export is in flight — a host deleting a wedding is deliberate
and rare, and "az album éppen készül" is an honest thing to tell them. Three
parts, and the first is the one that bites:

- **Bound the gate by the lease.** Refuse deletion when a job is
  `status in ('queued','processing') and locked_until > now()`, never on status
  alone. A container that dies mid-export otherwise leaves a `processing` row
  that blocks deletion of the event for ever, with nothing on screen explaining
  why. It is the same predicate the claimer uses, which is the point.
- **Keep the tolerance anyway — it is three lines.** The gate lives in a Server
  Action, so the service role, `apps/web/scripts/reset-data.ts` and any future operator
  path go straight around it. With `on delete cascade`, deleting the event
  removes the job row and the next status write affects zero rows. Treat that as
  a normal terminal outcome — stop, do not mark `failed`, do not retry.
- **Sweep the orphan.** A ZIP already uploaded when the event vanishes is left
  in `event-exports` with no row pointing at it. The cleanup pass in §2.8 must
  delete objects with no matching row, not only expired ones.

## 2.2 `source_hash` — over more than photo ids

Computed on Vercel, which is the only side that can. Hashing the ordered id list
alone serves a stale archive: the export's layout and filenames depend on more
(`export/route.ts:76-77` for the order, `:119-131` for the names).

- `hidden_at` decides whether a photo lands in `rejtett/`;
- `taken_at ?? created_at` is the sort key, and `taken_at` alone the filename
  stamp — so `created_at` matters for a photo that has no capture time;
- `photoUploaderName` puts the guest's display name in the filename;
- `event.time_zone` renders every stamp.

Hide a photo after an export and the id set is unchanged — same hash, stale ZIP,
with a moderated shot still filed among the rest. Hash the ordered tuple of
`(id, hidden_at, taken_at, created_at, display_name)` plus `event.time_zone`.

## 2.3 The Vercel side

Six endpoints. The first is the host's; the next four are the worker's, behind
a shared secret; the last is `pg_cron`'s, behind the same secret.

**`GET /host/events/[slug]/export`** — the host's Download. Authenticate →
verify ownership via `getOwnedEventBySlug` (null _is_ the ownership check) →
compute the current `source_hash` → then:

- **`photo_count <= BROWSER_EXPORT_MAX_PHOTOS` (20) → return the manifest**,
  the same ordered entries the worker's claim payload carries (§2.6), and the
  browser zips them itself. No row is inserted, nothing is queued;
- a `ready` export with a matching hash → mint a signed URL and redirect;
- a `queued`/`processing` job → return it, never create a second;
- otherwise → insert `queued` and return the preparing state.

Bound the signed URL's TTL by `expires_at`, and pass `createSignedUrl`'s
`download` option so the host receives a named `.zip` rather than a uuid.

**`POST /api/exports/claim`** — the worker asks for work; returns a job or 204.
One atomic `update … for update skip locked … returning *`, then build the
payload: for each photo in order, its public master URL, its finished entry
name, `lastModified`, and the pre-formatted EXIF date and offset — plus **one
signed upload token** for the destination object (`createSignedUploadUrl` on
`event-exports/{eventId}/{exportId}/ourfilm.zip`, with `upsert`), the bucket
and object name, and the TUS endpoint to send them to. If the row already has a
`tus_upload_url`, that too, so the upload resumes. The worker receives no ids
it could use for anything else and no credential of any kind.

The token is a bearer for writing one exact key in a private bucket and
nothing else. Its lifetime is one of the §2.6 checks: if an export can outlive
it, `heartbeat` returns a fresh one.

**`POST /api/exports/:id/heartbeat`** — extends `locked_until`, and records
the `tus_upload_url` the worker was given by Storage when it created the
upload. A 2GB export outlives any sensible lease, and without this the job
gets re-claimed underneath a worker that is still running.

**`POST /api/exports/:id/complete`** and **`/fail`** — `complete` says only
"done"; it carries no size. Vercel **reads the object's metadata itself**
through the Storage API with the service role and takes `byte_size` from
that, then in one statement sets `status = 'ready'`, `completed_at` and
`expires_at = now() + 48h`, and sends the email (§2.4).

Reading the object rather than trusting the worker's word is the §2.7 "never
mark a partial archive ready" discipline applied to the upload: a worker that
died mid-upload and retried the call cannot talk a half-written archive into
`ready`, because a TUS upload that has not received its final chunk is not an
object yet — the metadata read fails, and the row stays `processing`.

**`POST /api/exports/sweep`** — called by a Supabase `pg_cron` job through
`pg_net` every few minutes (§2.8), never by the worker. It does the two things
the database cannot: delete ZIP objects through the Storage API, and retry the
export-ready email. Vercel Cron cannot do it on Hobby, and a worker-ticked
sweep dies with the worker.

### Vercel usage — this design uses far less, not more

The obvious worry about moving work to a "dumb" worker is that Vercel now
handles six endpoints instead of one. The arithmetic goes the other way.

| Per export           | Today                                            | Dumb worker                         |
| -------------------- | ------------------------------------------------ | ----------------------------------- |
| Invocations          | 1                                                | ~25                                 |
| Total function time  | up to **300s** (Hobby cap), streaming throughout | well under **60s**, in milliseconds |
| Bytes through Vercel | the whole album                                  | one JSON payload                    |

The ~25 breaks down as one `claim` (~150ms: one query, building the payload,
and one Storage call to mint the signed upload token), ~20 heartbeats at
~50ms, and one `complete` with a single metadata read. You are
replacing a five-minute streaming function that also moves gigabytes of egress
with a few seconds of scattered milliseconds.

**Idle polling is the only thing that could add up, and it is not the exports.**

- **Poll every 60s with backoff. Do not long-poll.** Long-polling is the better
  answer on Pro — one held request covers 25 seconds of waiting — but it holds a
  function open continuously, and on Hobby's included allowance that is the
  wrong trade. A 60-second short poll is 1,440 invocations a day at ~50ms each:
  about a minute of compute daily. An export starting up to a minute late is
  invisible; the host is already reading "Album készítése…".
- Back off to 5 minutes after an hour with no work, and reset on the first job.

**The `claim` payload has a hard 4.5 MB ceiling** — Vercel returns
`413 FUNCTION_PAYLOAD_TOO_LARGE` above it, on every plan. At roughly 315 bytes
per entry (public URL, entry name, `lastModified`, EXIF date and offset) a
2,000-photo wedding is ~630 KB and a 5,000-photo one ~1.6 MB. Comfortable, but
it is the largest response in the design and the failure mode is "the biggest
weddings cannot export". Assert the size in a test rather than discovering it at
a wedding; paginate only if that assertion ever fires.

## 2.4 The export-ready email

**Vercel sends it, from the `complete` endpoint.** Not the worker: the host's
address lives in `auth.users`, and a worker that holds customer emails and a
mail credential is a much larger thing than a pipe that zips public images.
`RESEND_API_KEY` and the `*_EMAIL_FROM` overrides are already Vercel-side, the
locale comes from `events.locale`, and the copy belongs with the rest of the
product's copy.

**This is the most important email the product sends**, so delivery is
guaranteed rather than attempted:

- **`notified_at`, set only on a successful send**, and a sweep that retries
  every `ready` row where it is still null, with its own attempt budget. The
  worker's `complete` call is at-least-once — a timeout on its side means a
  retry — so a naive send mails the host twice.
- **Never block the completion response on Resend.** A mail outage must not fail
  a finished export.
- **Handle bounces.** A hard bounce means the host learns nothing and there is no
  other surface that would tell them. Record it and alert; this is the failure
  mode with no user-visible symptom.
- **The alert is a gap, in the idiom this codebase already uses.**
  `album_export_finished` without a matching `album_export_email_sent` on the
  same `event_id` is a host who does not know their album is ready — the same
  shape as `checkout_started` without `checkout_settled`.

**Link to `/host/events/<slug>`, never to a signed URL.** An email this
important is forwarded, archived and searched years later; a signed download URL
is a bearer token for the entire wedding sitting in an inbox. The page is behind
auth and mints a fresh URL on click.

That also makes the 48-hour window safe to state plainly. Because the download
endpoint re-derives from `source_hash`, an expired export degrades to "prepare it
again" rather than to an error — a link opened on day four enqueues a fresh
export instead of hitting a deleted object. Say so in the copy: available for 48
hours, after which we prepare it again.

**This overrides CLAUDE.md's MVP scope list**, which currently files "Email
notifications and lifecycle email" under _Not building_. Amend that entry in the
same change, and see the documentation list at the end — the privacy policy
enumerates Resend as sending "belépési és jogi visszaigazoló e-mailek" / "login
and legal emails", which an export-ready mail makes untrue.

## 2.5 Host UI

One button, two behaviours, decided by the count the page already shows.

**Up to 20 photos: the browser makes the ZIP.** `Album letöltése` fetches the
manifest, streams each master through the EXIF splice into client-zip, and
hands the result to the browser as a download. A second or two, no queue, no
email. The state while it runs is `Letöltés… 7 / 12`, and a failure is
`Nem sikerült letölteni az albumot. Újra`.

**Above 20: the worker makes it.** Four states — `Album letöltése` ·
`Album készítése… 487 kép` · `Album letöltése · 487 kép · 1,9 GB` ·
`Nem sikerült elkészíteni az albumot. Újra`. Poll a lightweight route handler
every 3–5s while that screen is open; no Realtime for this. The host page is
`force-dynamic` and authenticated — poll the handler, not a page re-render.
With the email in place, polling only has to cover the host who stays on the
screen.

The threshold is not explained on the button. It is explained once, in the
sentence under it: up to 20 photos the album downloads at once; larger albums
are prepared and the host is emailed. `BROWSER_EXPORT_MAX_PHOTOS` lives in
one place and both that sentence and the endpoint read it.

## 2.6 The worker

Plain Node 24 + TypeScript in `apps/worker`. No NestJS, no framework, no public
domain — it makes outbound calls only.

```
apps/worker/
  index.ts              poll → claim → run → complete
  export-album.ts       fetch, splice EXIF, zip to disk, upload the file, delete it
  api.ts                the four worker calls in §2.3 (claim, heartbeat, complete, fail)
```

### 2.6.0 Small albums never reach the worker

**Up to `BROWSER_EXPORT_MAX_PHOTOS` = 20 photos, the ZIP is built in the
host's browser.** The host's download endpoint returns the manifest (§2.3)
and the page does what the worker would have done: `fetch` each public master,
splice the EXIF date, feed client-zip, save the result. This is the first slice
of Phase 2 and the one that can ship earliest.

Why it exists is not that phones can cope with 20 images — it is the first
run. A host creates an event, shoots three test photos and taps Download. That
is the moment they decide whether the promise on the landing page is real, and
"we will email you when it is ready" is the wrong answer to a three-photo
album. The worker is for albums whose hosts already expect to wait.

Why 20 and not more: the ceiling is not processing, which client-zip streams,
but the blob the browser holds in memory between the last byte and the save
dialog. Once caps its browser download at 50 and, measured on 2026-09-08,
actually errors at 25 of its ~3.7MB originals — call it ~90MB of masters as
the practical iOS Safari limit. Twenty of our ~2MB masters is ~40MB, under
half of that. Keep a byte guard beside the count: if the manifest's estimated
size exceeds ~60MB, route to the worker regardless of count, so a small album
of unusually large masters cannot hit the same wall.

What it reuses, which is why it is cheap:

- **The manifest is the claim payload.** One builder on Vercel produces the
  ordered entries — URL, finished name, `lastModified`, pre-formatted stamp —
  and both the browser and the worker consume it. Naming, `rejtett/`, the
  nameless-photo rule and the zone never leave Vercel, and the browser cannot
  route around moderation because the manifest is owner-gated and decides the
  folder.
- **The EXIF splice is already browser code.** `withExifDate` is written
  against web `ReadableStream`, which is more at home in a browser than in
  Node. It becomes the third consumer of `packages/shared` with nothing
  changed.
- **client-zip goes to the runtime it was built for.** It stays a dependency,
  as a browser one. The Node usage in the Vercel route — with its ZIP-4.5 flag
  and server-side bundling caveat — is what goes.
- **The CSP already allows it.** `connect-src 'self' https://*.supabase.co`
  (`apps/web/next.config.mjs:24`) exists because guests upload from the browser, and
  public objects serve with CORS — it is how Once does the same thing.
- **It works before Phase 1.** A 20-photo album finishes well inside a signed
  URL's hour, so this can replace the Vercel route as the small-album path
  before the bucket flip and before the worker exists.

Telemetry: `album_export_requested` gains `mode: 'browser' | 'worker'`, and
the browser reports `album_export_browser_finished` with `photo_count`,
`elapsed_ms` and `missing_count`, or `album_export_browser_failed` with an
error class — a blob that failed to save on a phone is otherwise invisible.

### 2.6.1 The worker

**Build the archive on disk, then upload a file.** The worker does not stream
the ZIP into the upload. It streams each master through the EXIF splice into
`archiver`, and `archiver` writes to a file on Railway's ephemeral disk. When
the last entry is in there is a finished archive of known size, and _that_ is
what gets uploaded. Two passes instead of one overlapped stream — and nobody is
waiting on a background job; the email tells the host when it is done.

The size being known at send time is the property everything else falls out
of. Every hard part of the upload was downstream of not knowing it:

- **`Upload-Length` is real at creation.** Supabase checks the bucket and
  project limits then, so an oversize archive is refused before a byte moves
  rather than on the last chunk.
- **Resume is real.** A network failure at 3GB continues at 3GB: TUS asks the
  server for its offset and reads the file from there. No replay, no
  determinism requirement, no regenerate-and-skip.
- **No experiment, no fallbacks.** No `Upload-Defer-Length` gate, no length
  prediction, no S3 multipart. Everything this section used to carry in a
  blockquote went with the question that needed it.
- **Download and upload decouple.** Masters can be fetched several at a time —
  eight in flight is reasonable — instead of one at a time paced by the upload
  connection, and a slow CDN read never stalls the upload.

**Do not download into a folder and zip it afterwards.** That is three disk
passes and twice the space, and the archive is stored rather than compressed,
so there is nothing a "compress" step would do. Write the ZIP directly, once:
`fetch` → splice → `archiver` → `fs.createWriteStream`. Memory stays at one
chunk of one photo; a `Buffer` of the whole archive never exists.

**`archiver` in the worker, not client-zip.** The Vercel route uses client-zip
because it was built for a `Response` body, and it keeps it until the route is
removed. It is the wrong tool for the worker. Its README supports browsers and
Deno; it runs on Node only because Node happens to ship web streams, and it
lists a server-side bundling caveat. It flags _every_ archive as needing ZIP
4.5 whether or not Zip64 was used, and says outright that the result "is not
readable by every ZIP reader out there" — a bad property for a file a couple
opens on whatever they have. `archiver` is Node-native: it writes to a
`WriteStream` with ordinary backpressure, takes stream entries of unknown
length, sets `date` per entry, writes Zip64 only when an entry or the archive
actually needs it, and stores with `store: true` — pass `zlib` nothing, JPEGs
do not compress. Two ZIP writers exist permanently — client-zip in the
browser, `archiver` on Railway — and that is fine: the shared logic was never
the container format. It is the manifest builder and the EXIF splice, and
those stay single-sourced.

**Uploading without credentials: a resumable upload, authorised by a signed
token.** Supabase Storage speaks TUS at `/storage/v1/upload/resumable`, and
its `/upload/resumable/sign` variant takes a **signed upload token** in an
`x-signature` header in place of a JWT — the token `createSignedUploadUrl`
returns, which is the call `apps/web/lib/capture.ts:107-113` already makes for every
guest photo. Vercel mints one for the destination object at claim time
(§2.3); the worker uploads the file with `tus-js-client`, which runs in Node,
takes a file stream, and buffers exactly one chunk. Chunk size is 6MB, fixed by
Supabase. Use the direct storage hostname (`{projectId}.storage.supabase.co`),
which the docs recommend for large files.

What that buys, against the two S3 shapes this section used to describe:

- **No S3 keys anywhere.** Not on Vercel, not on Railway. Supabase says at the
  point of creation that S3 keys _"provide full access to all S3 operations
  across all buckets and bypass any existing RLS policies"_, so every S3 shape
  put a key with read access to every wedding somewhere. The signed token is
  the opposite: a bearer for one object, one operation, one window.
- **No multipart orchestration.** No `CreateMultipartUpload`, no presigned
  part URLs, no ETag bookkeeping, no `CompleteMultipartUpload`, no `/part`
  endpoint on Vercel.
- **Resume from the file.** The upload URL stays valid for 24 hours. The
  worker reports it through `heartbeat`; Vercel keeps it in `tus_upload_url`;
  a re-claimed job in the same container hands it back and the upload
  continues from the server's offset. After a redeploy the file is gone, and
  the job is regenerated from scratch — which is what the streaming design did
  on _every_ failure, so this is strictly no worse.
- **50GB, not 5GB.** Supabase's own guidance: standard uploads stop at 5GB,
  and above 6MB resumable or S3 uploads are "more performant and reliable". A
  2 000-photo wedding at ~2MB masters is ~4GB — the single PUT this section
  used to start with was within one large wedding of its ceiling.

So the worker holds exactly one secret — the shared token for the §2.3
endpoints — and every URL it touches is either a public photo URL or an upload
it was handed a token for. It cannot write anywhere it was not given
permission for, and it cannot read a photo it was not given.

**Disk is now a correctness concern.** Three rules, all cheap, all invisible
when missed until the disk is full:

- **Budget before claiming.** One large wedding is ~4GB on disk. Check free
  space (`statfs` on the temp directory) against a configured floor before
  claiming, and do not claim below it; on `ENOSPC` mid-write, `fail` with
  `disk_full` and let the retry policy in §2.7 handle it. One job at a time,
  which the worker already does. The claim payload could carry the sum of
  `photos.byte_size` as a hint, but not until that column is confirmed to be
  the master alone — `apps/web/lib/upload-shot.ts` sums what landed across all three
  renders, so it may well not be.
- **Clean up in `finally`, and again on startup.** Delete the archive once
  `complete` has been acknowledged, and delete it on any failure. Then sweep
  the temp directory on boot for anything a dead container left behind, and
  report the count — a leak here has no symptom until it has every symptom.
- **Ephemeral means ephemeral.** The file survives a network error, not a
  redeploy or a restart. The disk size is a plan property (100GB on Railway
  Pro at the time of writing); confirm it on the plan actually in use and set
  the floor from that, not from this document.

> **Proven, and the script is committed:** `apps/worker/scripts/tus-probe.ts`
> (`pnpm --filter worker probe:tus --mb 40`). Against the local stack on
> 2026-09-08 a 40MB file went up over seven 6MB `PATCH` requests carrying
> nothing but `apikey` and the `x-signature` token, in under a second, and the
> stored size matched. `tests/db/storage.test.ts` pins the same handshake at
> 64KB so it runs in CI. Still to read off a run against the linked project
> at real size: the token's lifetime — a signed upload URL for photos expires
> after two hours, so if an export can outlive it, `heartbeat` returns a fresh
> one — and whether the hosted edge treats the chunks any differently. The
> probe sends the signature on every request; nothing was tried without it.

Two size limits, both set deliberately. `event-exports` gets a
`file_size_limit` sized for whole weddings (`event-photos` is capped at 15MB).
And the **project-wide upload limit** (Project Settings → Storage) caps every
bucket regardless of the bucket's own setting; on Pro it goes up to 50GB, and
its default is nowhere near a wedding ZIP.

**The one piece of shared logic, and where it goes.** The splice in
`exif-write.ts` (`withExifDate`) has to run inside the stream, so unlike the
naming rules it cannot stay on Vercel — the worker is its second consumer.
**That is what creates `packages/shared`**, and it is the whole of it: one
module, imported by both apps. Copying it instead would reintroduce exactly the
silent drift the monorepo was chosen to eliminate — two implementations
producing differently-stamped archives with no error anywhere.

**But the module as it stands is not yet that shape.** `exifDateSegment` at
`apps/web/lib/exif-write.ts:65` is `(iso: string, timeZone?: string) => Uint8Array`: it
takes an ISO instant and an IANA zone and does the wall-clock conversion
itself. Shipped as-is, the worker would need `event.time_zone` in the payload
and would be doing zone arithmetic — the domain knowledge §2.0 says it must
not carry. Split it before the worker imports it: the ISO-plus-zone → `2026:06:14
18:32:10` / `+02:00` formatting stays on Vercel next to `formatFileStamp` in
`apps/web/lib/format.ts`, and the shared module takes those two strings and returns the
bytes. The golden fixture below pins the formatting half through that split.

So there is no drift to detect, and the **golden fixture becomes a regression
test rather than a cross-repo tripwire.** Keep it anyway: Phase 1 moves the
filename logic out of the route and into a portable module, and that refactor
wants its output pinned. A committed JSON file of input rows mapped to expected
entry names, covering the cases a rewrite gets wrong — an accented name
(`Kovács Réka` → `Kovács-Réka`, because the regex is `[^\p{L}\p{N}]+` and
anyone reaching for `[^a-zA-Z0-9]` produces `Kov-cs-R-ka`), a hidden photo in
`rejtett/`, a photo with no `taken_at` and therefore no stamp segment, and a
December timestamp where Budapest is `+01:00` rather than `+02:00`.

**Prerequisite, and it belongs in Phase 1:** `photoUploaderName` currently lives
in `apps/web/lib/photos.ts`, which opens with `import 'server-only'` and pulls in React's
`cache` and the Next server client. Extract the archive's naming rules into a
portable module — the filename builder, the `rejtett/` rule, the no-name
fallback and the `taken_at ?? created_at` comparator — so the payload builder in
§2.3 can use them and the golden fixture has one place to point at. Do it with
the fixture, not before it: refactoring the filename logic with nothing pinning
its output is how the first archive comparison becomes unverifiable.

**Telemetry moves with the work.** `album_export_started` /
`album_export_finished` are on the server list and CLAUDE.md specifies an alert
on a non-zero `missing_count` — "silent data loss and wants an alert". Both are
now reported from Vercel (`claim` and `complete`), which is simpler than it was
going to be: the worker needs no PostHog client at all, and `reportServerEvent`
keeps its existing `safeServerValue` discipline. Add `album_export_email_sent`
beside them.

## 2.7 Reliability

**Never mark a partial archive `ready` — but do not make an album
undownloadable either.** Today's route ships 486 of 487 and reports
`missing_count` (`export/route.ts:186-192`). A blanket "any missing object ⇒
`failed`" turns one permanently-gone master into a wedding that can never be
downloaded at all. Distinguish transient from permanent; retry transient
(~30s → 2m → 10m, then `failed`); and when a master is genuinely gone, offer the
host the short archive with an explicit "1 kép nem került bele" rather than a
dead end. Losing one photo is bad. Losing the album because of one photo is
worse.

An export failure must never modify a photo object. The ZIP is derived data.

## 2.8 Expiry and cleanup

On success: `completed_at = now()`, `expires_at = now() + 48h`, path
`event-exports/{eventId}/{exportId}/ourfilm.zip`. After expiry delete through
the Storage/S3 API, **never** via SQL — deleting only the Storage metadata row
orphans the file.

**`pg_cron` is the clock.** It cannot be a Vercel Cron: **Hobby allows one
cron run per day, with ±59 minutes of imprecision** (§2.0), and a once-daily
retry is not a delivery policy for the most important email the product sends.
And it must not be the worker: the first draft of this document had Railway
tick a sweep endpoint every 15 minutes, which means the one failure that kills
an export — a dead container — also silences the retry of the email telling
the host about it. Supabase ships `pg_cron` and `pg_net` on every plan, the
schedule is a `cron.schedule(...)` call in a migration, so it is versioned like
everything else, and it runs whether or not Railway is up.

Two layers, split by what needs the Storage API:

- **Pure SQL, in the database, every minute.** A function
  `public.sweep_album_exports()` — `security definer`, revoked by name from
  `anon` and `authenticated`, granted to nobody but the cron job's owner — that
  flips `ready` rows past `expires_at` to `expired`, and returns `processing`
  rows whose `locked_until` has passed to `queued` with `attempt_count + 1`, so
  a dead worker's lease is released without the worker. That second clause is
  the same predicate as the delete gate in §2.1, which is the point: the gate
  can only ever block for one lease length.
- **HTTP, to Vercel, every five minutes.** `pg_net` POSTs to
  `/api/exports/sweep` with `EXPORT_WORKER_SECRET` read from Supabase Vault
  (`vault.decrypted_secrets`), never a literal in the migration. The endpoint
  does what SQL cannot: deletes the objects of `expired` rows and of orphans
  through the Storage API, and retries `ready` rows whose `notified_at` is still
  null (§2.4). The rule that objects are deleted through the API and never via
  SQL is unchanged.

Three jobs behind that endpoint, not one: expired exports; **orphaned
objects** — a ZIP whose event was deleted mid-run has no row left to expire it
(§2.1); and the email retry.

`pg_net` is fire-and-forget — the response lands in `net._http_response` and
nothing reads it — so the endpoint must be idempotent and must log its own
outcome to PostHog (`album_export_sweep`, with counts). A sweep that silently
stops is the same class of failure as the email that silently stops; the alert
in §2.4 covers the second, and a `pg_cron` job with no `album_export_sweep` in
the last hour is the check for the first. `cron.job_run_details` is the local
answer to "did it run"; keep it trimmed, it grows for ever.

`pnpm test:db` needs `pg_cron` enabled in the local stack, and should assert
that the schedule exists after `db reset` — a migration that schedules a job is
the kind of thing that works on the machine it was written on.

Note the egress: each export moves roughly twice the album (pull masters, push
ZIP). That is the second reason `source_hash` exists — it is a cost control as
much as a correctness one.

## 2.9 Manual setup

| Where    | What                                                                                                                                                                                              |
| -------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Supabase | create **private** `event-exports` bucket, with a `file_size_limit` sized for a whole wedding                                                                                                     |
| Supabase | raise the **project-wide** upload limit (Project Settings → Storage); it caps every bucket, and the default is small                                                                              |
| Supabase | enable `pg_cron` and `pg_net` (Database → Extensions; the migration also does `create extension if not exists`)                                                                                   |
| Supabase | put `EXPORT_WORKER_SECRET` in Vault as `export_worker_secret` and the site origin as `ourfilm_api_url`; the cron job reads both from `vault.decrypted_secrets` and posts nothing until both exist |
| Vercel   | set `EXPORT_WORKER_SECRET`; leave `OURFILM_EXPORT_WORKER` unset until the worker is live, then `true` — that is the cutover                                                                       |
| Railway  | create a service pointing at `apps/worker` in this repo                                                                                                                                           |
| Railway  | region: `europe-west4` (Amsterdam), closest to Supabase `eu-central-2` (Zurich)                                                                                                                   |
| Railway  | watch paths `apps/worker/**` so web-only pushes do not rebuild it                                                                                                                                 |
| Railway  | a plan with ephemeral disk for one wedding ZIP plus headroom (100GB on Pro at the time of writing — confirm)                                                                                      |
| Railway  | env vars, start command, restart policy                                                                                                                                                           |
| Railway  | no public domain required — the worker makes outbound calls only                                                                                                                                  |
| Vercel   | add an Ignored Build Step so worker-only pushes do not rebuild the web app                                                                                                                        |

Vercel holds the credentials it already had; the worker holds almost nothing.

```
# Vercel (server-only, in addition to what is already set)
EXPORT_BUCKET=event-exports
EXPORT_WORKER_SECRET=            # shared with the worker and the cron job; authenticates §2.3

# Railway
OURFILM_API_URL=                 # https://ourfilm.app
EXPORT_WORKER_SECRET=            # the same value
VERCEL_PROTECTION_BYPASS=        # only while OURFILM_API_URL is a preview deployment
EXPORT_TMP_DIR=                  # where archives are built; swept on boot
EXPORT_DISK_FLOOR_BYTES=         # do not claim a job with less free space than this

# Supabase Vault (not an env var)
export_worker_secret             # the same value again, read by the pg_cron sweep
```

**No new class of secret.** The upload token is minted with the
`SUPABASE_SERVICE_ROLE_KEY` Vercel already holds, through the same call the
guest photo path uses, and the TUS endpoint is derived from
`NEXT_PUBLIC_SUPABASE_URL`. Nothing about Storage access is configured that
was not configured before; the only thing added anywhere is the shared secret
that authenticates the worker and the cron job to §2.3. Should an S3 key ever
be introduced for any reason, remember what §2.6 quotes: it reads every
bucket, so it would live on Vercel only and never on Railway.

## 2.10 Cutover

Browser path first (§2.6.0), which can ship before the worker and before
Phase 1 → build the worker → stress-test at 500 / 1 000 / 2 000 photos →
Railway becomes primary for everything above 20 photos → **the Vercel exporter
is removed** after **five real wedding exports and one deliberate
failure/retry test**, and in any case within a month of the worker going
primary. client-zip stays, as a browser dependency.

Be honest about what the old route is worth in the meantime: on Hobby it is
capped at 300 seconds (§2.0), so it covers exactly the albums that were never
the problem, and below 20 photos the browser now covers those anyway. For a
wedding large enough to matter, there is no fallback — which is another reason
to stress-test the worker at 2 000 photos before the first real album, rather
than trusting a safety net that is not there. Set the removal as a number
rather than a feeling: an indefinitely-kept third exporter is where that costs
something.

The stress test decides nothing about the upload mechanism — there is nothing
left to decide. What it still measures at 2 000 photos: whether the claim
payload fits 4.5MB (§2.3), peak disk and that the temp directory is empty
afterwards, whether the token outlives the two-pass wall-clock, and what that
wall-clock actually is.

---

## Order of work

**Phase 1** — bucket migration · privacy policy and terms (both locales) · URL
builder + six consumers · cover versioning · operator takedown script · rewrite
`20260902100000_guest_own_frames.sql:22` · extract the portable archive-naming
module with its golden fixture (§2.6) · invert the two db tests ·
`pnpm verify` + `pnpm test:db` · flip · deploy · verify against a real event.

**Phase 1.5** — one PR: `apps/web`, `supabase/` to the root, doc sweep across
`CLAUDE.md`, `AGENTS.md` and the three skills · re-point Vercel's root directory
· verify `apps/web/vercel.json`'s `fra1` pin still applies.

**Phase 2** — manifest outcome on the download endpoint + browser ZIP for
≤ 20 photos, shared EXIF splice in the page (§2.6.0; shippable first) ·
known-length TUS upload with a signed token, script committed (§2.6.1) ·
schema + RLS · lease-bounded delete gate · `source_hash` · split
`exif-write.ts` and create `packages/shared` · the six Vercel endpoints ·
`apps/worker` skeleton · ZIP built on disk + signed-token resumable upload ·
disk floor + `finally` + startup sweep · export-ready email + `notified_at`
retry · host UI · telemetry · `pg_cron` schedule + Vault secret + sweep
endpoint (expiry, orphans, email retry) · stress test (payload size, peak disk,
token lifetime, wall-clock; commit the script) · primary · remove the old
route.

**Resolved (§2.6):** the worker builds the archive on Railway's ephemeral disk,
so its size is known at send time, and uploads the file as a resumable (TUS)
upload authorised by a signed upload token minted on Vercel with the service
role it already holds. No S3 key, no deferred length, no fallback path.

**Timing (§2.0):** on Hobby the current album download already fails past 300
seconds of streaming, so Phase 2 is due before any wedding produces an album
that large — call it five minutes of the host's bandwidth. That is a real
deadline, not a preference.

## Documentation that must move in the same change

Phase 1:

- `CLAUDE.md` — Data model ("The bucket is private"), Access model, Landing page
  promises ("the bucket is now private as well"), the `gallery_image_failed`
  row, and the "no preview" framing (D1: it is a UI property now, not a
  structural one). The "never hard-delete" rule stands — D2 is deferred.
- `.cursor/skills/ourfilm-supabase/SKILL.md` — bucket privacy and read path.
- `20260902100000_guest_own_frames.sql:22` — constraint #2 is now false (D1).
- `apps/web/lib/photo-urls.ts` header, `export/route.ts:32`, `apps/web/tests/db/storage.test.ts`
  preamble.
- **The terms and privacy notice's removal language**, both locales —
  `adatvedelem/page.tsx:111`, `:125`, `:186`; `aszf/page.tsx:100`, `:168`;
  `kapcsolat/page.tsx:167`. Either the operator script makes them true again, or
  they have to stop promising removal. The first is an hour; the second is a
  sentence you do not want to write.

Phase 1.5:

- every file path in `CLAUDE.md` (72 of them), `AGENTS.md` and the three
  `.cursor/skills/*/SKILL.md` — this is the bulk of that PR.

Phase 2:

- `CLAUDE.md` — amend the MVP-scope entry filing "Email notifications and
  lifecycle email" under _Not building_: transactional export-ready mail is in
  scope, lifecycle and marketing mail is not. Add `album_export_email_sent` to
  the server telemetry table.
- the privacy policy, both locales — it enumerates Resend as sending "belépési és
  jogi visszaigazoló e-mailek" / "login and legal emails", which an
  export-ready mail makes untrue.
- the `RESEND_API_KEY` comment in `CLAUDE.md`'s Local env block (`:102`, "auth
  and legal request emails"). `apps/web/.env.local` itself has no `RESEND_API_KEY` line
  to update.
- `CLAUDE.md`'s server telemetry table gains `album_export_sweep` beside
  `album_export_email_sent`; the browser table's `album_export_requested` row
  gains `mode`, with `album_export_browser_finished` / `_failed` beside it.
