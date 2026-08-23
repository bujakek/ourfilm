# Project: OurFilm — QR-code shared photo album for events

> Product name: **OurFilm**. Domain: `ourfilm.app`. (Earlier working names "Fomio", "Moments" and "Pillanatok" are deprecated — never use them in code or copy.)
>
> Hungarian suffixes attach directly: **az** OurFilm (vowel-initial, so `az` not `a`), OurFilm**mel** (instrumental, assimilating like _filmmel_).

## Read this first

Guests scan a QR code at an event and upload photos from their phone browser — **no app, no account**. The host views and downloads all of them afterward.

**Phase: MVP / pilot for one real wedding.** The single question we're answering: do guests actually use the QR to upload? Nothing else matters yet. There is no validated business model — don't build for scale, don't build for a second customer.

**Language:** UI copy is **Hungarian only** today, but the routing and content
model are locale-prefixed and English-ready — see "Locales" below. Code,
comments, commit messages, and this doc stay in English.

**Mobile-first, always.** Guests arrive almost exclusively on phones via QR or a shared link. Design and test at 390px width before anything else.

## Before you say a task is done

```bash
pnpm verify   # typecheck + lint + build. Must pass.
pnpm format   # Prettier; run after writing files
```

Never use npm or yarn — this project is **pnpm**. Never re-add `typescript.ignoreBuildErrors` to `next.config.mjs`; it was removed deliberately so type errors actually fail the build.

## Skills — load these instead of re-deriving conventions

Project skills live in `.cursor/skills/`. Read the relevant one _before_ writing code in that area:

| Skill              | Load when                                                                                        |
| ------------------ | ------------------------------------------------------------------------------------------------ |
| `ourfilm-ui`       | Building or restyling any page or component (glass surfaces, tokens, Hungarian copy conventions) |
| `ourfilm-supabase` | Touching the database, migrations, RLS, storage buckets, or auth                                 |
| `ourfilm-upload`   | Working on the photo upload pipeline (HEIC, compression, direct-to-Storage)                      |

## Tech stack

- **Next.js 16** (App Router, Turbopack), **React 19**, TypeScript strict
- **pnpm**; hosted on **Vercel**
- **Supabase** — Postgres + Storage + Auth, installed and connected (`@supabase/supabase-js`, `@supabase/ssr`). The CLI is a devDependency: `pnpm supabase …`
- **Tailwind CSS v4** — CSS-based config via `@theme` in `app/globals.css`. There is **no `tailwind.config.js`**; don't create one
- **shadcn/ui** (`components.json`, style `base-nova`) on `@base-ui/react`; `lucide-react` icons
- **qrcode.react** for QR generation
- ESLint (flat config, `eslint.config.mjs`) + Prettier (`.prettierrc.json`, no semicolons, single quotes, Tailwind class sorting)

### Local env

`.env.local` is gitignored and **must never be committed**. It is maintained **by hand**. Supabase needs three keys:

```bash
NEXT_PUBLIC_SUPABASE_URL=       # Supabase dashboard → Project Settings → API Keys
NEXT_PUBLIC_SUPABASE_ANON_KEY=  # the anon / public key
SUPABASE_SERVICE_ROLE_KEY=      # service_role; server-only, Stripe webhook
```

Payments add three more, all server-only — Checkout is a redirect to Stripe's
hosted page, so the browser never needs a publishable key:

```bash
STRIPE_SECRET_KEY=              # sk_test_… while piloting
STRIPE_WEBHOOK_SECRET=          # whsec_…, from the endpoint or `stripe listen`
STRIPE_PRICE_EVENT=             # price_… for the one-time per-event purchase
```

**The Stripe account exists and test mode is wired up locally.** All three
are filled in in `.env.local`, so `stripeIsConfigured()` is true and the admin
billing card offers checkout. Nothing is set on Vercel yet, so payments are
still off in every deployed environment — `stripeIsConfigured()` is what keeps
that UI honest.

- `STRIPE_SECRET_KEY` is an **`sk_test_`** key. Live mode is not activated.
- `STRIPE_PRICE_EVENT` is `price_1U6nve35IJWm7mht2mSfIVDO` — a test-mode
  one-time Price, 1290000 HUF minor units (12 900 Ft), on product
  `prod_V71zasJ11DOF1Y` ("OurFilm - korlátlan feltöltés egy eseményhez"). That
  product name is what a host reads on Stripe's hosted checkout page, so it is
  copy, not a label. Live mode needs its own Price; test and live objects
  never cross.

  **List before you create.** A second product/price pair with the same
  12 900 Ft amount was created here by accident and archived again
  (`prod_V7oYzn5uXQ8vgH`); two active identical Prices is how an account ends
  up billing from the wrong one. `stripe products list` first.

- `STRIPE_WEBHOOK_SECRET` is the one `stripe listen --print-secret` prints for
  **this machine**. It is per-destination: a deployed endpoint has a different
  `whsec_`, taken from that endpoint in the dashboard. Copying this one to
  Vercel would fail every signature check.

Provision production with `vercel integration add stripe` — it is the
Marketplace provider for `payments` and wires the production variables itself.

**`vercel env pull` does not work on this project — don't reach for it.** The Vercel–Supabase integration created all 16 of its variables as _Sensitive_, which on Vercel means write-only: the value cannot be read back by the CLI, the API or the dashboard, and a pull returns the literal string `[SENSITIVE]` for every one. This is a property of the Sensitive flag, not of the environment scope, so re-scoping them to Development does not help either. Copy the three values from the Supabase dashboard instead.

The integration's other variables are irrelevant here: the `POSTGRES_*` ones are connection strings for direct SQL clients, and `supabase-js` talks over HTTP. It also provisions Supabase's newer `publishable`/`secret` keys alongside the legacy `anon`/`service_role` pair — the code expects the legacy names; migrating is a deliberate choice, not something to drift into.

Deployed builds are unaffected: Vercel injects all of these at build and runtime. This is purely a local-development concern.

## Current state

- **`docs/mvp-backlog.md` is the working plan** — the build order below, broken into ordered tickets with dependencies, plus four decisions that block Phase 1. Check it before starting work, and tick items off as they land.
- **Marketing landing page** — `app/[locale]/page.tsx` composing `components/site/*` (hero, stats, how-it-works, occasions, testimonials, qr-preview, live-demo, photo-quality, faq, final-cta, footer). Originally v0-generated, now the permanent homepage at `/hu`, with `/` redirecting to it.
- `components/site/live-demo.tsx` is a **fake simulation** with hardcoded images, not a real gallery.
- **Phases 1–5 built** (see `docs/mvp-backlog.md`): migrations applied, RLS and storage policies enforced and covered by `supabase/tests/*.py`, typed clients and query modules in `lib/`, the guest event page and gallery, the upload pipeline and queue, and the admin area. `pnpm seed` creates an event to develop against and prints its URL.
- **Guest pages are latency-tuned; the migration may still be pending.**
  `20260821090000_guest_page_round_trips.sql` adds `event_page_by_slug` and
  `event_gallery_by_slug`, and `lib/events.ts` / `lib/photos.ts` already call
  them — so **the guest routes 500 until it is pushed**. Deploying the code
  and pushing the migration are two separate acts and there is no CI step that
  does the second one; `pnpm supabase db push` is manual.
- **`20260822100000_photo_view_render.sql` is applied on the remote.** It adds
  `photos.view_path` and **drops and recreates** `event_photos` and
  `event_gallery_by_slug` to return it (a `returns table` cannot gain a column
  via `create or replace`), so the lightbox now serves a ~1600px render instead
  of the 4096px master. Photos uploaded before it keep working: the column is
  nullable and every reader falls back to `storage_path`. Run
  `pnpm types:check` if `lib/supabase/database.types.ts` looks suspect — the
  `view_path` entries there were hand-written to match the generator rather
  than regenerated.
- **Roles and the billing schema are live; Stripe is live in test mode only.**
  `20260820100000_user_roles.sql` and `20260820100100_stripe_billing.sql` are
  **applied on the remote**, so the 5-photo cap is real and enforced today.
  Stripe is now configured **in test mode, locally only**: `.env.local` has all
  three `STRIPE_*` keys, so a host can run a full test checkout on a dev
  machine. No `STRIPE_*` variable is set on Vercel, so every deployed
  environment still says payment is not switched on. See Billing below.

  **Check, never assume, which migrations are live.** This section claimed for
  a while that roles and billing were unpushed after they had been pushed, and
  a stale note here is worse than no note: it made an ordinary one-migration
  deploy look like it would switch on billing as a side effect.
  `pnpm supabase migration list` compares local against remote and is the only
  answer worth trusting.

- **Auth emails are branded and live in `supabase/templates/`.** Delivery is
  Resend over SMTP, configured in the Supabase dashboard. Two files, because
  `signInWithOtp` picks between them: `magic-link.html` goes to a returning
  host and `confirm-signup.html` to a first-time one, so branding only one
  leaves half of them on the Supabase default. `config.toml` points the local
  stack at both; the linked project is updated with `pnpm emails:push --apply`,
  which PATCHes only the four mailer fields on the Management API. **Do not run
  `supabase config push`** — it sends this whole file, and the auth section here
  is otherwise stock, so it would point production's magic links at `127.0.0.1`
  and drop the Resend SMTP settings. Details in
  `supabase/templates/README.md`.

- `lib/slug.ts` holds the canonical `slugify()` — admin and the QR preview must both use it so printed QR codes never disagree.
- `vercel.json` pins functions to **`fra1`**. Supabase is in `eu-central-2`
  (Zurich) and Vercel's default is `iad1` (Washington DC), so every query on
  the guest path was crossing the Atlantic twice. Frankfurt is the closest
  Vercel region. If the Supabase project ever moves, move this with it —
  nothing else in the code notices, and the symptom is a uniformly slow app.

## The join gate is in the pages, not the layout (settled — learned the hard way)

`guestHasJoined()` (`lib/guest-name-server.ts`) reads a cookie that
`writeGuestName()` mirrors, and **each guest page checks it and returns
`<JoinGate>` before fetching anything**. Do not move this back up into
`app/e/[slug]/layout.tsx`, however much tidier that looks:

- Next renders the child segment and hands the layout the **result**. A layout
  that declines to render `children` still lets the page run — verified: a
  gated gallery served all seven `thumb_path`s and every `uploader_name` in the
  flight payload to a visitor who had typed nothing. Only an early return
  inside the page skips the query.
- The old localStorage check could only run after hydration, so every guest who
  had already joined saw the gate flash on every navigation.

Joining costs one `router.refresh()`. That is the deliberate trade for the two
fixes above: it happens once per device, at the moment a guest expects a submit.
The gate is still **UX, not access control** — a cookie is forged as easily as
it is read, and privacy still rests on the unguessable slug.

## Optimistic updates (settled)

Three places show the result before the server has confirmed it. All three
revert on their own — none of them carries hand-written rollback code.

- **`components/admin/moderation-grid.tsx`** — `useOptimistic` is held on the
  **grid**, not the tile, so the "N rejtve" counter moves with the photo it
  describes. Per-tile state would flip the tile instantly and leave the count a
  round trip behind, which reads as a bug. Measured: tile, label and counter
  all update 74ms after the tap, and a failed action reverts all three and
  shows "Nem sikerült".
- **`components/admin/gallery-toggle.tsx`** — same reasoning, one boolean. A
  switch that sits still for a round trip is one a host taps twice.
- **`lib/recent-uploads.ts` + `app/e/[slug]/gallery/loading.tsx`** — the
  gallery's loading state draws the guest's own just-uploaded photos from the
  `blob:` URLs still in memory. Measured cold: their photo is on screen 377ms
  after the tap and holds until the real grid arrives.

Two rules the upload store depends on:

1. **Only committed uploads are recorded.** `rememberUpload` is called after
   the row insert succeeds, so everything shown is genuinely in the album.
   Recording at queue time would flicker — a guest who navigated mid-queue
   would watch photos appear and then vanish when the server answered.
2. **The store owns the object URLs it is handed.** `upload-queue.tsx` marks
   those items `handedOver` and skips them when it revokes previews on unmount,
   or the gallery draws broken tiles. The store caps itself and revokes what it
   evicts.

`loading.tsx` is also what makes the tap navigate at all — Next partially
prefetches a dynamic route only when the route has one.

## Routing (settled — QR codes get printed, so this is expensive to change)

| Route                                                                                      | Purpose                                                                 |
| ------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------- |
| `/`                                                                                        | 308 to `/hu`. Nothing renders here.                                     |
| `/hu`                                                                                      | Marketing homepage. Permanent. Don't repurpose it.                      |
| `/hu/blog`, `/hu/blog/*`                                                                   | Articles, from `content/blog/hu/*.mdx`                                  |
| `/hu/arak`, `/hu/alkalmak/*`, `/hu/rolunk`, `/hu/kapcsolat`, `/hu/aszf`, `/hu/adatvedelem` | The rest of the marketing site                                          |
| `/e/[slug]`                                                                                | Event page guests land on from the QR code, and where uploading happens |
| `/e/[slug]/gallery`                                                                        | Shared gallery                                                          |
| `/admin`                                                                                   | Host/admin area, Supabase Auth magic link                               |

**Public pages are locale-prefixed; the product is not.** `/e/`, `/admin`,
`/auth` and `/api` sit outside the locale tree on purpose: QR codes are printed
with the first, and `proxy.ts` guards the second by the exact path
`/admin/:path*`. Putting a locale in front of either would silently break a
printed code or an auth gate.

Every pre-prefix URL (`/arak`, `/blog/:slug`, …) 308s to its `/hu` twin from
`next.config.mjs`. Those redirects are spelled out one by one — a catch-all
would swallow `/e/` and `/admin`.

Plus one machine endpoint: `POST /api/stripe/webhook`, which is the only thing
that marks a purchase paid. Under `/api/` rather than the Hungarian namespace
because no human navigates to it and the URL is pasted into Stripe's dashboard.

The `/e/` prefix is what the landing page already advertises in `qr-preview.tsx` and `how-it-works.tsx`, and it keeps the root namespace free for marketing pages.

## Locales and the blog (settled)

`lib/i18n.ts` holds `locales = ['hu'] as const`, and everything else is derived
from it: URLs, `generateStaticParams`, hreflang, the sitemap, RSS. Nothing else
enumerates languages.

**Articles are MDX files in `content/blog/<locale>/`.** There is no registry to
keep in step any more — `lib/blog/posts.ts` reads the directory, validates the
frontmatter with zod, and everything downstream follows from that. Frontmatter
is parsed off disk with `gray-matter` rather than imported out of the MDX,
because `@types/mdx` cannot type named exports.

**`id` is the article; `slug` is its address in one language.** They are
separate so a Hungarian URL reads Hungarian:
`/hu/blog/eskuvoi-foto-megosztas` and `/en/blog/wedding-photo-sharing` share
`id: wedding-photo-sharing`. Never find a translation by swapping the locale
segment in a URL — use `getTranslations(id)`. `related` in frontmatter lists
**ids** for the same reason.

**`content/blog/CLAUDE.md` is the authoring guide** — frontmatter contract,
heading and link rules, the components available inside an article, Hungarian
copy conventions, and what the build refuses. It sits next to the articles so
it loads automatically when one is being written; read it before writing or
editing a post rather than reconstructing the rules from here.

### Adding an article

1. Write `content/blog/hu/<slug>.mdx`. The filename **must** equal the `slug`
   in its frontmatter; the build refuses otherwise.
2. Frontmatter needs `id`, `locale`, `slug`, `title`, `description`,
   `publishedAt` (`YYYY-MM-DD`). Optional: `updatedAt`, `author`, `image`,
   `related`, `draft`.
3. Start the body at `##` — the `<h1>` is rendered from `title`, and a second
   one would be an SEO defect.
4. That is all. The route, the index entry, the sitemap URL, the RSS item and
   `/llms.txt` all follow from the file.

`draft: true` renders in `next dev` and disappears from a production build —
index, sitemap, RSS, related lists, and the URL itself 404s.

Posts can use `<Cta>`, `<Faq>` and `<Comparison>` (`components/blog/mdx-blocks.tsx`)
with no import line; they are injected through `mdx-components.tsx`. Markdown
tables work via `remark-gfm`. **Remark plugins must be named as strings** in
`next.config.mjs` — Turbopack runs the MDX pipeline in Rust and cannot accept a
JS function.

### Enabling English

1. Add `'en'` to `locales` in `lib/i18n.ts`.
2. Uncomment the `en` line in `lib/blog/mdx.ts`.
3. Run `pnpm typecheck`. Every `Record<Locale, …>` of UI strings becomes a type
   error listing exactly what needs translating — that is the checklist, and it
   is the reason those maps are typed that way.
4. Translate the marketing pages under `app/[locale]/`.
5. **`<html lang>`.** It is fixed at `hu` in the single root layout, which is
   correct only while Hungarian is the only locale. Making it vary means
   splitting into two root layouts (`app/(site)/[locale]/layout.tsx` for
   marketing, `app/(product)/layout.tsx` for `/e/` and `/admin`) and deleting
   `app/layout.tsx`. That also forces the global 404 onto
   `experimental.globalNotFound`, which is why it was deferred rather than done
   up front.

An `en` article already sits in `content/blog/en/` as a worked example. It is
inert — unread and unvalidated — until step 1.

## Access model (settled)

- **Guests: no gate at all.** Anyone with the link or QR can view the gallery and upload. No passcode, no login, no nickname required. Any friction directly reduces the participation rate we're trying to measure.
- **Host/admin: Supabase Auth magic link.** Only the admin area is protected. Every event has an `owner_id`, and RLS scopes host reads and writes to `owner_id = auth.uid()` — a signed-in user who owns nothing sees nothing. This is ownership scoping, **not** the multi-tenant dashboard ruled out below.
- **Roles: `user` and `admin`.** Every signup gets a `profiles` row with `role = 'user'` (created by a trigger on `auth.users`), which changes nothing — ownership scoping above is still what governs them. `admin` is the operator: `public.is_admin()` is OR'd into every host policy on `events`, `photos` and the storage bucket, so an admin reads and writes every album, and an admin-owned event is exempt from the upload cap. Nobody can promote themselves — `profiles` has no self-update policy, so the role is writable only by another admin or through the service role. Expect `/admin` to list **every** event once you promote an account.
- Privacy comes from the URL being unguessable and unindexed — add `noindex` to event routes. Slugs therefore carry a random suffix (`anna-peter-k3f9x7`); `slugify()` stays deterministic for the QR preview, and `generateEventSlug()` is what real events get. Never create an event with a bare `slugify()` result.

## Data model (settled)

Details, DDL, and RLS live in `.cursor/skills/ourfilm-supabase/SKILL.md`. Shape:

- **`events`** — `id`, `slug` (unique), `event_name`, `event_date` (**legacy**; nullable, and nothing sets it any more — read it only as a fallback), `uploads_close_at` (when uploads stop; the gallery stays viewable after), `gallery_hidden_at` (set = guests upload but cannot view; host togglable both ways), `owner_id` (→ `auth.users`; the host, and what every RLS host policy keys off), `created_at`

  **Creating an event asks one date question: when it ends.** `uploads_close_at`
  is required by the create form and pre-filled a week out at 23:59; the start
  is not asked because uploads open the moment the event exists. It replaced a
  pair of optional fields — an optional deadline is one nobody sets, so every
  album accepted uploads forever. The column stays nullable for the events
  created before this, which really are open-ended; each surface says so rather
  than leaving the line blank.

  Both directions of the conversion live in `lib/format.ts` and read the wall
  clock as **`EVENT_TIME_ZONE`**, never the browser's or the server's — a
  `datetime-local` value carries no zone, and Vercel runs UTC, so resolving one
  there would move every deadline two hours off what the host typed.

  The host can move it afterwards on `settings` (`DeadlineCard` →
  `setUploadDeadline`). Setting a time in the past is the supported way to
  close an album early, which is why that action does not reject one — and the
  reason a required deadline needs an edit path at all.

- **`photos`** — `id`, `event_id`, `storage_path`, `thumb_path`, `view_path` (nullable — the ~1600px lightbox render; null on photos uploaded before it existed, so **always read it as `view_path ?? storage_path`**), `uploader_name` (nullable — optional guest nickname, remembered on their device), `hidden_at` (soft delete for moderation; never hard-delete), `width`, `height`, `byte_size`, `mime_type` (so the gallery grid reserves space and avoids layout shift), `taken_at` (EXIF capture time, read in the browser **before** the canvas re-encode destroys it; null when the file carried none — always fall back to `created_at`), `created_at`

**Guests never read these tables directly.** The anon key is public, so any table `anon` can `select` is a table anyone can list — a permissive read policy on `events` would hand out every album's slug and make the unguessable URL pointless. Guest reads go through `security definer` functions keyed on the slug or event id (`event_by_slug`, `event_photos`); admin reads the tables directly under ownership policies. Details in the Supabase skill.

- **`profiles`** — `id` (→ `auth.users`), `role` (`user` | `admin`), `created_at`. One row per account, written by a trigger at signup. Read it through `lib/roles.ts`, never inline.

- **`purchases`** — `event_id`, `owner_id`, `stripe_checkout_session_id` (unique), `stripe_payment_intent_id`, `stripe_customer_id`, `amount_minor`, `currency`, `status` (`pending` | `paid` | `refunded`), `created_at`, `paid_at`, `refunded_at`. A ledger, not a flag: abandoned checkouts leave `pending` rows on purpose, which is why `getEventPurchase()` sorts on `paid_at` before `created_at`.

- **`stripe_webhook_events`** — `id` (Stripe's `evt_…`), `type`, `received_at`, `processed_at`. Idempotency plus an audit trail. RLS on with no policies at all: only the service role reaches it.

Storage layout: `event-photos/{event_id}/{photo_id}.jpg` plus `_thumb.jpg` and `_view.jpg` beside it. Storage policies key on the **folder** (the event id) and never on the filename, so a new derivative needs no policy change.

**Three renders, one per job. Never serve a bigger one than the job needs.** The client already holds the decoded bitmap during upload, so producing all three there costs a resize each rather than another decode.

| Render         | Size          | Used by                               |
| -------------- | ------------- | ------------------------------------- |
| `storage_path` | 4096px / q92  | ZIP export, print. Nothing on screen. |
| `view_path`    | ~1600px / q85 | Lightbox                              |
| `thumb_path`   | ~400px / q80  | Gallery grid, moderation grid         |

Both downscales exist because of measured cost on a phone, not tidiness. Tiling 4096px files at 200px would have one guest pull over a gigabyte to scroll a 600-photo album. And the lightbox showing the master decoded 12.6 megapixels — roughly 50MB of bitmap — per swipe, to fill a screen about 1200px across; that was the second-largest source of device heat in the product.

## Billing (settled)

**One-time purchase per event.** No subscription and no per-guest fee — `/arak`
promises exactly that on a live page.

- **Free:** creating an event, the QR, the gallery, ZIP export, and the first
  **5 photos** (`public.free_photo_limit()`). The pilot measures whether guests
  scan and upload, so nothing in the guest journey sits behind a paywall.
- **Paying unlocks:** the photo cap, for that event, permanently.
- **Enforced in** `event_accepts_uploads()` _and_ `event_folder_accepts_uploads()`
  — both guest write paths. Gating only the `photos` row would let a guest fill
  the bucket with objects no row references. Hiding the upload button is a
  courtesy, not the enforcement.
- **Checkout is a redirect** to Stripe's hosted page (`mode: 'payment'`). No
  card data touches this app, which is the difference between SAQ A and a
  compliance project.
- **Only the webhook marks a purchase paid.** `?checkout=success` proves
  nothing: a host can type it, and a host who closes the tab on Stripe's
  success page still deserves their album.
- **The cap counts hidden photos.** `hidden_at` is moderation, not deletion —
  the object still costs storage, so reclaiming quota by hiding would be a way
  to upload free forever.
- **Admin-owned events are never capped**, which is how the operator runs the
  pilot wedding without charging themselves.
- **Invoicing is still on the never-start list.** A Hungarian company selling
  to consumers must issue an invoice and report it to NAV Online Számla, and
  Stripe does not do that for you. Flag it before the first real forint.

Key files: `lib/stripe/*`, `lib/billing.ts`, `lib/roles.ts`,
`app/api/stripe/webhook/route.ts`, `app/admin/events/[slug]/billing-actions.ts`,
`components/admin/billing-card.tsx`.

## MVP scope

**Building:**

1. Event page `/e/[slug]` — name, date, participation counts, the upload queue itself, link to gallery
2. Upload, inline on the event page — OS picker, client-side HEIC conversion + compression, per-file progress, manual retry
3. Gallery `/e/[slug]/gallery` — responsive grid, lightbox, hidden photos excluded
4. Admin `/admin` — create events, generate/print QR, hide photos, **ZIP download of the whole album**
5. QR code generated from the final event URL

**Not building — flag it and ask first, never start it:**

- App Clip / native app
- Photographer or multi-tenant dashboard, per-client branding
- Token system, revenue share, invoicing (**payments themselves are now
  built** — one-time per event via Stripe Checkout; see Billing below)
- Guest accounts or mandatory registration
- Film filters
- **Automatic** delayed reveal (timed or scheduled unveiling). The host _can_ close the gallery manually at any time via `gallery_hidden_at` — guests keep uploading, they just can't browse — and can reopen it just as easily. That manual toggle is in scope; anything that schedules or automates it is not.
- Email notifications
- **Translated UI copy.** The _architecture_ is multi-locale (see Locales);
  actually writing and maintaining an English site is a separate decision that
  has not been made.
- Realtime gallery updates (Supabase Realtime) — guests refresh; the copy no longer promises live updates
- Resumable/background uploads — manual retry only

## Build order

Ticket-level detail, dependencies, and the open decisions live in `docs/mvp-backlog.md` — work from there; this is the summary.

1. Supabase installed and connected (`@supabase/supabase-js`, `@supabase/ssr`)
2. Migrations for `events` + `photos`, RLS, storage bucket
3. Event page with real data
4. Upload flow → Storage + DB row
5. Gallery
6. Admin: create event, hide photo, ZIP export
7. Real-phone testing, QR printing

## Photo quality policy (settled — the landing page depends on it)

Compress **client-side before upload**, in the browser, straight to Supabase Storage:

- **4096px bounding box, JPEG quality 0.90–0.92.** Below ~85% JPEG drops data exponentially and skin tones go muddy in dim venues; 92% is visually indistinguishable and keeps a 48MP iPhone photo at roughly 1.5–2.2MB instead of 8MB. Print-ready for the couple, fast on congested venue wifi.
- **HEIC must be converted in the browser.** Only Safari can read HEIC; Chrome, Edge, and desktop break on it. Use `heic-to` (lightweight, libheif 1.18) rather than `heic2any` (600KB+ of WASM), and **dynamically import it only when an HEIC file is detected**.

Full pipeline in `.cursor/skills/ourfilm-upload/SKILL.md`.

## Landing page promises we must honor

The marketing page is live, so guests and hosts arrive with expectations. These claims are load-bearing:

- **ZIP download of the whole album** (`benefits.tsx`, `live-demo.tsx`) — must actually work for the pilot
- **High-resolution, print-ready photos** (`photo-quality.tsx` comparison slider, FAQ) — satisfied by the 4096px/92% policy above. The pitch is "chat apps crush your photos, we don't", which stays true; never re-add claims of literally uncompressed originals
- **Private, unindexed album** (`benefits.tsx`, FAQ) — event routes need `noindex`
- **Host can hide unwanted photos** (FAQ) — needs the `hidden_at` flag
- **The free tier's 5-photo cap** (`/arak`) — real and enforced on every guest upload by `public.free_photo_limit()`. `/arak` is the only page that states it; if the limit changes, the migration and that copy move together

If a change would falsify a landing-page claim, either honor it or update the Hungarian copy in the same change.

## Conventions

- `components/site/*` marketing sections · `components/event/*` guest-facing event UI · `components/admin/*` admin UI · `components/ui/*` shadcn primitives
- Files kebab-case; components named exports (`export function EventHeader()`), no default exports except App Router pages/layouts
- Server Components by default; add `'use client'` only for state, refs, or browser APIs
- Shared logic in `lib/` (`lib/slug.ts`, `lib/supabase/*`); never duplicate a helper across components
- Import alias `@/*` from the repo root

<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
