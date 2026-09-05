# Project: OurFilm — QR-code disposable camera for events

> Product name: **OurFilm**. Domain: `ourfilm.app`. (Earlier working names "Fomio", "Moments" and "Pillanatok" are deprecated — never use them in code or copy.)
>
> Hungarian suffixes attach directly: **az** OurFilm (vowel-initial, so `az` not `a`), OurFilm**mel** (instrumental, assimilating like _filmmel_).

## Read this first

OurFilm is a **private digital disposable camera**. A host creates one camera per
event; guests scan a QR code or open a link, give a name, and get a **fixed roll
of shots** — **no app, no account**. The camera works only inside a capture
window, and the host decides when the photos are "developed": instantly, at the
end of the event, or at a chosen later moment.

There is no preview and no retake. You press the shutter and find out later what
you got — that is the format, not an omission.

**Phase: bilingual production hardening.** The disposable-camera product, host
dashboard, guest capture flow, private storage and Stripe test checkout exist.
Changes must preserve the real event flow and its security boundaries; this is
no longer a marketing-only prototype.

**Language:** English and Hungarian are live product locales. Public routes are
locale-prefixed. Every event stores `events.locale`; every QR, invitation and
guest URL must retain it. Host and auth-completion screens use the event/draft
locale. Code, comments, commit messages, and this doc stay in English.

**Mobile-first, always.** Guests arrive almost exclusively on phones via QR or a shared link. Design and test at 390px width before anything else.

## Before you say a task is done

```bash
pnpm verify   # typecheck + lint + unit tests + build. Must pass. Offline.
pnpm format   # Prettier; run after writing files
```

`pnpm test:db` is **not** part of `verify`, and runs **only against a local
Supabase stack** — never the linked project, which holds real customers' events:

```bash
pnpm supabase start     # once per machine (Docker)
pnpm supabase db reset  # apply migrations locally
pnpm test:db            # takes its credentials from the local stack
```

Run it after touching any migration, RPC or policy. The properties it checks —
a row lock holding under concurrent requests, an RLS policy refusing a real anon
key — need a real Postgres and a real PostgREST, and a local stack is both.

It used to run against the linked project, and that is now refused twice over.
`scripts/test-db.mjs` reads the credentials from `supabase status` and never
falls back to anything, and `tests/db/local-only.ts` aborts on a non-loopback
URL before a client is constructed — so running vitest directly cannot reach
production either. The suite writes throwaway users, events, participants and
photos and cleans up in a `finally`, which an interrupt or a thrown fixture
skips; against production those rows would stay.

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

Abuse and storage emergency controls are server-only:

```bash
OURFILM_UPLOADS_DISABLED=false          # true pauses all new reservations
OURFILM_EVENT_STORAGE_LIMIT_BYTES=      # optional positive per-event master-byte cap
RESEND_API_KEY=                         # auth and legal request emails
LEGAL_EMAIL_FROM=                       # optional sender override
SEND_EMAIL_HOOK_SECRET=                 # Supabase Send Email Hook signature
AUTH_EMAIL_FROM=                        # optional auth sender override
```

Payments add four more, all server-only — Checkout is a redirect to Stripe's
hosted page, so the browser never needs a publishable key:

```bash
STRIPE_SECRET_KEY=              # sk_test_… while piloting
STRIPE_WEBHOOK_SECRET=          # whsec_…, from the endpoint or `stripe listen`
STRIPE_PRICE_EVENT=             # price_… for the one-time per-event purchase
STRIPE_PRICE_EVENT_USD=         # price_… for the USD version of that purchase
```

**The Stripe account exists and test mode is wired up locally.** All four
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
- `STRIPE_PRICE_EVENT_USD` is `price_1UAr8Y35IJWm7mhtF4tTDhTO` — the active,
  tax-inclusive test Price for 39 USD on the same product. English events use
  this Price; Hungarian events use `STRIPE_PRICE_EVENT`.

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

- **`docs/mvp-backlog.md` is the historical plan for the album build.** Most of
  it describes a product that no longer exists. Read it for the decisions that
  still hold (slug shape, region, ownership scoping, self-serve delete) and
  ignore the phase list.
- **Bilingual marketing site** — `app/[locale]/page.tsx` composes the disposable
  camera story from `components/site/*`: hero, benefits, how-it-works,
  qr-preview, photo-reveal, FAQ and final CTA. It is the permanent homepage at
  camera story for `/en` and `/hu`, with `/` redirecting to English.
- **The homepage and `/hu/arak` describe the disposable-camera product.** The
  old upload demo, technical quality comparison, occasions carousel and
  instant-arrival pitch are no longer in the homepage flow. The unused
  components may still exist while secondary marketing content is revised; do
  not render them again without rewriting them around the camera experience.
- **All migrations are applied on the remote** and `pnpm types:check` matches.
  The disposable camera schema is live: `participants`, the reveal trigger, the
  capture RPCs and the private bucket.

  **Check, never assume, which migrations are live.** This section claimed for
  a while that roles and billing were unpushed after they had been pushed, and
  a stale note here is worse than no note: it made an ordinary one-migration
  deploy look like it would switch on billing as a side effect.
  `pnpm supabase migration list` compares local against remote and is the only
  answer worth trusting.

- **The guest write RPCs are `service_role` only, and that needs an explicit
  revoke.** `revoke all … from public` does **not** remove Supabase's grants:
  it grants execute to `anon` and `authenticated` _directly_, so the function
  stays wide open. `20260825080000_lock_down_capture_rpcs.sql` exists because a
  test caught exactly that — `join_event` and `reserve_shot` were callable with
  the anon key that ships in the browser bundle, which would have made the
  httpOnly session cookie pointless. `20260818172146` is the same lesson on
  `owned_events_with_previews`. Always revoke from `anon, authenticated` by name.

- **`pnpm seed` needs `SEED_HOST_EMAIL`** when the project has more than one
  account. It creates a camera that is open now, reveals instantly, and has five
  participants with photos — every screen reachable without editing a timestamp.

- **Roles are live; Stripe is live in test mode only.** `.env.local` has all
  three `STRIPE_*` keys, so a host can run a full test checkout on a dev
  machine. No `STRIPE_*` variable is set on Vercel, so every deployed
  environment still says payment is not switched on. The comment in
  `lib/stripe/env.ts` claiming there is no Stripe account is stale. See Billing.

- **Production auth email is localized by a signed Send Email Hook.** Both
  `signInWithOtp` callers put `lang=en|hu` in `emailRedirectTo` and user
  metadata. `/api/auth/send-email` verifies Supabase's Standard Webhooks
  signature, renders exactly that language and sends through Resend with the
  webhook ID as an idempotency key. The HTML files in `supabase/templates/`
  are English-only local-stack fallbacks; static templates cannot select a
  locale and must not replace the production hook. Deployment details are in
  `supabase/templates/README.md`.

- `lib/slug.ts` holds the canonical `slugify()` — the host area and the QR preview must both use it so printed QR codes never disagree.
- `vercel.json` pins functions to **`fra1`**. Supabase is in `eu-central-2`
  (Zurich) and Vercel's default is `iad1` (Washington DC), so every query on
  the guest path was crossing the Atlantic twice. Frankfurt is the closest
  Vercel region. If the Supabase project ever moves, move this with it —
  nothing else in the code notices, and the symptom is a uniformly slow app.

## `redirect()` from a Server Action rejects on the client (settled)

`app/auth/callback/callback-exchange.tsx` calls `completeMagicLink` and used to
treat any rejection as a transport failure, sending the browser to
`/host/login?error=link`. But `redirect()` reports itself **by throwing**, and a
Server Action re-throws that on the client — so the success path arrived in the
same `catch`. The proxy then bounced the by-then-signed-in visitor from the login
route to `/host`, which is where an ordinary login was going anyway. It looked
correct for every login this product has ever done, and only became visible when
a link carried a `next`: the destination was silently discarded.

`isRedirect()` in that file recognises the `NEXT_REDIRECT` digest. Any new
`.catch` around a Server Action that redirects needs the same guard.

## The guest gate is in the pages, not the layout (settled — learned the hard way)

`readParticipantTokenHash()` (`lib/participants.ts`) reads the httpOnly cookie,
and **each guest page checks it and returns or redirects before fetching
anything**. Do not move this back up into `app/e/[slug]/layout.tsx`, however
tidier that looks:

- Next renders the child segment and hands the layout the **result**. A layout
  that declines to render `children` still lets the page run — verified: a gated
  gallery served all seven `thumb_path`s and every uploader name in the flight
  payload to a visitor who had typed nothing. Only an early return inside the
  page skips the query.
- The old localStorage check could only run after hydration, so every guest who
  had already joined saw the gate flash on every navigation.

Joining navigates once, from **inside the server action** (`redirect()` after the
cookie is set) rather than from a client effect. An effect keyed on
`useActionState`'s state has no stable resting point — that state is a fresh
object on every render — so the success path would depend on render timing
rather than on the action having succeeded.

**`app/e/[slug]` has no `loading.tsx`, deliberately.** With one present, the
Suspense boundary around the join screen never completed on the client: the
server-rendered form stayed in the DOM unhydrated, so the submit button was
permanently disabled while typing still showed text. Verified by A/B — remove the
file and the page hydrates, restore it and it does not (Next 16.3, both `next dev`
and a production build). The route is a QR landing page reached by full page
load, so there is no prefetch for a loading boundary to enable anyway. If you add
one back, re-test that the join form actually submits.

The cookie is still **not a privacy boundary** — someone who copies it
impersonates that participant, and album privacy rests on the unguessable slug.
What it is, is the thing that stops a guest spending someone else's film, or more
than their own.

## The upload queue survives the tab (settled)

Tapping the shutter hands the tab to the OS camera, and iOS reclaims a
backgrounded Safari whenever it likes. There is no retake, so a photo that
lived only in memory was a lost moment.

The camera file is written to IndexedDB (`lib/upload-store.ts`) the moment the
shutter fires, and deleted once `commit_shot` confirms. `lib/upload-queue.ts`
drains one shot at a time, in capture order, and replays whatever a killed tab
left behind. Persistence swallows: private mode is the old in-memory behaviour.

**Compress once, then store the master — and write the raw file first.** The
row's `blob` is the camera original for a second or two, then
`compressForStorage` replaces it with the 4096px master and sets `compressed`.
Order matters both ways round. Persisting before the decode is the point of the
store: a 48MP HEIC is a ~50MB bitmap, and a guest who taps the shutter again
mid-compression backgrounds the tab holding it, which is exactly what iOS
reclaims. And storing the master rather than the original is what keeps libheif
off the resume path — every retry used to decode the HEIC again. `view` and
`thumb` are derived from the master at upload time; the master itself goes up as
it stands, so it gains no second generation and the print-ready promise holds.

`takenAt`, `width` and `height` are stored as scalars beside the blob because
the canvas round trip strips EXIF — that is how GPS is removed — so once the
master exists there is nothing left to read them from. `taken_at` is what the
host's ZIP export sorts the whole album by, and a resumed shot without it lands
at the bottom of the wedding.

Resume replays with the same capture id — that id is `reserve_shot`'s
idempotency key. Do not persist photo ids or signed URLs; a replay gets fresh
ones. Do not release a reservation between retries.

A failed shot stays on the strip and is retried after `RETRY_MS`, and also on
`visibilitychange` / `pageshow` / `online`. Every network step has a timeout:
a hung `fetch` otherwise wedges the whole uploader. Four attempts or 24 hours
and the bytes are dropped. `ended` and `no_shots` drop the rest of the queue;
other refusals wait and retry.

**The attempt budget is only ever spent on an answer from the server**, and
`lib/upload-failure.ts` is the whole of that judgement. Four attempts at ten
seconds is forty seconds — a marquee, a lift, a walk to the car park — so
charging for requests that never left the phone deleted the photo outright.
A connection failure, a teardown (`stop()` runs on unmount) and a refusal about
the server rather than the photo (`uploads_disabled`, `storage_limit`, …) all
hand the attempt back; a 5xx does not, or a photo Storage will never accept
would retry for a day. Mind the trap: `uploadToSignedUrl` returns a
`StorageUnknownError` with the real `TypeError` one level down in
`originalError`, so the obvious `name === 'TypeError'` check is false for every
genuine failure — and getting it wrong throws nothing and logs nothing, which
is how it shipped. Both halves are pinned in `tests/unit/upload-failure.test.ts`
and in the queue suite; sabotaging either direction turns them red.

## The create flow is four full-screen questions (settled)

`/host/events/new` asks four things, one per screen, in a shared shell
(`components/host/onboarding/*`): the name, when the event ends, when the
photos appear, and — sharing the last screen — how many guests, how long a roll
is, and who may look. Modelled closely on Once's onboarding: full-bleed dark
screens, one question each, a back arrow top-left, progress dots and the CTA
pinned to the bottom.

The last screen carries three controls rather than three screens because they
are the same decision from three sides: how big is this party and how much film
does it need. Neither of the other two depends on the first being answered.

- **The camera opens the moment the event is created.** `capture_start_at` is
  stamped by the server action, not sent from the browser, so there is no clock
  skew between the phone that filled the form and the row that gets inserted.
  The host is only ever asked when it _ends_ — and `capture_start_at` is
  therefore never shown or edited anywhere in the admin either. Settings offers
  `capture-end-card.tsx` alone, `setCaptureEnd` reads the start off the row to
  validate against, and the event page's summary has no "kezdete" line. A start
  field would be a second date to keep straight for a value that is always "when
  I pressed the button", and reopening a closed camera is what moving the _end_
  forwards already does.
- **The timezone is never asked.** It is read off the browser
  (`browserTimeZone()`) and stored with the event, so every later screen still
  formats in the event's own zone. The zone reaches the client one render late,
  through `useSyncExternalStore` rather than an effect — see
  `components/host/onboarding/use-browser-time-zone.ts`.
- **There are two reveal choices:** immediately, or when the event ends. The
  database still understands its legacy `custom` mode, but neither onboarding
  nor settings exposes or accepts it.
- **The guest count is a plan, not a setting.** There is no `max_participants`
  column and nothing about the inserted row differs between the two choices:
  the free tier is `free_participant_limit()` distinct participants enforced
  inside `join_event`'s row lock, and only a paid `purchases` row lifts it. So
  picking **Korlátlan** on the last screen only changes where the host lands —
  Stripe Checkout instead of their new event — and an abandoned checkout leaves
  an ordinary free event, which is what the ledger's `pending` row already
  describes. `FREE_PARTICIPANT_LIMIT` in `lib/onboarding.ts` mirrors the
  database function so the screen can name the limit before the row exists.
- **Onboarding can start a checkout, and the guest cap still cannot.** The paid
  tier is offered to the _host_, at the one moment they are thinking about how
  many people are coming. A guest turned away mid-party is still shown no
  checkout — that rule is about who is holding the phone, not about where the
  button lives. When `stripeIsConfigured()` is false the paid tile is disabled
  and reads "Hamarosan" rather than a price, the same honesty
  `components/host/billing-card.tsx` keeps.
- **`createEventCheckoutUrl` (`lib/stripe/checkout.ts`) is shared** by the
  billing card and the create action. Session metadata, the success and cancel
  URLs and the `pending` ledger row all live in one place, because every one of
  them is silently wrong when two copies drift.
- **There is no cover picker in the flow any more**, and nothing else offers
  one. `cover_path` stays nullable and every surface already renders an event
  without a cover; the upload branch in `createEvent` still works and is waiting
  for whatever surfaces the picker next.
- **`app/host/events/new/page.tsx` must stay synchronous.** `app/host/loading.tsx`
  wraps every host segment in a Suspense boundary, and an `async` page here
  suspends into it — after which the boundary never completes on the client and
  the whole flow is served as unhydrated markup. Same Next 16.3 failure as the
  `loading.tsx` note on `app/e/[slug]`, reproduced here by A/B.

### It is filled in signed out (settled)

Nobody is asked for an account before they have seen what they are signing up
for. The whole flow is a form; the account is asked for on the last screen, when
there is finally something to save.

- **`/host/events/new` is in `PUBLIC_ADMIN_PATHS`** (`proxy.ts`), matched
  exactly — never by prefix, because it is one segment away from routes that
  list and mutate real events.
- **The answers live in `localStorage`** under `ourfilm:event-draft:v1`
  (`lib/event-draft.ts`), zod-validated on read, expiring after seven days. That
  is the trade the feature is built on: **no anonymous rows in the database, no
  lost answers in the browser.** Nothing in the store is an entitlement — a
  `plan` of `full` there is a wish, and only a paid `purchases` row lifts a cap.
  The server re-validates every field.
- **The flow must not write the draft on mount.** It skips the first save
  deliberately: writing the untouched defaults over the stored draft is what
  made the restore prompt stop appearing, and `use-stored-draft.ts` primes its
  snapshot at module load to win the same race from the other side.
- **`/auth/event-complete` is where the magic link comes back to**, and it is
  under `/auth` for two independent reasons. Under `/host` it never hydrated
  (the `loading.tsx` trap again) so it silently did nothing; and a Server Action
  posts to the path of the page that owns it, so the proxy answered
  `createEventFromDraft`'s own POST with a redirect and discarded the call.
- **Idempotency is a database constraint, not a disabled button.** The draft
  carries a `creationKey`, and `events` has a unique index on
  `(owner_id, creation_key)`. A double tap, a reloaded callback, a second tab
  and a re-opened magic link all land on the event the first attempt made.
- **The draft is cleared only after the row exists**, and only by the code that
  saw it exist. That is why `createEventFromDraft` returns a destination instead
  of redirecting — a `redirect()` would navigate away before the browser could
  clear the one copy of those answers.

## Optimistic updates (settled)

Three host-area controls show the result before the server has confirmed it. All
revert on their own — none carries hand-written rollback code.

- **`components/host/moderation-grid.tsx`** — `useOptimistic` is held on the
  **grid**, not the tile, so the "N rejtve" counter moves with the photo it
  describes. Per-tile state would flip the tile instantly and leave the count a
  round trip behind, which reads as a bug.
- **`components/host/guests-toggle.tsx`** — same reasoning, one boolean. A
  switch that sits still for a round trip is one a host taps twice.
- **`components/host/shots-card.tsx`** — a five-way choice whose selected value
  is visible at a glance, so showing it immediately cannot mislead.

**The two date cards are deliberately _not_ optimistic.**
`capture-end-card.tsx` and `reveal-card.tsx` show a saved/failed state
instead. A field that displays the typed text while the stored answer is an hour
off would be lying about the one value guests are held to — and unlike a boolean,
there is no way to glance at it and notice.

**Nothing on the guest side is optimistic any more.** The old `recent-uploads`
store showed a guest their own photo the instant it uploaded, drawn from the
`blob:` URL still in memory. That is exactly what a reveal model must not do, so
the store and its tiles are gone. The camera's shot counter is not optimistic
either: it renders whatever `commit_shot` returned, never a local decrement,
because a client-side counter is a display and the database is the count.

## Routing (settled — QR codes get printed, so this is expensive to change)

| Route                                                                                      | Purpose                                                                                    |
| ------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------ |
| `/`                                                                                        | 308 to `/hu`. Nothing renders here.                                                        |
| `/hu`                                                                                      | Marketing homepage. Permanent. Don't repurpose it.                                         |
| `/hu/blog`, `/hu/blog/*`                                                                   | Articles, from `content/blog/hu/*.mdx`                                                     |
| `/hu/arak`, `/hu/alkalmak/*`, `/hu/rolunk`, `/hu/kapcsolat`, `/hu/aszf`, `/hu/adatvedelem` | The rest of the marketing site                                                             |
| `/auth/event-complete`                                                                     | Where a magic link sent from the create flow lands. Finishes the creation from the draft   |
| `/e/[slug]`                                                                                | The complete guest flow: join, event status, native camera trigger and reveal-gated photos |
| `/e/[slug]/camera`                                                                         | Legacy URL. Redirects to the unified event page                                            |
| `/e/[slug]/gallery`                                                                        | Legacy URL. Redirects to the unified event page                                            |
| `/host`                                                                                    | The host's own area, Supabase Auth magic link. `/admin/*` 308s here                        |

**Public pages are locale-prefixed; the product is not.** `/e/`, `/host`,
`/auth` and `/api` sit outside the locale tree on purpose: QR codes are printed
with the first, and `proxy.ts` guards the second by the exact path
`/host/:path*`. Putting a locale in front of either would silently break a
printed code or an auth gate.

**The host area was `/admin` until it was renamed**, and the reason is worth
keeping: `profiles.role = 'admin'` is a real role — the operator who sees every
event — so the route was spending that word on the couple whose wedding it is.
`/host` is the product's own vocabulary and the exact counterpart of the guest
side's `/e/`. `next.config.mjs` 308s `/admin` and `/admin/:path*` across; safe as
a catch-all in a way a bare one is not, because `/admin` has no siblings to
swallow. The **role** stays `admin` — only the route moved.

Every pre-prefix URL (`/arak`, `/blog/:slug`, …) 308s to its `/hu` twin from
`next.config.mjs`. Those redirects are spelled out one by one — a catch-all
would swallow `/e/` and `/host`.

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

**`content/blog/AGENTS.md` is the authoring guide** — frontmatter contract,
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
5. **`<html lang>` — done, and this is the shape it left behind.** There is no
   `app/layout.tsx` any more. Two root layouts render their own
   `<html>`/`<body>`: `app/[locale]/layout.tsx` for the public site, which sets
   `lang` from its own segment, and `app/(product)/layout.tsx` for `/e/`,
   `/host` and `/auth`, which cannot (no locale segment, and a layout gets
   `params` but never `searchParams`). The product pages mark their own subtree
   with `lang` instead.

   What it cost, and what not to undo:

   - The route group is transparent, so `/e/<slug>` is still `/e/<slug>` —
     moving those folders did **not** change a printed QR URL. Verify that in
     the build's route table if you move them again.
   - Two root layouts leave no single layout to compose an unmatched-URL 404
     from, so the global 404 is `app/global-not-found.tsx` behind
     `experimental.globalNotFound`. It bypasses layout rendering, so it imports
     `globals.css` and the font class itself and returns a whole document.
     `app/[locale]/not-found.tsx` and `app/(product)/not-found.tsx` still handle
     `notFound()` inside their own trees.
   - Shared shell lives in `lib/document.ts` (one font instance, one metadata
     base, one viewport). `<html>`/`<body>` stay literal in each root layout.

   The interim fix this replaced was an inline script patching
   `document.documentElement.lang` after hydration. It left every
   server-rendered Hungarian page — all the indexed ones — shipping `lang="en"`.
   Do not reach for it again.

An `en` article already sits in `content/blog/en/` as a worked example. It is
inert — unread and unvalidated — until step 1.

## Access model (settled)

- **Guests: a name, and nothing else.** No passcode, no login, no account. One
  field, once per device, and it is not friction for its own sake — a roll of
  film has to belong to somebody, and the gallery credits each photo to the
  person who took it. Everything past that is the participant session
  (`lib/participants.ts`).
- **Host: Supabase Auth magic link.** Only `/host` is protected. Every event has an `owner_id`, and RLS scopes host reads and writes to `owner_id = auth.uid()` — a signed-in user who owns nothing sees nothing. This is ownership scoping, **not** the multi-tenant dashboard ruled out below.
- **Roles: `user` and `admin`.** Every signup gets a `profiles` row with `role = 'user'` (created by a trigger on `auth.users`), which changes nothing — ownership scoping above is still what governs them. `admin` is the operator: `public.is_admin()` is OR'd into every host policy on `events`, `photos` and the storage bucket, so an admin reads and writes every album, and an admin-owned event is exempt from the upload cap. Nobody can promote themselves — `profiles` has no self-update policy, so the role is writable only by another admin or through the service role. Expect `/host` to list **every** event once you promote an account.
- Privacy comes from the URL being unguessable and unindexed — add `noindex` to event routes. Slugs therefore carry a random suffix (`anna-peter-k3f9x7`); `slugify()` stays deterministic for the QR preview, and `generateEventSlug()` is what real events get. Never create an event with a bare `slugify()` result.

## Data model (settled)

Details, DDL, and RLS live in `.cursor/skills/ourfilm-supabase/SKILL.md`. Shape:

- **`events`** — `id`, `slug` (unique), `event_name`, `cover_path` (nullable),
  `capture_start_at` / `capture_end_at` (the window the camera works in; both
  required, `end > start` enforced by a check constraint), `time_zone` (IANA
  name, stored beside the UTC instants because an offset is not a zone),
  `reveal_mode` (`instant | event_end | custom`), `reveal_at`,
  `shots_per_participant` (`5 | 10 | 16 | 24 | 36`, default 24, enforced by a
  check constraint), `guests_can_view`, `owner_id` (→ `auth.users`),
  `creation_key` (nullable uuid; unique per owner where present — the create
  flow's idempotency key, see below), `created_at`, `updated_at`

  **`reveal_at` is materialised, never computed per read.** A trigger
  (`events_resolve_reveal_at`) resolves it on every write: `instant` →
  `capture_start_at`, `event_end` → `capture_end_at`, `custom` → the chosen
  instant. So moving `capture_end_at` on an `event_end` event moves the reveal
  with it and no caller has to remember, and every reader is a plain
  `now() >= reveal_at`. Nothing schedules anything — the gallery opens because a
  request arrives after that instant, which is the only mechanism Vercel offers
  without a background worker.

  There is deliberately **no constraint** forcing `reveal_at >= capture_end_at`.
  There was one, and it silently broke "Galéria megnyitása most", which reveals
  while the camera is still running. That rule is a _form_ validation — it lives
  in `setReveal` and `validateEventDraft`, both of which can explain a refusal.

  Both directions of the `datetime-local` conversion live in `lib/format.ts` and
  take the **event's own zone**, never the browser's or the server's — a
  `datetime-local` value carries no zone, and Vercel runs UTC, so resolving one
  there would move every window two hours off what the host typed.

- **`participants`** — `id`, `event_id`, `display_name`, `session_token_hash`,
  `joined_at`, `last_seen_at`, unique on `(event_id, session_token_hash)`.

  A guest's identity is a random 32-byte token in an **httpOnly** cookie; only
  its SHA-256 is stored. `httpOnly` is the load-bearing part — the cookie decides
  how many photos someone gets, and a value the page can read is a value the page
  can forge. The old `ourfilm_name` cookie was written by client JS and gated
  nothing, which is why it could be.

  RLS on, **no anon policies at all**. Joining goes through `join_event`, which
  takes `for update` on the event row before counting, so five parallel joins on
  a free event cannot produce six participants.

- **`photos`** — `id`, `event_id`, `participant_id` (**not null** — an
  unattributed photo is one that consumed nobody's shot), `status`
  (`pending | ready`), `idempotency_key` (unique per participant),
  `storage_path`, `thumb_path`, `view_path`, `hidden_at` (soft delete for
  moderation; never hard-delete), `width`, `height`, `byte_size`, `mime_type`,
  `taken_at`, `created_at`

  **The shot limit is atomic, and this is how.** `reserve_shot` takes
  `for update` on the _participant_ row, checks the window and the count, and
  inserts a `pending` row with all three paths. The server action then mints
  three signed upload URLs; the browser PUTs straight to Storage; `commit_shot`
  flips the row to `ready`. The lock is held for microseconds rather than across
  a 2MB upload on venue wifi, and it serialises only that one guest's own
  concurrent captures — locking the event would serialise every guest at the
  party.

  A `pending` row stops counting after `shot_reservation_ttl()` (10 minutes), so
  a failed upload costs no frame and nothing has to be swept. Retrying with the
  same `idempotency_key` re-claims the same frame instead of spending another.
  Hidden photos **do** count: `hidden_at` is moderation, not deletion, so
  refunding on hide would make hiding a way to shoot forever.

**Guests never read these tables directly.** The anon key is public, so any table `anon` can `select` is a table anyone can list — a permissive read policy on `events` would hand out every album's slug and make the unguessable URL pointless. Guest reads go through `security definer` functions keyed on the slug or event id (`event_by_slug`, `event_photos`); the host area reads the tables directly under ownership policies. Details in the Supabase skill.

- **`profiles`** — `id` (→ `auth.users`), `role` (`user` | `admin`), `created_at`. One row per account, written by a trigger at signup. Read it through `lib/roles.ts`, never inline.

- **`purchases`** — `event_id`, `owner_id`, `stripe_checkout_session_id` (unique), `stripe_payment_intent_id`, `stripe_customer_id`, `amount_minor`, `currency`, `status` (`pending` | `paid` | `refunded` | `failed` | `expired`), `created_at`, `paid_at`, `refunded_at`, `failed_at`, `expired_at`. A ledger, not a flag: every terminal Checkout outcome remains explainable, which is why `getEventPurchase()` sorts on `paid_at` before `created_at`.

- **`stripe_checkout_attempts`** — one short-lived reservation per event. The host-only `reserve_event_checkout` RPC atomically returns one attempt id and canonical terms-acceptance timestamp to concurrent callers; that attempt id is the Stripe idempotency key. The table has RLS and no policies, so hosts cannot list or edit reservations directly. After 45 minutes a new request rotates the attempt and creates a fresh Checkout Session.

- **`stripe_webhook_events`** — `id` (Stripe's `evt_…`), `type`, `received_at`, `processed_at`. Idempotency plus an audit trail. RLS on with no policies at all: only the service role reaches it.

Storage layout: `event-photos/{event_id}/{photo_id}.jpg` plus `_thumb.jpg` and `_view.jpg` beside it, and `{event_id}/cover.jpg` for the cover. Storage policies key on the **folder** (the event id) and never on the filename, so a new derivative needs no policy change.

**The bucket is private.** It used to be public, with privacy resting on two
unguessable uuids in the path — a fair bet for an album with no reveal and an
untenable one now: a public object URL keeps working forever regardless of what
the reveal predicate says, so "nobody sees these until the album develops" could
not have been kept by a URL anyone could hold. Reads are signed server-side in
`lib/photo-urls.ts` (one batch `createSignedUrls` per grid, 1-hour expiry);
guests never construct a photo URL.

**Guests hold no direct write access to Supabase at all.** Both anon insert
policies — on `photos` and on `storage.objects` — are gone. Uploads go to signed
upload URLs minted by `reserve_shot`'s server action and bound to one exact path
the database has already agreed to, so a guest cannot choose where bytes land,
cannot write to another event's folder, and cannot write without first being
granted a frame. There is still deliberately **no anon select policy** on
`storage.objects`: one scoped to the bucket would let anyone list every event id
and photo id in the system.

**Three renders, one per job. Never serve a bigger one than the job needs.** The client already holds the decoded bitmap during upload, so producing all three there costs a resize each rather than another decode.

| Render         | Size          | Used by                               |
| -------------- | ------------- | ------------------------------------- |
| `storage_path` | 4096px / q92  | ZIP export, print. Nothing on screen. |
| `view_path`    | ~1600px / q85 | Lightbox                              |
| `thumb_path`   | ~400px / q80  | Gallery grid, moderation grid         |

Both downscales exist because of measured cost on a phone, not tidiness. Tiling 4096px files at 200px would have one guest pull over a gigabyte to scroll a 600-photo album. And the lightbox showing the master decoded 12.6 megapixels — roughly 50MB of bitmap — per swipe, to fill a screen about 1200px across; that was the second-largest source of device heat in the product.

## Billing (settled)

**One-time purchase per event: 39 USD in English, 12 900 Ft in Hungarian.** No
subscription, no per-guest fee. The event's stored locale selects the Stripe
Price, so a translated label cannot silently choose the other currency.

- **The free tier is a _participant_ cap, not a photo cap:** an event is free for
  up to **5 distinct participants** (`public.free_participant_limit()`). Every
  guest gets the host's chosen roll of 5/10/16/24/36 frames either way — what
  paying buys is more guests. Five friends shooting 36 frames each is a
  legitimately free event.
- **Enforced in `join_event`**, under the `for update` lock on the event row, so
  the cap holds under concurrent joins. A guest who has **already** joined is
  never turned away once the cap fills — their session predates the limit, and
  revoking it mid-event is the worst possible moment to tell someone the host has
  not paid.
- **A capped guest is shown no checkout.** They get "Az esemény elérte a
  résztvevői keretet" and are told to ask the organizer. A wedding guest holding
  a phone cannot fix this, and asking them to pay for the couple's album is the
  wrong sentence to put in front of them. The upgrade is the host's, and they
  reach it in two places: the billing card in settings, and the plan choice on
  the last onboarding screen. Both go through `createEventCheckoutUrl`.
- **Checkout is a redirect** to Stripe's hosted page (`mode: 'payment'`). No card
  data touches this app — the difference between SAQ A and a compliance project.
- **Only the webhook marks a purchase paid.** `?checkout=success` proves nothing:
  a host can type it, and a host who closes the tab on Stripe's success page
  still deserves their album. `purchases` has no update policy at all, so the
  service role is the only writer of `status = 'paid'`.
- **Admin-owned events are never capped**, which is how the operator runs the
  pilot wedding without charging themselves.
- **Invoicing is still on the never-start list.** A Hungarian company selling to
  consumers must issue an invoice and report it to NAV Online Számla, and Stripe
  does not do that for you. Flag it before the first real forint.

Nothing about the Stripe integration changed in the pivot — only the predicate it
gates. `event_upload_quota` (photos) became `event_participant_quota`
(participants); `event_has_unlimited_uploads` became `event_is_full_plan`.

Key files: `lib/stripe/*` (`checkout.ts` builds the session for both entry
points), `lib/billing.ts`, `lib/pricing.ts` (the displayed price, in one place),
`lib/roles.ts`, `app/api/stripe/webhook/route.ts`,
`app/host/events/[slug]/billing-actions.ts`,
`components/host/billing-card.tsx`, `app/host/events/new/step-guests.tsx`.

**`/hu/arak` and `/en/pricing` mirror this model.** They present one paid event rather than a
three-tier SaaS table: up to five participants are free, one payment admits
unlimited participants, and every participant still has the host's chosen roll.
The page remains `noindex` while `hasRealCompanyDetails` is false.

## MVP scope

**Building:**

1. Guest event `/e/[slug]` — one-field join, compact event status, share action,
   native camera via `capture="environment"`, and reveal-gated photos on one page
2. Admin `/host` — four-step create flow, QR, moderation, early reveal,
   **ZIP download of the whole album**
3. QR code generated from the final event URL

**Not building — flag it and ask first, never start it:**

- App Clip / native app
- Photographer or multi-tenant dashboard, per-client branding
- Token system, revenue share, invoicing (**payments themselves are built**)
- Guest accounts or mandatory registration
- **Film filters / Original-Vintage-B&W selector.** Deferred deliberately, not
  forgotten — a later phase.
- Retake, in-camera preview, or an editor
- Video, audio guestbook, live slideshow, RSVP
- Leaderboard, recap, gamification, analytics, referral
- Email notifications and lifecycle email
- **Translated UI copy.** The _architecture_ is multi-locale (see Locales);
  actually writing and maintaining an English site is a separate decision.
- Realtime gallery updates (Supabase Realtime) — guests refresh
- **Background upload while the tab is closed.** Not achievable without a
  native shell, and not by a service worker either: iOS Safari has no
  Background Sync. Resuming _in the page_ is built — see The upload queue.
- Long-running requests, background workers, cron. The reveal is computed at
  request time precisely so none of these is needed.

**Reversed by the pivot.** Per-guest shot scarcity, delayed reveal and a
capture-window were all on this list before, and the Once review had explicitly
rejected the first. They are the product now. Film filters are the one item from
that group still deferred.

## Build order

Phases 1–5 of the original album build are superseded by the pivot. What exists
now, in the order it was built:

1. Schema reset + `participants` + reveal trigger (`20260824174541`)
2. Guest RPCs: join, reserve/commit/release, state, gallery (`20260824174542`)
3. Private bucket (`20260824174543`)
4. `lib/` domain layer: `camera.ts`, `participants.ts`, `capture.ts`,
   `photo-urls.ts`, `event-copy.ts`
5. Guest surface: join → camera → gallery
6. Admin: create flow, dashboard, settings, early reveal
7. Tests, then real-phone testing and QR printing

## Photo quality policy (settled — the landing page depends on it)

Compress **client-side before upload**, in the browser, straight to Supabase Storage:

- **4096px bounding box, JPEG quality 0.90–0.92.** Below ~85% JPEG drops data exponentially and skin tones go muddy in dim venues; 92% is visually indistinguishable and keeps a 48MP iPhone photo at roughly 1.5–2.2MB instead of 8MB. Print-ready for the couple, fast on congested venue wifi.
- **HEIC must be converted in the browser.** Only Safari can read HEIC; Chrome, Edge, and desktop break on it. Use `heic-to` (lightweight, libheif 1.18) rather than `heic2any` (600KB+ of WASM), and **dynamically import it only when an HEIC file is detected**.

Full pipeline in `.cursor/skills/ourfilm-upload/SKILL.md`.

## Landing page promises

The homepage and pricing page describe the **disposable-camera product**. These
claims are live and load-bearing:

- **ZIP download of the whole album** (`benefits.tsx`) — works
- **High-resolution, print-ready photos** (`photo-quality.tsx`, FAQ) — satisfied
  by the 4096px/92% policy above. The pitch is "chat apps crush your photos, we
  don't", which stays true; never re-add claims of literally uncompressed
  originals
- **Private, unindexed album** (`benefits.tsx`, FAQ) — event routes are
  `noindex`, and the bucket is now private as well
- **Host can hide unwanted photos** (FAQ) — `hidden_at`

- **Up to five participants are free; the paid event admits unlimited
  participants** (`/hu/arak`) — enforced in `join_event`
- **Every participant gets the host's chosen 5/10/16/24/36-shot roll** — paying
  never removes the per-person format

Do not reintroduce anything describing camera-roll upload or unlimited photos.

If a change would falsify a claim that is still true, either honor it or update
the Hungarian copy in the same change.

## Conventions

- `components/site/*` marketing sections · `components/event/*` guest-facing event UI · `components/host/*` host-area UI · `components/ui/*` shadcn primitives
- Files kebab-case; components named exports (`export function EventHeader()`), no default exports except App Router pages/layouts
- Server Components by default; add `'use client'` only for state, refs, or browser APIs
- Shared logic in `lib/` (`lib/slug.ts`, `lib/supabase/*`); never duplicate a helper across components
- The camera's rules live in `lib/camera.ts` as **pure functions taking `now`** —
  the server computes them to decide what is allowed and the client to decide
  what to draw, and the two must never disagree. Nothing there reads a clock of
  its own. Guest-facing Hungarian for event states lives in `lib/event-copy.ts`,
  so the join state, camera action and photo section cannot describe the same
  event differently.
- Import alias `@/*` from the repo root

<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
