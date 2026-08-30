# OurFilm MVP backlog

> **HISTORICAL — superseded by the disposable camera pivot (2026-08-25).**
>
> This file plans the _shared photo album_ product. OurFilm is now a private
> digital disposable camera: a fixed roll of shots per guest, a capture window,
> and a host-controlled reveal. Phases 2–5 below describe routes, a data model
> and an upload flow that no longer exist, and the Once review's rejection of
> per-guest shot scarcity is exactly what the pivot reversed.
>
> **Still true and worth reading:** D1 (slug shape), D2 (region and the storage
> ceiling), D3 (ownership scoping, not multi-tenancy), D4 (self-serve delete),
> and the open pre-pilot items — real-phone testing, the deployment still behind
> Vercel SSO, custom SMTP, and the privacy policy.
>
> **Do not work the phase list.** `CLAUDE.md` is the current description of the
> product; the pivot's own build order is summarised there.

---

Work the phases in order. Within a phase, respect the stated dependencies;
otherwise order is flexible.

---

## Decisions — settled 2026-08-13

Do not reopen these without a reason; the tickets below already assume them.

- [x] **D1 — Slug format → readable stem plus a random suffix.**
      `anna-peter-k3f9x7`. Guests have no gate of any kind, so the URL is the
      only lock on the album, and `anna-peter` is enumerable in minutes from a
      list of common Hungarian first names. Six characters from a 30-character
      alphabet (no `0`/`o`, `1`/`l`/`i`, or `u`) gives ~729 million
      combinations. **Implemented** in `lib/slug.ts`: `slugify()` stays
      deterministic because the landing page calls it on every keystroke;
      `generateEventSlug()` is what real events get.
- [x] **D2 — Supabase free during development, Pro before the wedding.**
      Region is Zurich (`eu-central-2`), provisioned via the Vercel integration.
      Latency from Hungary is indistinguishable from Frankfurt. Note that
      Switzerland is outside the EU/EEA, so this is a third-country transfer —
      lawful under the Commission's adequacy decision for Switzerland, no SCCs
      required, but the privacy policy (6.5) must say where photos are stored.
      Free tier is 1 GB storage / 5 GB egress, and a
      well-attended wedding produces 1.2–2.4 GB, so **the free tier only
      survives if the pilot fails.** The upgrade is a blocking launch gate
      (6.0), not a nice-to-have. Expect the project to pause after any 7-day
      development gap.
- [x] **D3 — Ownership scoping via `events.owner_id`.** Host RLS keys off
      `owner_id = auth.uid()` rather than a blanket `to authenticated`, so a
      stray signup reaches an empty admin instead of owning every event.
      Touches the events, photos and storage policies plus the ZIP export.
      This is ownership scoping, **not** the multi-tenant dashboard that
      `CLAUDE.md` rules out.
- [x] **D4 — Build self-serve permanent delete (5.8).** The FAQ promises it
      twice on a live page, and GDPR erasure applies regardless. Roughly
      30 lines once admin exists: cascade the rows, purge the storage prefix.

---

## Phase 1 — Supabase foundation

- [x] **1.1 Provision project, wire local env.** Done. Project provisioned via
      the Vercel↔Supabase integration (Zurich). `vercel env pull` turned out to
      be a dead end — every variable is marked Sensitive and pulls back as
      `[SENSITIVE]` — so `.env.local` is maintained by hand from the Supabase
      dashboard. Watch the `NEXT_PUBLIC_` prefix: the integration also ships
      bare `SUPABASE_URL`/`SUPABASE_ANON_KEY`, which the browser cannot read.
      _Depends on: D2_
- [x] **1.2 Install SDK.** Done. `@supabase/supabase-js` 2.112.3 and
      `@supabase/ssr` 0.12.4.
      _Depends on: 1.1_
- [x] **1.3 CLI and migration workflow.** Done. The CLI is a **devDependency**
      (`supabase` 2.114.0), not a global or brew install, so the version is
      pinned in the lockfile — invoke it as `pnpm supabase …`. `init` and `link`
      are complete against `supabase-fomio` (`eu-central-2`, Postgres 17.6) and
      `pnpm supabase migration list` reaches the remote and returns empty.
      Migrations are append-only SQL files in the repo — never change schema
      from the dashboard.
      _Depends on: 1.1_
- [x] **1.4 Schema migration.** Done —
      `supabase/migrations/20260813130659_create_events_and_photos.sql`, applied
      to the remote. `events` (with `owner_id` → `auth.users`, `not null`,
      `on delete restrict`) + `photos` (with `thumb_path not null`), the partial
      index on `(event_id, created_at desc) where hidden_at is null`, and
      `events_owner_idx`. RLS enabled with **no** policies, so both tables are
      locked until 1.5. Verified against the live database: every column
      asserted by name through PostgREST, all six indexes present, anon `select`
      returns `[]` and anon `insert` is refused with `42501` on both tables.
      _Depends on: 1.3_
- [x] **1.5 RLS policies migration.** Done — `20260813133341_rls_policies.sql`
      plus `20260813134313_event_gallery_privacy.sql`, both applied.
      **Guests get no read policy on either table.** The originally documented
      `using (true)` would have exposed `GET /rest/v1/events?select=slug` — every
      album in the system — making the D1 slug suffix pointless. Reads go
      through `security definer` RPCs keyed on slug or event id
      (`event_by_slug`, `event_photos`), so there is nothing to enumerate.
      `event_accepts_uploads()` must also be `security definer`: policy
      expressions run as the invoking role, so an inline `exists` against
      `events` would be filtered by its RLS and silently fail every upload.
      Host policies scope to `owner_id = auth.uid()`.
      Verified by `supabase/tests/rls.py` — 19 checks, all passing.
      _Depends on: 1.4_
- [x] **1.5b Private gallery toggle (schema + policy).** Done. `gallery_hidden_at`
      on `events`: guests keep uploading, `event_photos()` returns nothing, and
      `event_by_slug()` surfaces `gallery_private` so the UI can explain the
      state rather than show an empty album. Reversible at any time. Admin UI
      for it is 5.6b.
      _Depends on: 1.5_
- [x] **1.6 Storage migration.** Done — `20260813135648_storage_bucket.sql`,
      applied. `event-photos` bucket: public, 15 MB limit, `image/jpeg` only.
      **No select policy for anon** — a public bucket serves downloads without
      consulting RLS, so a select policy would add nothing for viewing while
      enabling `object/list`, which walks every event id and photo id in the
      project. Guest insert is scoped by `event_folder_accepts_uploads()`
      (`security definer`, same RLS trap as 1.5); host access is scoped by
      ownership. Folder segments compared as text, never cast to `uuid`.
      Verified by `supabase/tests/storage.py` — 16 checks, including the host
      paths exercised with a **real signed-in JWT** rather than `service_role`,
      which bypasses RLS and would have proven nothing.
      _Depends on: 1.4_
- [x] **1.7 Client modules.** Done. `lib/supabase/client.ts` (browser) and
      `lib/supabase/server.ts` (async `cookies()`, Next 16), both typed with the
      generated `Database`. `server.ts` imports `server-only`, so reaching it
      from a Client Component is a build error rather than a silent leak. Both
      use the anon key and carry the caller's session, so RLS still applies —
      the service role key stays confined to the ZIP export (5.7). Credentials
      go through `lib/supabase/env.ts`, which fails with a message naming the
      `NEXT_PUBLIC_` prefix trap instead of an opaque `Invalid URL` from inside
      the SDK.
      _Depends on: 1.2_
- [x] **1.8 Generated types.** Done. `lib/supabase/database.types.ts` generated
      from the live schema, plus `pnpm types:gen` and `pnpm types:check`.
      Verified as actually enforced, not merely present: a bogus column and a
      bogus RPC argument both fail `tsc`, and `types:check` was confirmed to
      exit 1 on a deliberately stale file.
      **Deviation from the original ticket:** this is _not_ wired into
      `pnpm verify`. `verify` runs after every edit and must stay fast and
      offline; a live-database call would make it need CLI auth and a network
      round trip, and break for anyone not logged into the Supabase CLI. The
      real protection is that generated types make a wrong column a compile
      error. Run `pnpm types:gen` after every `db push`; `types:check` is the
      deliberate drift check, and belongs in CI if that ever exists.
      _Depends on: 1.4_
- [x] **1.9 Data access layer.** Done. `lib/events.ts` (`getEventBySlug`,
      `uploadsAreOpen`) and `lib/photos.ts` (`getEventPhotos`), both
      `server-only` and both going through the RPCs rather than `.from()`.
      Row types are _derived_ from the generated function signatures
      (`Database['public']['Functions'][…]['Returns'][number]`), so adding a
      column to an RPC without updating callers is a compile error rather than
      a silent `undefined` — verified with a negative control.
      `lib/storage.ts` is separate and isomorphic: it holds `photoStoragePaths`
      (the single definition of the path layout every storage policy depends
      on) and `photoPublicUrl`, and imports no client, so Client Components in
      Phase 3 can use it without dragging in `server-only`.
      _Depends on: 1.7, 1.8_
- [x] **1.10 Dev seed event.** Done — `pnpm seed` (`scripts/seed.ts`).
      Host user created via the admin API, email confirmed, no password:
      magic-link only, matching 5.1. The seed takes the host from
      `SEED_HOST_EMAIL`, or the sole account if there is only one — no address
      is hardcoded, because a personal email does not belong in a committed
      script. Seeds one event with six
      photos put through the same shape as the Phase 3 browser pipeline —
      4096px bound at q92 plus a ~400px thumb — because tiny placeholders would
      make the gallery look fine while hiding the layout and payload problems
      worth catching. Idempotent: a re-run reuses the event and skips uploads.
      Verified end to end as `anon`: `event_by_slug` returns the event without
      leaking `owner_id`, `event_photos` returns six rows with dimensions, and
      both thumb (37KB) and full (233KB) fetch over the public URL.
      _Depends on: 1.9_

---

## Phase 2 — Guest event page

- [x] **2.1 Route scaffolding.** Done. `app/e/[slug]/{layout,page}.tsx`.
      `noindex` sits on the **layout** so it covers upload and gallery too
      rather than each page remembering; verified as
      `noindex, nofollow, nocache` in the response. `notFound()` on an unknown
      slug (404 confirmed), `force-dynamic`. `getEventBySlug` is wrapped in
      React `cache()` — every route needs the row twice, once in
      `generateMetadata` and once in the component, and Next does not dedupe
      arbitrary async calls the way it does `fetch`.
      _Depends on: 1.9_
- [x] **2.2 Event page UI.** Done. Name, date, upload CTA, gallery link, single
      column, primary action thumb-reachable at the bottom, 56px tap targets.
      Verified at a true 390px viewport (headless Chrome clamps window width on
      macOS, so this needed an iframe to measure honestly).
      `lib/format.ts` pins date formatting to UTC: `event_date` is a bare
      calendar day, so formatting it in any timezone behind UTC renders the
      _previous_ day — a 13 June wedding showing as június 12.
      _Depends on: 2.1_
- [x] **2.3 Closed-upload state.** Done, plus the private-gallery state, since
      both are the same screen and the data was already there. All four
      combinations exercised against the live event: open/closed uploads ×
      visible/private gallery. A private gallery explains itself rather than
      linking to an empty grid — "nobody uploaded anything" is a miserable
      thing to imply to a guest who just did. Covers the guest half of 5.6b.
      _Depends on: 2.2_

---

## Phase 3 — Upload

- [x] **3.1 HEIC handling.** Done — `lib/image.ts`. `isHeic()` is a cheap
      synchronous name-and-MIME check rather than `heic-to`'s byte sniffer,
      because importing the package to ask the question _is_ the 2.9 MB download
      being avoided. The extension half is not redundant: HEIC routinely arrives
      with an empty MIME type from Android pickers and iOS share sheets.
- [x] **3.2 Compression.** Done. 4096px bound, q0.92, EXIF orientation baked in
      via `imageOrientation: 'from-image'`, never upscales, files processed
      sequentially. Canvas requests `colorSpace: 'display-p3'` — the default is
      sRGB, which clips what a phone camera captures. Falls back to a detached
      `<canvas>` where `OffscreenCanvas` is missing (Safari < 16.4).
      _Depends on: 3.1_
- [x] **3.2b Thumbnail generation.** Done. ~400px JPEG produced from the bitmap
      already decoded in 3.2 — decode once, encode twice. Measured at 9 KB
      against 231 KB for the full image.
      _Depends on: 3.2_
- [x] **3.3 Picker and state machine.** Done —
      `components/event/upload-queue.tsx`, `app/e/[slug]/upload/page.tsx`.
      Per-file status `várakozik → előkészítés → feltöltés → kész | hiba`,
      processed strictly one at a time. The picker is disabled while the queue
      runs and `accept` keeps `.heic`/`.heif` listed, so nothing is silently
      unselectable.
      _Depends on: 2.2_
- [x] **3.4 Upload and insert.** Done — `lib/upload-photo.ts`. Both objects
      then the row, in that order. The photo id is generated per attempt rather
      than per queue item: guests hold insert-only rights on storage, so they
      cannot overwrite, and reusing an id after a partial failure would collide
      with the object the failed attempt already wrote. No `.select()` chained
      on the insert — guests have no read policy, so asking for the row back
      reports an error on a write that actually succeeded.
      Verified end to end from a browser as `anon`: RPC lookup, prepare, both
      objects, row insert.
      _Depends on: 3.2b, 3.3, 1.6_
- [x] **3.5 Retry and cleanup.** Done. Per-file retry re-queues that one file;
      object URLs are revoked on unmount so forty previews do not pin forty
      full-size images in phone memory; `beforeunload` guards navigation while
      the queue is busy, since uploads are not resumable.
      _Depends on: 3.4_
- [x] **3.6 Optional nickname.** Done, remembered in `localStorage`.
      Deliberately _not_ React state: seeding it during render breaks hydration
      (no `localStorage` on the server) and seeding it in an effect cascades a
      second render on every mount — which React 19's lint now flags. The input
      is uncontrolled and read at upload time.
      _Depends on: 3.4_
- [x] **3.7 Success state.** Done. Fires once the queue settles with at least
      one success, and adapts to a private gallery — telling a guest to go look
      at an album they cannot open would undercut the moment.
      _Depends on: 3.4_

- [ ] **3.8 Preserve HDR: pass JPEGs through, strip GPS surgically.**
      Re-encoding destroys the HDR gain map — a container-level structure that
      canvas cannot see, because canvas hands back tone-mapped SDR pixels. That
      is the visible "SDR vs HDR" dulling on a real photo. We only re-encode an
      in-spec JPEG to strip GPS, so the fix is to strip GPS _without_ touching
      pixels.
      Rule: if the file is JPEG, its long edge is ≤ 4096, and it is under ~4 MB,
      pass the original bytes through with the GPS removed. Otherwise re-encode
      as now (4096 cap, q0.92, Display P3). Thumbs are always generated.
      **The trap:** Apple stores the gain map as a second image referenced by
      MPF offsets in `APP2`. Any edit that changes the length of an earlier
      segment shifts everything after it and can silently break those offsets.
      So every edit must be **same-length and in place** — null the GPS IFD
      pointer and zero the GPS value regions rather than removing bytes.
      Blocked on a real HDR sample to verify against: a gain map cannot be
      fabricated with the tooling here, and shipping unverified byte surgery on
      guests' irreplaceable photos is not acceptable. Verify the map survives,
      the pixels are byte-identical, orientation is kept, and GPS is
      unrecoverable.
      _Depends on: 3.2. Does not help HEIC uploads — those must be converted for
      non-Safari browsers, which loses the gain map regardless._

---

## Phase 4 — Gallery

- [x] **4.1 Grid.** Done — `components/event/photo-grid.tsx`,
      `app/e/[slug]/gallery/page.tsx`. `grid-cols-2 sm:grid-cols-3`,
      `aspect-square`, `unoptimized` tiles. Verified against the live event that
      every rendered `<img>` points at `thumb_path` and none at `storage_path`:
      7 of 7 thumbs. Full-resolution URLs do appear in the RSC payload, since
      the lightbox needs them, but no bytes are fetched for them.
      _Depends on: 1.9, 3.2b_
- [x] **4.2 Lightbox.** Done — `components/event/lightbox.tsx`, built on a
      native `<dialog>` opened with `showModal()`, which supplies the focus
      trap, the inert background and Escape-to-close rather than reimplementing
      them (where hand-rolled lightboxes usually get accessibility wrong).
      Arrow keys, prev/next buttons at 48px, and touch swipe past a 50px
      threshold. **Caveat: the open/swipe interaction is not covered by an
      automated check** — it needs a click, and headless Chrome cannot be made
      to wait for this app's async work. Exercise it by hand, and on a phone in
      6.7.
      _Depends on: 4.1_
- [x] **4.3 Empty state.** Done, and distinct from the private-gallery state —
      "nobody has uploaded yet" and "the host has closed the album" look
      identical as an empty grid but mean opposite things to a guest who just
      contributed. Both verified against real events.
      _Depends on: 4.1_

---

## Phase 5 — Admin

- [x] **5.1 Magic-link login.** Done — `/admin/login`, `/auth/callback`,
      `/auth/signout`. The callback handles both shapes Supabase can send
      (`?code=` PKCE and `?token_hash=&type=`), because which one arrives
      depends on the dashboard's email template and guessing wrong yields a
      login link that silently does nothing. `shouldCreateUser: false`, so the
      host account is created deliberately rather than by anyone who finds the
      page. Sign-out is POST only — a GET could be triggered by any image tag.
      _Depends on: 1.7_
- [x] **5.2 Auth gate in `proxy.ts`.** Done. Next 16 wants `proxy.ts` exporting
      `proxy()` — but the matcher export is still **`config`**, not
      `proxyConfig` as the rename implies. That correction came from hitting it:
      with `proxyConfig` the matcher is ignored and the proxy runs on every
      request, so `/`, `/e/[slug]` and `/robots.txt` all redirected to the login
      page. Silently. Uses `getUser()`, never `getSession()`, which reads the
      cookie without verifying it.
      Verified both directions: signed out, `/admin` redirects and `/` returns
      200; signed in, `/admin/login` bounces to `/admin`.
      _Depends on: 5.1_

- [x] **5.3 Admin shell.** Done — event list with upload-closed and
      hidden-gallery badges. `getOwnedEvents()` deliberately carries no owner
      filter: RLS scopes it, and writing `.eq('owner_id', …)` would imply the
      database is not already doing so. Verified with a second real signed-in
      account, which gets 200 and an empty list rather than someone else's
      events.
      _Depends on: 5.2_
- [x] **5.4 Create event.** Done — `/admin/events/new`, a Server Action with
      `useActionState`. Slug from `generateEventSlug()`, retried up to five
      times but _only_ on `23505`; any other error surfaces rather than looping.
      The upload deadline is converted to ISO **in the browser**, because a
      `datetime-local` value carries no timezone and resolving it server-side
      would silently use the server's.
      Verified that an authenticated insert succeeds under RLS and that one
      claiming a forged `owner_id` is refused with 403 — the `with check` half
      of the policy, which the read-side tests never exercised.
      _Depends on: 5.3_
- [x] **5.5 QR and printable card.** Done — `components/admin/qr-card.tsx` on
      `/admin/events/[slug]`, plus `@media print` rules in `globals.css`.
      The URL comes from `lib/site.ts`, which defaults to **production**
      regardless of where the page is rendered: a card generated in development
      must not encode `localhost`, and that mistake stays invisible until
      someone scans one at the venue. Confirmed the rendered QR encodes
      `https://ourfilm.app/e/…` with no localhost anywhere on the page.
      Rendered as SVG, not canvas, so it prints at the printer's resolution
      rather than the screen's. Error correction stays at M — higher levels
      pack in more modules, and a denser code is harder for an older phone to
      read across a dim room, which is the likelier failure here than damage.
      Print CSS drops the dark theme and hides everything but the card;
      printing a near-black app would waste a cartridge and produce something
      unscannable.
      **Still unverified: an actual physical print and scan** — that is 6.8.
      _Depends on: 5.4_
- [x] **5.6 Moderation.** Done — `components/admin/moderation-grid.tsx` on the
      event page. Soft delete only; hidden tiles dim rather than vanish, so a
      host can undo a mistap.
      The action asks for the affected rows back and throws when none come. An
      UPDATE has to SELECT the row first, so a missing or non-matching read
      policy returns **zero rows and no error** — the difference between
      "moderated" and "silently did nothing" is invisible otherwise. Verified
      against the live database: hide affects exactly one row, the guest RPC
      drops the photo, restore brings it back.
      The limit stands: the object is still fetchable at its public URL by
      anyone holding it, and public objects are CDN-cached. This removes a photo
      from the album, which is what moderation means; erasure is 5.8.
      _Depends on: 5.3_
- [x] **5.6b Private gallery toggle (UI).** Done —
      `components/admin/gallery-toggle.tsx`, a `role="switch"` with
      `aria-checked`. The copy states outright that guests can still upload
      while the gallery is closed: "hidden" reads like "closed for business"
      otherwise, and a host planning a reveal needs to know contributions keep
      arriving. Guest side was already covered in 2.3.
      _Depends on: 5.3, 1.5b_
- [x] **5.7 ZIP export.** Done — `/admin/events/[slug]/export`.
      **It does not use the service-role key**, contrary to the original plan.
      That assumed the export had to bypass RLS; it does not, because the bucket
      is public so objects fetch without credentials, and the host's own session
      already reads exactly their rows. `getOwnedEventBySlug` returning null is
      the ownership check. Keeping the service key out of a path that streams
      user data is a straight win.
      Streams via `client-zip` fed by an **async generator**, so one object is in
      flight at a time — an array of `fetch` promises would open a connection per
      photo up front and defeat the streaming. No `Content-Length`: it needs
      exact compressed sizes, and being wrong by one byte truncates the archive
      silently, which is worse than a spinner. A failed object is skipped and
      listed in `HIANYZO-KEPEK.txt` inside the ZIP rather than aborting a
      download already under way.
      Verified: unauthenticated request redirects; authenticated download is a
      valid 22 MB / 41-file archive passing `unzip -t`, Hungarian filenames
      intact, every object fetched cleanly.
      _Depends on: 5.3_

- [x] **5.8 Permanent event delete.** Done —
      `components/admin/danger-zone.tsx`, behind a confirmation dialog naming
      the event and its photo count — "are you sure?" alone says nothing about
      the scale of what you are agreeing to, and this is the only irreversible
      action in the product. Built on a native `<dialog>` for the focus trap,
      inert background and Escape handling; cancel holds focus so Enter
      dismisses rather than deletes, and a backdrop click dismisses too.
      Objects first, rows second: deleting the event cascades the photo rows, and
      without them nothing records which objects existed — reversed, the files
      sit orphaned in the bucket, still fetchable at their public URLs, which is
      exactly what an erasure request forbids. Runs on the host's session, not
      the service key.
      Verified on a throwaway event: objects listed, removed, event deleted,
      rows cascaded, zero left behind. Expect CDN lag on public URLs — verify by
      listing the folder, never by re-fetching.
      _Depends on: 5.3, D4_

---

## Phase 6 — Pre-pilot

- [x] **6.1 Funnel instrumentation — answered with what already exists.**
      No custom tracking: this is an MVP, and a bespoke events table is more
      product than the question needs.
      The numerator is already in the database — rows in `photos`, with distinct
      `uploader_name` values as a rough headcount. The denominator comes from
      Vercel Web Analytics, already wired in the root layout, which reports page
      views per route: `/e/[slug]` (landed) versus `/e/[slug]/upload` (opened
      the picker). Uploads over landings is the participation rate the pilot is
      measuring.
      **Superseded in part:** `/e/[slug]/upload` no longer exists — the queue
      was inlined onto the event page, so landing and opening the picker are
      one page view. The headline rate survives unchanged, because the
      numerator was never that route: it is rows in `photos` over page views of
      `/e/[slug]`. What is lost is the middle signal that separated "saw the
      page and did nothing" from "opened the picker and gave up", so a
      disappointing result will be harder to diagnose than to detect.
      Two honest limits. Vercel **custom events** need a paid plan and no-op
      silently without one, which is why none are used — plain page views are
      included and do work. And page views are not unique visitors, so a guest
      who reloads counts twice; for one wedding the number is directional, not
      exact. Good enough to answer "did guests use the QR", which is the whole
      question.
      **One manual step, and it is load-bearing:** `<Analytics />` is already in
      the root layout, but it collects nothing until Web Analytics is enabled
      for the project in the Vercel dashboard (Project → Analytics → Enable).
      Without it `/_vercel/insights/script.js` 404s and the whole measurement
      silently produces zero — the same failure mode custom events were
      rejected for. Confirm it is on, and confirm a real page view lands once
      6.7b turns off deployment protection.

- [x] **6.2 Verify ownership scoping holds.** Done, against two real accounts
      that each own events. At the HTTP layer a signed-in host gets 404 on
      another host's event page and export, and `/admin` lists only their own.
      At the database layer, with that host's real JWT, hiding another host's
      photo, hiding their gallery and deleting their event all leave the data
      untouched — and all three return **success** status codes (200, 204, 204)
      while changing nothing. That silence is the point: it is why every host
      action asserts affected-rows > 0 rather than trusting the absence of an
      error. `rls.py` and `storage.py` also re-run clean after the `taken_at`
      migration (19/19 and 16/16). Not covered: the four cross-owner write
      checks were run ad hoc, not added to `rls.py`, which still only exercises
      anon-vs-host. Worth folding in if that file is touched again.
- [ ] **6.2b Disable public signups.** Split out of 6.2, which it was buried in.
      Defence in depth rather than a fix — ownership scoping holds without it —
      but there is no reason for a stranger to be able to create an account on a
      single-wedding pilot.
- [ ] **6.3 Landing page truthfulness.** The 3.2M photos / 12,400 events /
      "4,9 / 5 · 2 800+ értékelés" stats and the three named testimonials are
      fabricated, on a live domain, for a product with no users. Decide before
      real traffic — invented review counts are an EU consumer-protection
      exposure, not only a taste question.
- [x] **6.4 Wire the CTAs.** Done. Every "Esemény létrehozása" now goes to
      `/admin/login`; previously they scrolled to the closing section whose only
      link scrolled back to the hero — a literal loop with no exit.
      Magic link now signs up as well as in (`shouldCreateUser: true`), and the
      login page says so, since "Belépés" reads as members-only to someone
      arriving from a create-an-event button. Safe because ownership scoping is
      enforced in the database: a new account sees an empty admin, verified with
      a second real account.
      Verified end to end against Resend — a brand-new address returned 200 and
      the account was created. `generator: 'v0.app'` was already removed.
      **Open consequence:** anyone can now create events that accept anonymous
      uploads, against a shared storage tier. 6.6 matters more than it did.

- [ ] **6.5 Privacy policy.** The FAQ makes explicit data-handling claims, and
      this is an EU consumer product handling photos of identifiable people.
      **Scaffolded, not written** — `/adatvedelem` now has thirteen sections
      whose factual parts describe what the code actually does (Zurich storage
      and the Swiss adequacy basis per D2, RLS scoping, no guest cookies, the
      erasure route from 5.8). Everything legal is marked TODO, the page
      carries a visible draft banner and `noindex`, and it is kept out of
      `sitemap.ts`.
      **The open question a lawyer has to settle first — now with a
      precedent:** for the photos in an event, is the host the controller and
      OurFilm the processor, or are they joint controllers? Kululu publishes a
      DPA naming the host as controller and itself as processor, which is the
      model for this category and fits how our product works. Note none of the
      competitors surveyed (Kululu, GuestPix, Once) address people who appear
      in photos but never used the service — even Kululu's DPA covers the
      processor's duties to the host, not the host's duties to guests. German
      photography-law guidance says that duty can be shifted to the host and
      discharged by a sign at the venue, which the printed QR card already is:
      one line on the card turns an artefact we print anyway into the notice.
      Recorded in `/aszf` under the host's responsibilities. It decides who answers an erasure request from someone
      photographed at a wedding — a data subject who never visited the site and
      never agreed to anything — and it changes the ÁSZF as well as this page.
      Benchmarked against once.film's policy, which runs on the same stack
      (Supabase + Vercel): its structure is worth following, its text is not.
      That policy is US-primary with GDPR annexed, is built around guest
      accounts we do not have, names the US as the storage location, and
      retains purchase records we never create.
- [ ] **6.5b ÁSZF — Hungarian mandatory elements.** Split out of 6.5; the
      privacy notice and the terms are different documents with different
      statutory sources. `/aszf` is scaffolded against 45/2014. (II. 26.) Korm.
      rendelet and the Elker tv. rather than a competitor's terms — none of the
      surveyed services are Hungarian, so none help here. Sections now flag the
      mandatory identifiers (adószám, bejegyző bíróság, cégjegyzékszám,
      kamara), gross pricing, panaszkezelés, and the békéltető testület
      cooperation declaration.
      **The trap to watch when payments land:** for a digital service not on a
      tangible medium, the consumer loses the 14-day `elállási jog` only if
      performance starts at their express prior request _and_ they separately
      acknowledge losing the right. A host buys an event and uses it that
      weekend, so without both declarations wired into checkout — not merely
      written in the ÁSZF — refunds are owed for 14 days.
- [ ] **6.6 Abuse ceiling.** Uploads are anonymous and unlimited. The bucket caps
      file size but not volume. Decide whether a per-event cap is needed.
- [ ] **6.7 Real-device matrix.** iPhone Safari (HEIC path), Android Chrome (JPEG
      path), one multi-select of 10+ photos, one throttled connection.
      Simulators reproduce none of these.
- [x] **6.7b Turn off Vercel Deployment Protection.** Done — `ourfilm.app`,
      `/e/[slug]` and `/robots.txt` all return 200 publicly, no SSO redirect.
- [x] **6.7c Point the domain.** Done — `ourfilm.app` resolves and serves the
      app. (Registered as `ourfilm.app` rather than the originally planned
      `fomio.io`; the product was renamed to match.)
- [ ] **6.7d Configure custom SMTP via Resend. Blocking launch gate.**
      Supabase's built-in service refuses delivery to anyone outside the project
      team and allows 2 messages/hour with no SLA. Magic link is the only way
      into `/admin`, so email _is_ the lock.
      **Resend chosen** — free tier is 3,000/month and 100/day with 1 domain,
      against a real need of maybe a dozen login links ever.
      **Ordering matters: this depends on 6.7c.** Resend SMTP requires a
      _verified domain_, so `ourfilm.app` must be registered and its DNS records
      in place first. Attempting this before that is wasted effort.
      Then in Supabase → Authentication → SMTP Settings:
      host `smtp.resend.com`, port `465` (implicit TLS) or `587` (STARTTLS),
      username `resend`, password = the Resend API key, sender something like
      `OurFilm <noreply@ourfilm.app>`. Supabase's own rate limit starts at 30/hour
      once custom SMTP is on, which is ample.
      The same key must be set on Vercel as `RESEND_API_KEY` for the legal
      request forms on `/hu/kapcsolat`; `LEGAL_EMAIL_FROM` may override their
      default sender, `OurFilm <noreply@ourfilm.app>`.
      Until then, sign in with `POST /auth/v1/admin/generate_link` and the
      service key — it returns a working login link without sending mail.
      _If email is ever needed before the domain exists, a provider offering
      single-sender verification (SendGrid does) avoids the domain requirement;
      Resend does not._
- [ ] **6.8 Print and scan.** Full physical loop with a real printed card.
- [x] **6.11 Delete `/pipeline-test`.** Done — the page and its report route
      are gone, so nothing unlisted ships publicly any more. Note it went
      **before** 6.7 rather than after: this ticket had kept it because opening
      it on a real iPhone was the cheapest way to answer the `OffscreenCanvas`
      question, and that answer is still outstanding. Whoever runs the
      real-device matrix now tests through the real upload screen instead, which
      is a fair substitute for the pipeline but gives no per-stage readout — put
      the harness back from git history if that turns out to matter. (The
      `/upload-test` harness it shipped alongside was already deleted; the real
      upload screen supersedes it.)
- [x] **6.9 Fix `backdrop-filter` prefixing.** Done. The build was emitting
      only `-webkit-backdrop-filter` for `.glass`, `.glass-strong` and
      `.glass-nav`, so Firefox got no blur anywhere on the site.
      Cause was the opposite of what it looked like: Lightning CSS **adds** the
      prefix itself, and the hand-written `-webkit-` line next to the standard
      one made its deduplicator keep the prefixed declaration and drop the
      standard one. The tell was that Tailwind's own `backdrop-blur` utilities
      and the print rule — none of which are hand-prefixed — emitted both
      correctly. Removing the three manual lines fixed it; all three utilities
      now emit both properties.

---

## Capture time (2026-08-18)

- [x] **Keep the EXIF capture time.** `photos.taken_at`, read in the browser by
      `lib/exif.ts` before `prepareForUpload` re-encodes and destroys the EXIF.
      Parses JPEG (APP1 → TIFF → sub-IFD, both byte orders, not assuming APP1
      comes first) and HEIC (`meta`/`iinf`/`iloc`), pairs each timestamp with
      its own offset tag, and rejects unset clocks — a camera with a dead
      battery writes 1980 rather than omitting the tag. Returns null on anything
      malformed: unreadable metadata must never cost a guest their photo. Done
      now rather than later because it is a one-way door — the data exists only
      on the guest's device at the moment they pick the file, and every photo
      already uploaded has lost it. Covered by `pnpm test:exif`, 15 fixtures
      built byte by byte with no new dependency.

- [x] **Spend it on the ZIP export.** The export previously claimed a chronology
      it did not have: it numbered by upload order under a comment promising
      "the order the night happened in", and stamped every extracted file with
      the morning someone got round to uploading. Now ordered by
      `coalesce(taken_at, created_at)` and named `001-2026-08-15_1432-Anna.jpg`.
      A ZIP's DOS timestamp carries no zone, so `lastModified` goes in as the
      event's wall clock via `eventWallClock` — verified identical with the
      server running UTC, New York and Budapest, which local testing had hidden.

- [x] **Write the capture time back into the exported file.** `lib/exif-write.ts`
      splices a minimal Exif APP1 into each JPEG as it streams out of the
      export. The ZIP entry date alone is not enough and the reason is worth
      remembering: it lands as the file's _modification_ date, and Photos reads
      `DateTimeOriginal` instead — falling back, when there is none, to the
      creation date, which is the instant the archive was unzipped. So an album
      imported into iCloud collapsed onto a single day even though the ZIP
      listing looked right. Writes `DateTimeOriginal`, `DateTimeDigitized` and
      IFD0 `DateTime`, each with its own offset tag, because readers disagree
      about which they trust; replaces the canvas's existing Exif block rather
      than adding a second, since readers take the first. Time tags only — there
      is no code path here that could emit a location, and the coordinates never
      reached the server in the first place. Verified with ImageMagick on an
      extracted file: seven tags, all time, ICC profile intact, no GPS.

- [x] **Leave the guest gallery on upload order.** Deliberate, not an omission.
      Newest-upload-first is what shows a guest their own photo the instant it
      lands; ordering by capture time would drop it into the middle of the grid
      and read as a failed upload — the exact signal this pilot exists to
      measure. Revisit only after the pilot answers that question.

- [ ] ~~**Write the capture time at upload instead of at export.**~~ Considered
      and declined. It would make each stored object self-describing, which
      would close one real gap: the lightbox serves the full object from a
      public bucket, so a guest who saves a photo out of the gallery gets an
      undated file — only ZIP downloads carry dates. Declined anyway on three
      counts. It cannot replace `taken_at`: the export numbers files in capture
      order and builds each name before fetching a byte, so ordering a 600-photo
      album from file bodies would mean parsing 600 headers first — it would be
      a third home for the date, not a simplification. It freezes a timezone
      decision made on the guest's device, so someone uploading after flying
      home would bake a foreign offset into a Hungarian wedding photo, whereas a
      `timestamptz` rendered at export stays correctable. And guests hold
      insert-only rights on storage, so a wrong baked date needs service-role
      object rewriting where a column needs one `UPDATE`. Revisit only if guests
      turn out to save photos out of the gallery often.

- [ ] **Verify capture time against a real iPhone.** The HEIC path is tested
      against a hand-built fixture, which proves the box walker handles the
      layout _I_ wrote — not the one Apple writes. Fold into 6.7 (real-device
      matrix): upload one HEIC and one camera JPEG straight from a phone and
      confirm `taken_at` matches the Photos app. Until then, treat HEIC capture
      time as unproven on real hardware.

## Adopted from Once (competitor review, 2026-08-18)

Screenshots of Once's create flow and logged-in home were reviewed. Three
things were taken; the rest was rejected on purpose.

- [x] **Name suggestion chips** on `/admin/events/new` — event types
      (Esküvő, Szülinap, Céges buli, Ballagás, Évforduló) rather than
      personalised titles, since there is no host name to interpolate. Removes
      the blank-field pause.
- [ ] ~~**Guest-view preview**~~ — built, then removed. A live iframe of
      `/e/[slug]` on the admin event page, intended as a pre-print check.
      Rejected in use: the host has just filled in the name and date, and a
      "Vendégnézet" link to the real page already sits alongside the QR card, so
      the embedded copy earned no room it took.
- [x] **Thumbnails and an active/finished split** in the admin list, with a
      `+N` overflow. Hidden photos are excluded from the strip but counted in
      the overflow, so the number matches the moderation grid.

**Deliberately not taken**, each because it contradicts something already
settled:

- _Shots per person_ (5/10/16/24/∞) — a scarcity mechanic for a
  disposable-camera product; contradicts "chat apps crush your photos, we
  don't".
- _Automated delayed reveal_ (During / After / Additional delay) — the exact
  feature ruled out in `CLAUDE.md`. The manual toggle already covers the need.
- _Paid participant tiers_ — implies a pricing model there isn't one for.
- _The film/tape metaphor and its tab bar_ — it exists to justify shot limits
  and reveals. Taking the vocabulary without the mechanics is hollow; taking
  the mechanics means becoming Once.
- _A six-step wizard_ — right for their eight decisions, wrong for three
  fields.

Their guest flow is an in-app camera, so guests install an app and get an
account. Not having that is the whole wedge here, so none of their guest-side
design transfers — only host-side polish.

Still open from that review: a **countdown** on the guest page
("még 3 óra 20 perc"), which would use `uploads_close_at` to create the urgency
the pilot is measuring, and fill the space the centred layout leaves.

---

## Phase 7 — Payments and roles

Added 2026-08-20 on an explicit request, overriding the "never start it" flag
`CLAUDE.md` carried for payments. The design decisions were confirmed before
any code: one-time per event, the gate is a free photo cap, roles are `user`
plus `admin`.

- [x] **7.1 Roles.** `app_role` enum, `profiles` table, trigger on
      `auth.users`, `public.is_admin()`, and the admin bypass OR'd into the
      host policies on `events`, `photos` and `storage.objects`. No
      self-update policy on `profiles` — nobody promotes themselves.
      Migration `20260820100000_user_roles.sql`.
      _Depends on: D3_
- [x] **7.2 Billing schema.** `purchases` ledger, `stripe_webhook_events`
      idempotency table, `free_photo_limit()` (**5**), and the cap wired into
      both guest write paths — `event_accepts_uploads()` for the row and
      `event_folder_accepts_uploads()` for the object.
      Migration `20260820100100_stripe_billing.sql`.
      _Depends on: 7.1_
- [x] **7.3 Stripe plumbing.** `lib/stripe/{env,client}.ts`, `lib/billing.ts`,
      `lib/roles.ts`, the checkout Server Action, and the webhook at
      `POST /api/stripe/webhook` — signature verification, replay protection,
      full-refund handling.
      _Depends on: 7.2_
- [x] **7.4 UI.** Admin billing card with quota, receipt and unlock button;
      guest upload queue that knows its budget, refuses to queue what cannot
      land, and explains a full album without mentioning money. `/arak` now
      states the 5-photo cap, because it is real and enforced.
      _Depends on: 7.3_
- [ ] **7.5 Push the migrations.** `pnpm supabase db push --linked`, then
      `pnpm types:gen` — `lib/supabase/database.types.ts` was extended by hand
      offline, and `pnpm types:check` is the drift check that proves it right.
      Then re-run `python3 supabase/tests/rls.py` and `storage.py`: this
      changed four policies and two gate functions.
      _Depends on: 7.2 · needs `SUPABASE_DB_PASSWORD`_
- [ ] **7.6 Create the Stripe account.** Then `vercel integration add stripe`,
      create the one-time Price in HUF, and fill `STRIPE_SECRET_KEY`,
      `STRIPE_WEBHOOK_SECRET` and `STRIPE_PRICE_EVENT` locally and on Vercel.
      Until this lands `stripeIsConfigured()` is false and the admin card says
      so rather than offering a button that 500s.
      _Depends on: 7.3 · **blocked: no Stripe account**_
- [ ] **7.7 Promote your own account to `admin`.** One statement in the SQL
      editor: `update public.profiles set role = 'admin' where id = '…'`. Do it
      after 7.5, and expect `/admin` to start listing every event.
      _Depends on: 7.5_
- [ ] **7.8 Decide the actual price.** `/arak` still shows `— Ft` and is
      `noindex` for exactly that reason. The amount lives in Stripe, so this is
      a dashboard decision plus a copy change, not a code change.
      _Depends on: 7.6_
- [ ] **7.9 Test the webhook end to end.**
      `stripe listen --forward-to localhost:3000/api/stripe/webhook`, pay with
      `4242…`, confirm the cap lifts. Then replay the same event and confirm it
      is a no-op, and refund the charge and confirm the cap comes back.
      _Depends on: 7.6_

---

## Out of scope

Flag and ask before starting any of these — they are deliberately excluded:

App Clip or native app · photographer/multi-tenant dashboard · per-client
branding · tokens, revenue share, **invoicing** · guest accounts or mandatory
registration · delayed reveal · film filters · email notifications ·
multi-language · realtime gallery updates · resumable or background uploads.

**Payments left this list on 2026-08-20** — see Phase 7. Invoicing did not: a
Hungarian company selling to consumers must issue an invoice and report it to
NAV Online Számla, and Stripe does not do that for you. Flag it before the
first real forint.

Note the free-photo cap is **not** the "shots per person" mechanic rejected in
the Once review above. That was a per-guest scarcity device meant to shape how
people shoot; this is a per-event free tier on the host's side, invisible to a
guest until an album is full, and it does not contradict "chat apps crush your
photos, we don't".
