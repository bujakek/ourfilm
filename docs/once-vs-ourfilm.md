# Once vs OurFilm — how each one moves a photo (v2)

Read 6 September 2026. Revised the same day.

Both products are a disposable camera on Supabase, with the same storage layout —
`{event_id}/{photo_id}_thumb.jpg`. Almost everything else about how bytes and rows
reach a guest's browser is decided differently.

## What changed since v1

v1 treated the private bucket and signed URLs as a security "posture" that Once had
traded away for CDN hits, and recommended keeping the posture while patching around
it. That framing was wrong, and this revision corrects it:

- **The security boundary in both products is the event link.** A ~52-bit slug plus a
  typed guest name admits anyone to upload and, if the host enabled it, to view.
  Everything downstream of that gate decides _who is handed photo addresses_, and both
  products already do that in their read path. Bucket privacy adds almost nothing on
  top.
- **Four of Once's listed "costs" are API sloppiness, not consequences of a public
  CDN.** `select=*`, a client-supplied `is_deleted` filter, client-named upload paths
  and an offset-not-zone would be exactly as bad behind a private bucket. They are
  filed separately now.
- **The recommendation is inverted.** v1 said "hold signatures stable, keep the
  bucket private." v2 says go public at random paths, keep the read function as the
  only thing that hands out paths, and close the one real hole (uploader learns its
  own path) with a staging move.

## How to read the sourcing markers

Everything in the OurFilm column was read from this repository. The Once column is
read from network traffic captured against one film, plus one delivery URL — so a
good deal of it is deduction from endpoint shapes, and their RLS policies are not
observable from outside.

| Marker           | Means                                                                   |
| ---------------- | ----------------------------------------------------------------------- |
| **verified**     | Read from this repo, or seen directly in Once's traffic. Cite-able.     |
| **inferred**     | Deduced from an endpoint shape or a response body. Plausible, untested. |
| **not observed** | Absent from the traffic captured. Says nothing about whether it exists. |

## Where the security boundary actually is

Both products: `https://join.once.film/f/pFYK3fqi`, `https://ourfilm.app/e/jxf2ge35jm`.
Ten characters of base-36 is roughly 52 bits. Anyone holding the link is a guest; a
guest name is a label, not a credential. Whether that guest sees photos is decided by
the host (`guests_can_view`) and the clock (`reveal_at`), evaluated in the read path.

Everything below that line is about how the read path hands out addresses and how
the bytes are fetched once it has. Two consequences:

1. A random 128-bit photo path is a stronger lock than the 52-bit front door. Guarding
   it further with a signature costs a round trip and every cache hit, and protects
   against nobody who wasn't already let in.
2. What bucket privacy still buys is exactly one thing: **an address that was already
   handed out can be made to stop working**, bounded by the signature TTL. Everything
   else v1 credited to it was the read function doing its job.

### What a private bucket still buys, precisely

- **Revocation after hand-out, within the TTL.** A guest who copied an image URL into a
  chat holds a dead link within an hour instead of a permanent one. They had thirty
  seconds to save the file, so this is a formality for the photo itself — but a
  permanent link is also hotlinkable, and egress for embeds elsewhere is paid forever.
- **Blast radius of a leaked path.** A path that escapes through logs, error tracking,
  a referrer header or an error page is worthless an hour later. The one case where
  privacy of the bucket protects against a future bug rather than against guests.
- **Perception.** "Private bucket, expiring links" reads well to a host and in a
  privacy policy. Marketing, but not nothing for a product sold to people uploading
  their wedding.

### What it does _not_ buy

- **Listing protection.** A public bucket cannot be listed without a select policy on
  `storage.objects`. Same as private.
- **Pre-reveal enforcement.** That is the read function withholding paths until
  `now() >= reveal_at`, plus (see below) the uploader not knowing its own path.
- **Defence against a bug in the read function.** `signPhotoUrls` signs whatever paths
  it is given. A function that leaks a hidden photo's path leaks a signed URL to it.
  Same code path, no extra gate.
- **Right to erasure.** Deleting the object purges at the Smart CDN within ~60 s in
  both designs. Only _soft-hide_ differs, and the previous section covers it.

## Once's API sloppiness — filed separately

These are real and worth not copying. None of them is caused by a public bucket, and
all of them were wrongly grouped under "posture" in v1.

| Problem                           | What it is                                                                                                                                                                               | Marker       |
| --------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------ |
| `select=*` from the browser       | `GET /rest/v1/photos?select=*` returns every column: `participant_id`, `render_last_error`, `render_locked_at`, `render_attempt_count`, `latitude`, `longitude`, `city`                  | **verified** |
| Client-supplied visibility filter | `is_deleted=eq.false` is a URL parameter. Whether a deleted photo stays hidden rests on RLS repeating it                                                                                 | **inferred** |
| Client-named upload path          | The browser PUTs to a path it composed from `film_id` and `photoId`. Combined with an anon INSERT policy, a guest can write wherever it can name                                         | **verified** |
| Enumeration                       | `photos` answers the anon key. A held `film_id` lists every row in the film — and with deterministic public paths, every photo, **before reveal**. This is the only product-breaking one | **verified** |
| Offset, not zone                  | `timezone_offset: -120`. Cannot survive a DST boundary                                                                                                                                   | **verified** |
| 48-hour upload intent             | `begin-photo-upload` locks a frame for 48 h on a failed upload; OurFilm's reservation lapses after 10 min                                                                                | **verified** |

OurFilm has none of these today and should have none after going public: a
`security definer` read function with a fixed column list, server-named paths,
signed upload tokens, no anon select anywhere, an IANA zone per event.

## Photo upload

Neither product sends photo bytes through its own server. What differs is who decides
where the bytes land.

| Dimension          | OurFilm                                                                                                                                                            | Once                                                                                                                                                               |
| ------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Authorization      | Per-path signed upload token from `createSignedUploadUrl`, minted server-side in `signUpload` (`lib/capture.ts:107`)                                               | Authenticated write to `/storage/v1/object/film-photos/…` — the plain endpoint, no signature in the URL. An anon INSERT policy on `storage.objects` (**inferred**) |
| Who names the path | The database. `reserve_shot` writes all three paths onto the row before a token exists; a guest cannot choose a destination                                        | The client. The browser PUTs to a path it composed itself from `film_id` and `photoId` (**verified**)                                                              |
| Reservation        | `reserve_shot` takes `for update` on the participant row; pending frames stop counting after 10 minutes (`shot_reservation_ttl()`, migration `20260824174542:222`) | `begin-photo-upload` returns an intent with `expiresAt` 48 hours out — locks the frame far longer on a failed upload                                               |
| Retry & resume     | IndexedDB queue survives a killed tab; same `idempotency_key` re-claims the same frame; 4 attempts or 24 h, and only a real server answer spends one               | **not observed**                                                                                                                                                   |
| Renders uploaded   | **Three** — master 3200px q0.90, view 1600px q0.85, thumb 400px q0.80, all from one decode (`lib/image.ts:38–57`)                                                  | **Two** — `_original.jpg` and `_thumb.jpg`, display sizes derived at the edge. Observed originals ran 87 KB – 2.0 MB                                               |
| Commit step        | `commit_shot` flips the row to `ready` and returns the authoritative remaining count                                                                               | `/api/images/finalize-upload` → `{status: "created", displayReady: true}`                                                                                          |

### The one real hole in going public: the uploader knows its own address

The signed upload token encodes the path, so the uploading browser learns where its
frame landed. Behind a private bucket that is harmless — the guest cannot read it
back without a signature. Behind a public bucket a guest with devtools open could
fetch their own frame before reveal. Not a privacy problem — it is their photo — but
"no preview, no retakes" is the product, and the frame count is what stops the
retake, not the missing preview.

Close it with a **staging move**: `reserve_shot` names a random staging path, the
guest uploads there, and `commit_shot` moves the object to its final random path
server-side. The client never learns the final address. One storage op per photo.

## Photo delivery

The origin of the whole question. Both sit behind Cloudflare; only one of them gets
anything out of it.

| Dimension  | OurFilm (today)                                                                                                                                                                                                                                                          | Once                                                                                                                                                                                                |
| ---------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Bucket     | Private. Every read is signed in `signPhotoUrls`, 1-hour TTL, re-minted on every render because the pages are `force-dynamic`                                                                                                                                            | Public (**verified** — `Cache-Control: public, max-age=31536000, immutable`, `Access-Control-Allow-Origin: *`, no token in the URL; `x-robots-tag: none` is the noindex that a public bucket needs) |
| URL shape  | `<ref>.supabase.co/storage/v1/object/sign/…?token=<jwt>` — a new JWT each render                                                                                                                                                                                         | `cdn.once.film/storage/film-photos/…?width=600` — stable, and the query string is a transform, not a credential                                                                                     |
| CDN result | Cloudflare fronts the bucket — confirmed `cf-ray … -BUD`, a Budapest edge — but a unique token per render means a unique cache key, so **effectively 0% hit rate**. Smart CDN is already active (ships with Pro); its docs say each unique token is a separate cache key | Byte-identical URL for every viewer, forever. **Confirmed live:** `cf-cache-status: HIT`, `Age: 37`, `cf-ray … -VIE`. `x-smart-cdn: true`                                                           |
| Domain     | Supabase project host appears in every photo URL                                                                                                                                                                                                                         | Own subdomain. Portable if storage ever moves; nothing to rewrite at the call sites                                                                                                                 |
| Resizing   | Three fixed renders. Every photo `<Image>` carries `unoptimized`, so `/_next/image` is bypassed and no photo byte crosses Vercel                                                                                                                                         | `?width=600` resized at the edge from the stored render                                                                                                                                             |
| Revocation | Soft-hide or `guests_can_view` off takes effect **within one hour**. Delete purges at the edge within ~60 s                                                                                                                                                              | Soft-hide cannot recall a handed-out URL. Delete purges at the edge within ~60 s — same as OurFilm                                                                                                  |

### How much does the miss rate actually cost?

Less than v1 implied. Zurich-to-a-European-guest is tens of milliseconds. Forty
guests fully scrolling a 200-photo wedding is a few hundred MB of 400px thumbs —
real egress, not alarming against Pro's included allowance. The bigger latency lever
on a gallery render today is the signing round trip plus `force-dynamic`, not the
edge miss. Going public fixes both; so would deterministic signing (see alternative
below). The miss rate is a reason to change, not the reason.

## Gallery read and data exposure

| Dimension         | OurFilm                                                                                                                                                 | Once                                                                                                                                  |
| ----------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------- |
| Read path         | `event_gallery_by_slug`, a `security definer` function (migration `20260824174542:543`)                                                                 | `GET /rest/v1/photos?select=*` — PostgREST, straight from the browser (**verified**)                                                  |
| Columns returned  | A fixed list in the function signature: id, three paths, uploader name, width, height, created_at                                                       | Every column, including `participant_id`, `render_last_error`, `render_locked_at`, `render_attempt_count`                             |
| Visibility filter | Inside the function, where no caller can reach it: `hidden_at is null`, `status = 'ready'`, `guests_can_view`, `now() >= reveal_at`                     | `is_deleted=eq.false` — sent by the client as a URL parameter (**inferred** that RLS repeats it; not tested against their production) |
| Location data     | EXIF destroyed on the phone by the canvas re-encode. No coordinate ever reaches the server; `taken_at`, width and height are carried as scalars instead | `latitude`, `longitude` and `city` columns exist and ship to every guest's browser. Null in the captured sample                       |
| Enumeration       | No anon select policy on `photos` or on `storage.objects`. Privacy rests on the slug, and nothing can be listed                                         | The `photos` table answers the anon key. A held `film_id` lists that film's rows                                                      |
| Time zone         | IANA name stored per event; both `datetime-local` conversions resolve in the event's own zone                                                           | `timezone_offset: -120` — a fixed offset                                                                                              |

This table is unchanged by going public. The read function remains the sole source
of photo addresses; that is what enforces reveal and hide, and it was always what
enforced them.

## Export and background work

| Dimension          | OurFilm                                                                                                                                                                                                                                                               | Once                                                                                                                                                                                                                                                                                                                                                                                                                                                           |
| ------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Album ZIP          | **The one path where bytes cross Vercel.** A Node function in `fra1` fetches every master from Supabase in `eu-central-2` and streams it into `client-zip`. No `maxDuration` set; a 600-photo album is well over a gigabyte in and out. Fixable — see recommendations | **Built in the browser.** A `fetch()` per `_original.jpg` straight to the CDN (`Sec-Fetch-Mode: cors`, `Origin: join.once.film`), zipped locally, handed to Safari as a finished blob. Their servers carry none of it (**verified**). **Capped at 50 images per download** — at ~3.67 MB per observed original that is ~180 MB, about where buffering a ZIP in browser RAM stops being safe. A 600-photo album is twelve downloads and manual folder-stitching |
| Background workers | None, deliberately. The reveal is `now() >= reveal_at` evaluated when a request arrives                                                                                                                                                                               | `render_status`, `render_next_retry_at`, `render_locked_at` and `render_attempt_count` describe a retrying job queue, serving `image_style` (**inferred**)                                                                                                                                                                                                                                                                                                     |

A public bucket makes the browser-side export trivially simple: the read function
returns master paths, the browser fetches them from the CDN. No signing step at all.

## The trade, restated

### What going public buys

- **Edge caching that works.** One origin fetch per object, ever. Forty guests on a
  200-photo album is 200 origin fetches, not 8,000.
- **No signing round trip** before a gallery renders, and the gallery pages no longer
  need to be `force-dynamic` on account of URL freshness.
- **One upload per shot.** A single master up from the phone on venue wifi;
  `?width=` derives every display size at the edge. Grid sizes become changeable
  without re-uploading. Storage drops to a third.
- **A lightbox that still doesn't cook the phone** — the edge serves 1600px on
  request; the 1600px render no longer has to exist as an object.
- **A custom domain**, `cdn.ourfilm.app`, and storage becomes swappable without
  touching a call site.
- **Browser-side export with no signing step.**

### What going public costs

- **Soft-hide and `guests_can_view`-off no longer recall handed-out URLs.** Today
  they take effect within an hour; afterward, never, for anyone who already holds a
  direct link. Delete still purges within a minute.
- **Hotlinking.** A handed-out URL can be embedded elsewhere and served forever at
  OurFilm's egress cost. Random paths mean only people who were given it have it.
- **Leak radius.** A path that escapes into logs or error tracking is a live URL, not
  a URL that expires in an hour.
- **A line in the privacy policy** becomes harder to write in the reassuring form.
- **Edge transforms are metered** on Supabase Pro beyond an included quota — check
  the current tariff against expected renders before assuming free.
- **First view of any size is a transform miss** — one cold resize per object per
  width, cached thereafter.

Everything else v1 listed as an OurFilm advantage — reveal enforcement, path-bound
writes, fixed column list, no coordinates, no workers — is preserved unchanged,
because none of it lived in the bucket.

## Recommendations

Ranked. The first is the decision; the rest follow from it.

1. **Make the bucket public, at random paths, with a staging move on commit.**
   `reserve_shot` names a random staging path; `commit_shot` moves the object to a
   random final path. Keep signed upload tokens (path-bound writes stay). Keep the
   read function as the only source of photo addresses. Keep no anon select
   policy on `photos` or `storage.objects`. Remove `signPhotoUrls` from the read
   path. Deletion, not hiding, is the revocation primitive from here on — document
   that for the host UI.

2. **Upload one render, transform at the edge.** Drop the 1600px and 400px uploads
   from `lib/image.ts`; request `?width=400` and `?width=1600` from the CDN. Verify
   transform pricing and quality settings first; if the tariff is unattractive at
   projected volume, keep uploading a thumb and derive only the view size.

3. **Set `maxDuration = 1800` on the album export route.** One line, and it covers
   every realistic album on the path that already exists. Pro supports per-function
   extended durations up to 1800s (30 minutes) on Node 20/22/24 — set in the route
   file, not project defaults, which still cap at 800s. A 1.2 GB album is ~480s at
   20 Mbps and ~960s at 10 Mbps, both comfortably inside it. `vercel.json` pins only
   `regions`, and Secure Compute / Static IPs (which are excluded from the beta) are
   not in use. This closes the `album_export_started`-without-`_finished` gap.

4. **Chunk the export only if an album ever exceeds it.** A `?part=n` parameter
   splitting the archive keeps every request short on any connection, and makes a
   failed download one retry instead of restarting a gigabyte. Do not build it until
   telemetry shows a timeout at 1800s.

   **Browser-side zipping is withdrawn.** It needs `showSaveFilePicker()` to stream
   to disk, which Safari does not implement — and Safari is the host's likely
   browser. The only alternative there is buffering the whole archive in RAM, which
   is strictly worse than streaming it from the server. Once's 50-image cap is what
   that constraint looks like when a product ships into it.

5. **Put a domain in front.** `cdn.ourfilm.app` — the one piece of Once's setup that is
   a separate paid Supabase add-on. Portability and branding; it adds no caching
   that recommendation 1 does not already unlock.

### The alternative, if the privacy-policy line matters more than expected

Stay private and make the signature deterministic: mint the storage JWT locally with
`exp` rounded to a 15-minute bucket, so every render of the same photo in the same
window produces a byte-identical URL. No shared cache is needed, and there is no
round trip to Storage. This keeps hour-bounded revocation and gets most of the cache
benefit — but it still uploads three renders, still needs a signing step in the read
path, and needs one test that Storage accepts a locally-signed token before anything
is built on it. v1's "cache the signed-URL map" recommendation is withdrawn: across
Vercel function instances it means a KV store or it means nothing.

## Gotcha for later

Smart CDN invalidates within **up to 60 seconds** of an object changing. Photos are
immutable at unique paths, so this never bites them. `coverStoragePath()` is a stable
path written with `upsert: true` — so a replaced cover will serve stale at the edge
for up to a minute once the cover picker ships. Public or private makes no difference
here; a version segment in the cover path does.

## Corrections to v2 (verified 6 September 2026)

Four claims in v2 were checked against the code and the Supabase docs. Three change
what would be built.

**1. `?width=` does not work on a public object URL.** Recommendation 2 and the
"one upload per shot" bullet assume you can append `?width=400` to
`/storage/v1/object/public/…`. You cannot — transformations live on a different
endpoint:

> `https://project_id.supabase.co/storage/v1/render/image/public/bucket/image.jpg?width=500&height=600`

So the read function returning master paths is not sufficient; something must build
`render/image` URLs, and Once's flat `cdn.once.film/storage/…?width=600` is their
rewrite layer doing exactly that. **Recommendation 5 (custom domain) becomes a
prerequisite of recommendation 2, not an optional extra.**

**2. The transform quota is far smaller than "check the tariff" suggests.** Pro
includes **100 origin images per month**, then **$5 per 1,000**. One 200-photo
wedding exceeds the monthly allowance twice over. At 20 events × 200 photos that is
4,000 origin images, about **$19.50/month** — replacing a client-side resize that is
free, already written, and was chosen for measured device-cost reasons.
Recommendation 2 is a cost decision, not a cleanup.

**3. The slug is ~49 bits, not 52.** `SLUG_ALPHABET` in `lib/slug.ts:21` is 30
characters (`23456789abcdefghjkmnpqrstvwxyz`, no vowels or lookalikes) at
`SLUG_LENGTH = 10`. 30^10 ≈ 5.9e14 ≈ 2^49. The argument is unaffected — a 122-bit
uuidv4 path is still far stronger than the front door — but the number quoted for
OurFilm is base-36's, not this project's.

**4. "A KV store or it means nothing" is too strong.** Next's Data Cache
(`unstable_cache`) is durable and shared across function instances on Vercel, so a
signed-URL map can be cached without provisioning anything. This does not rescue v1's
recommendation over v2's deterministic-signing alternative — locally minting the JWT
is still better, with no cache and no round trip — but the dismissal named the wrong
obstacle.

**5. Vercel Pro allows 1800s, not 800s.** Per-function extended max duration
(currently beta) reaches 30 minutes on Node 20/22/24; only the _project default_
stops at 800s. Quoted as 800s earlier in this conversation, which made the server
export look more fragile than it is and made a browser-side rewrite look necessary.
It is not — see recommendation 3.

**Also unresolved:** CLAUDE.md lists "Host can hide unwanted photos" under _Landing
page promises_, with the standing rule that a change falsifying a live claim must
either honor it or update the Hungarian copy in the same change. Going public means
`hidden_at` stops working against anyone who already loaded the gallery. That is a
copy change to the FAQ, and it belongs in the same commit as recommendation 1.

## Provenance

Everything in the OurFilm column was read from this repository on 6 September 2026 —
chiefly `lib/capture.ts`, `lib/photo-urls.ts`, `lib/image.ts`, `lib/upload-shot.ts`,
the album export route, and migrations `20260824174541` / `20260824174542`. The
Cloudflare edge was confirmed with a single `HEAD` against the project's own storage
host.

The Once column is read entirely from network traffic captured against one film, plus
one delivery URL. Their RLS policies, their reveal enforcement and their retry
behaviour are not observable from outside, and nothing here was tested against their
systems. Treat every **inferred** row as a hypothesis that a later capture could
overturn.

The v2 revision changed no observations. It changed what the observations were taken
to mean.
