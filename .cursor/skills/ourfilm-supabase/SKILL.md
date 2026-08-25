---
name: ourfilm-supabase
description: OurFilm's Supabase conventions — browser and server client setup with @supabase/ssr, SQL migrations via the Supabase CLI, the events and photos schema, RLS policies for anonymous guest uploads, storage bucket configuration, and Supabase Auth magic-link protection for the admin area. Use when touching the database, writing migrations, configuring RLS or storage, generating types, or wiring auth in OurFilm.
---

> **Read this first — the disposable camera pivot changed three things below.**
>
> 1. **Guests hold no write access at all.** The anon insert policies on `photos`
>    and `storage.objects` are gone. Every guest write is a server action calling
>    a `service_role`-only RPC (`join_event`, `reserve_shot`, `commit_shot`,
>    `release_shot`), because the httpOnly session cookie is the only thing that
>    identifies a participant and only the server holds it.
> 2. **`revoke all … from public` is not enough.** Supabase grants execute to
>    `anon` and `authenticated` _directly_. Always
>    `revoke all on function … from anon, authenticated` by name — see
>    `20260825080000_lock_down_capture_rpcs.sql`, which exists because a test
>    caught `reserve_shot` callable with the browser's anon key.
> 3. **The `event-photos` bucket is private.** Reads are signed server-side
>    (`lib/photo-urls.ts`, batched per grid); uploads go to signed upload URLs
>    minted by `reserve_shot`. The absence of an anon _select_ policy still
>    matters and is still deliberate.
>
> The rest of this file — RLS reasoning, the security-definer trap, migration
> workflow, client factories, `getUser()` over `getSession()` — is unchanged and
> still correct. Two corrections: the DB tests are now
> `pnpm test:db` (vitest, `tests/db/`), not `supabase/tests/*.py`; and the Next 16
> proxy matcher export is `config`, not `proxyConfig` (verify in `proxy.ts`).

# OurFilm Supabase

Postgres + Storage + Auth. Guests are **anonymous** (never signed in); only the host signs in, via magic link, to reach `/admin`.

## Install — done

`@supabase/supabase-js` and `@supabase/ssr` are installed, and the Supabase CLI is a **devDependency**, so invoke it as `pnpm supabase …` rather than a global binary.

Env keys are maintained **by hand** in `.env.local`: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, and server-only `SUPABASE_SERVICE_ROLE_KEY`. `vercel env pull` does not work on this project — the integration's variables are marked Sensitive and pull back as `[SENSITIVE]`; see the Local env section of `CLAUDE.md`. The service role key must **never** be imported into a Client Component or any file reachable from one.

Mind the prefix: the integration also provisions bare `SUPABASE_URL` and `SUPABASE_ANON_KEY`. Next.js only exposes variables to the browser when they start with `NEXT_PUBLIC_`, so the browser client reads `undefined` if you wire it to the bare names.

## Migrations — always SQL files in the repo

Never change schema by clicking in the dashboard; the repo is the source of truth.

```bash
# init and link are already done.
pnpm supabase migration new <name>   # creates supabase/migrations/<ts>_*.sql
pnpm supabase db push --linked       # apply to the remote (needs SUPABASE_DB_PASSWORD)
pnpm types:gen                       # regenerate lib/supabase/database.types.ts
pnpm types:check                     # fails if the committed types have drifted
python3 supabase/tests/rls.py        # re-run the access-model checks after any policy change
python3 supabase/tests/storage.py
```

Migrations are append-only: to change something, write a new migration. Every table gets RLS enabled in the same migration that creates it.

**Run `pnpm types:gen` after every `db push`.** It is not part of `pnpm verify`: that has to stay fast and offline, and wiring a live-database call into the command you run after every edit would make it need CLI auth and a network round trip. The safety net is that generated types turn a wrong column name into a compile error; `types:check` is the deliberate drift check.

## Schema

```sql
create table public.events (
  id               uuid primary key default gen_random_uuid(),
  slug             text not null unique,
  event_name       text not null,
  event_date       date,
  uploads_close_at timestamptz,  -- null = open forever; gallery stays readable after
  gallery_hidden_at timestamptz, -- set = guests upload but cannot view; host togglable
  owner_id         uuid not null references auth.users (id) on delete restrict,
  created_at       timestamptz not null default now()
);

create index events_owner_idx on public.events (owner_id);

create table public.photos (
  id            uuid primary key default gen_random_uuid(),
  event_id      uuid not null references public.events (id) on delete cascade,
  storage_path  text not null unique,
  thumb_path    text not null,  -- ~400px tile; the gallery must never load storage_path
  uploader_name text,          -- optional guest nickname, kept on their device
  hidden_at     timestamptz,   -- soft delete for moderation; never hard-delete
  width         integer,
  height        integer,
  byte_size     integer,
  mime_type     text,
  -- When the shutter fired, not when the file arrived; the two differ by hours
  -- at a real event. Read by `lib/exif.ts` before the canvas re-encode strips
  -- EXIF. Commonly null (screenshots, downloads, many Android pickers), so
  -- every reader falls back to created_at. No default: now() would be a
  -- plausible-looking lie.
  taken_at      timestamptz,
  created_at    timestamptz not null default now()
);

create index photos_event_created_idx
  on public.photos (event_id, created_at desc)
  where hidden_at is null;
```

`width`/`height` are required by the gallery to reserve grid space and avoid layout shift — always write them (the upload pipeline knows them post-compression).

## RLS

```sql
alter table public.events enable row level security;
alter table public.photos enable row level security;

-- Guests get NO read policy on either table. See "Guests never read tables".
create policy "host manages own events"
  on public.events for all to authenticated
  using (owner_id = auth.uid())
  with check (owner_id = auth.uid());

create policy "guests add photos while uploads are open"
  on public.photos for insert to anon, authenticated
  with check (
    hidden_at is null
    and public.event_accepts_uploads(event_id)
  );

create policy "host manages photos in own events"
  on public.photos for all to authenticated
  using (
    exists (
      select 1 from public.events e
      where e.id = photos.event_id and e.owner_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from public.events e
      where e.id = photos.event_id and e.owner_id = auth.uid()
    )
  );
```

### Guests never read tables

The anon key ships in the browser bundle, so **anything `anon` can `select` through PostgREST, anyone on the internet can list.** A `using (true)` read policy on `events` would expose `GET /rest/v1/events?select=slug` — every album in the system — which makes the unguessable slug suffix pointless and contradicts the FAQ's privacy claim. The same applies to `photos`.

So guests read through `security definer` functions that take the slug or event id as an argument. You can fetch an album whose address you already know; there is nothing to enumerate.

| Function                      | Purpose                                                                       |
| ----------------------------- | ----------------------------------------------------------------------------- |
| `event_by_slug(text)`         | One event by slug. Deliberately omits `owner_id`.                             |
| `event_photos(uuid)`          | Visible photos for one event, newest first.                                   |
| `event_accepts_uploads(uuid)` | Boolean, used inside the insert policy. Upload window **and** free-photo cap. |
| `event_upload_quota(uuid)`    | `(photo_limit, remaining, unlimited)` so the UI can explain the cap.          |

All three are `security definer`, `stable`, and `set search_path = ''` (so fully qualify every table reference), with `execute` granted to `anon, authenticated`.

`event_accepts_uploads()` **has to** be `security definer`. Policy expressions are evaluated as the invoking role, so an inline `exists (select 1 from public.events …)` inside the guest insert policy would itself be filtered by events' RLS — and since guests cannot read events, it would quietly evaluate false and every upload would fail its `with check`. This is the trap to remember: removing a read policy can silently break an unrelated write policy.

Why the rest is shaped this way:

- Guests get **insert only**. No update, no delete — a guest can't edit or remove someone else's photo, and can't un-hide a moderated one (`hidden_at is null` is enforced in `with check`). The insert policies are `to anon, authenticated`, not `anon` alone: a leftover `/admin` session (iOS Camera opens a scanned QR in Safari, which shares those cookies) must not refuse a guest-shaped upload.
- **An insert must not ask for the row back.** `supabase-js` `.insert()` alone sends `Prefer: return=minimal` and succeeds; chaining `.select()` asks to read what it just wrote, which guests have no policy for.
- **RLS makes anon `update` and `delete` no-ops, not errors.** They return `204` having matched zero rows. When testing, assert on the row's state afterwards — a status code alone will convince you the table is wide open when it isn't.
- `events.gallery_hidden_at` closes the gallery to guests while uploads continue; `event_photos()` returns nothing while it is set, and `event_by_slug()` exposes it as `gallery_private` so the UI can explain the state instead of showing an empty album. Host-togglable both ways.
- `event_accepts_uploads()` makes the upload window a database rule, not a UI suggestion — hiding the upload button is a courtesy, not the enforcement.
- Host policies key off **`owner_id`, never a bare `to authenticated`**. A blanket `using (true)` would make every signed-in user a host of every event — able to read hidden photos, export albums and delete them. With ownership scoping, a stray signup lands in an empty admin instead. Disabling public signups is still worth doing, but it is now defence in depth rather than the only thing standing between a stranger and someone's wedding.
- Ownership scoping is **not** the multi-tenant dashboard that `CLAUDE.md` rules out. There is no per-client branding, no tenant switching, no sharing — just a row knowing who created it.
- Every host policy is `owner_id = auth.uid() **or** public.is_admin()`. See Roles below.
- `owner_id` is `not null`, so a user must exist before any event can be inserted. Create your own account in the dashboard before seeding development data.

## Roles

Two: `user` (the default every signup gets) and `admin` (the operator).

```sql
create type public.app_role as enum ('user', 'admin');

create table public.profiles (
  id         uuid primary key references auth.users (id) on delete cascade,
  role       public.app_role not null default 'user',
  created_at timestamptz not null default now()
);
```

- Rows are written by an `after insert on auth.users` trigger, not by app code. Signup happens inside Supabase Auth, so there is no point in our request path that reliably runs for every new account — `/auth/callback` is already too late and can be abandoned.
- `public.is_admin()` **must** be `security definer`, for a sharper version of the reason `event_accepts_uploads()` is. Inside `profiles`' own policy an inline `exists (select … from profiles)` recurses; inside `events`' policy it is filtered by `profiles`' policy. Reading a role has to bypass RLS.
- **No self-update policy on `profiles`.** A user may read their role and may not write it — otherwise `role = 'admin'` is one PATCH away for anyone with the anon key and a session, which is everyone. Promote through another admin, or through the SQL editor for the first one.
- The admin bypass is OR'd into the existing host policies on `events`, `photos` and `storage.objects`. The bucket check stays _outside_ the OR: an admin session must not become a general key to buckets this app never created.
- Consequence to expect on first login as an admin: `owned_events_with_previews()` is `security invoker`, so `/admin` lists **every** event in the system.

## Billing

One-time purchase per event, and the free upload cap it lifts. Full rationale in `CLAUDE.md`; the database side:

- `purchases` is a **ledger**, not a flag. Abandoned checkouts leave `pending` rows on purpose. There is deliberately **no** partial unique index on `(event_id) where status = 'paid'` — it reads like a good guard, but it would make the webhook unable to record a second payment Stripe already took, and money with no row explaining it is worse than a duplicate row. Refusing to _start_ a second checkout is the right place for that check.
- Hosts can insert a `pending` row for their own event and nothing else. There is **no update policy at all**, so the only way a row reaches `paid` is the webhook running as the service role. A host who could write that column could grant themselves a free album.
- `stripe_webhook_events` has RLS on and **no policies**: service role only. It is idempotency plus the audit trail you want during a dispute.
- The cap is checked in `event_accepts_uploads()` _and_ `event_folder_accepts_uploads()` — the row and the object are two separate policies, and gating one leaves the other open.
- `event_photo_count_capped(uuid, integer)` exists because this runs on every guest upload. An unbounded `count(*)` would grow with the album on the one write path the pilot is measuring; bounded by the limit it is an index-only scan of a handful of tuples.
- The cap counts **hidden** photos. `hidden_at` is moderation, not deletion — the object still costs storage.
- Accepted race: two guests can both pass the check for the last free slot and land one photo over. It is a commercial limit, not a safety property, and serialising every guest upload behind a lock is not a trade worth making.

## Storage

```sql
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('event-photos', 'event-photos', true, 15728640, array['image/jpeg'])
on conflict (id) do nothing;

-- No select policy for anon. See "Public download, but no listing".
create policy "guests upload into an open event folder"
  on storage.objects for insert to anon, authenticated
  with check (
    bucket_id = 'event-photos'
    and public.event_folder_accepts_uploads((storage.foldername(name))[1])
  );

create policy "host manages objects in own events"
  on storage.objects for all to authenticated
  using (
    bucket_id = 'event-photos'
    and (storage.foldername(name))[1] in (
      select e.id::text from public.events e where e.owner_id = auth.uid()
    )
  )
  with check (
    bucket_id = 'event-photos'
    and (storage.foldername(name))[1] in (
      select e.id::text from public.events e where e.owner_id = auth.uid()
    )
  );
```

### Public download, but no listing

The bucket is public, which in Supabase means the `/storage/v1/object/public/…` route serves files **without consulting RLS**. Public download therefore needs no select policy, and granting one to `anon` would buy nothing for viewing while enabling `POST /storage/v1/object/list/event-photos` — which walks every event id and photo id in the project. That is the storage-layer twin of the table enumeration hole, and it would hand over every album no matter how unguessable the slug is. Verified in `supabase/tests/storage.py`.

`event_folder_accepts_uploads(text)` is `security definer` for the same reason `event_accepts_uploads()` is: policy expressions run as the invoking role, and anon cannot read `events`, so an inline subquery would evaluate false and silently refuse every upload.

- Path layout: `event-photos/{event_id}/{photo_id}.jpg`, with the tile alongside it at `{photo_id}_thumb.jpg`. The first path segment is always the event id — every policy above depends on that, so never flatten the layout.
- Compare the folder segment as **text**, not by casting the segment to `uuid`. Guests control that path, and a malformed segment would make a cast raise instead of cleanly failing the check.
- Guest inserts are scoped to a folder belonging to a real event with an open upload window. A blanket `with check (bucket_id = 'event-photos')` would let anyone write arbitrary objects into any folder they invented.
- Guests get insert only — no update, no delete — so knowing an exact path is not enough to overwrite or remove someone else's photo.
- **Public objects are CDN-cached, so removal is not instant.** A deleted file keeps answering `200` from the edge for a while, and hiding a photo (`hidden_at`) only drops it from the gallery — the object itself stays fetchable at its URL to anyone who already has it. Fine for moderation, where the point is that guests stop seeing it in the album; worth stating plainly if a deletion is ever requested under GDPR, where 5.8 must remove the object and you should expect cache lag.
- Only `image/jpeg` is allowed because the client always converts and compresses to JPEG first (see `ourfilm-upload`). HEIC never reaches the bucket.
- Public bucket = privacy comes from unguessable event slugs, not from storage ACLs. Slugs carry a random suffix (`lib/slug.ts`, `generateEventSlug()`); add `noindex` to event routes.
- Guests can insert but never update or delete an object, so nobody can overwrite someone else's photo by guessing its path.

## Clients

Two files, two purposes. Never import the server client from a Client Component.

`lib/supabase/client.ts` — two browser helpers:

- `createClient()` — `createBrowserClient` from `@supabase/ssr`. Reads the auth cookies. Use this for `/admin` sign-in and anything that should see the host session.
- `createGuestClient()` — `@supabase/supabase-js` with `persistSession: false`. Always the anon key, no cookies. **Guest uploads must use this**, so a leftover admin session on the phone cannot change the role Storage sees. The QR-opened page and the shared-link page then hit the API as the same role.

```ts
import { createBrowserClient } from '@supabase/ssr'
import { createClient as createSupabaseClient } from '@supabase/supabase-js'
import type { Database } from './database.types'

export function createClient() {
  return createBrowserClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  )
}

export function createGuestClient() {
  return createSupabaseClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
        detectSessionInUrl: false,
      },
    },
  )
}
```

`lib/supabase/server.ts` — Server Components, Route Handlers, Server Actions. `cookies()` is **async** in Next.js 16:

```ts
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import type { Database } from './database.types'

export async function createClient() {
  const cookieStore = await cookies()

  return createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => cookieStore.getAll(),
        setAll: (cookiesToSet) => {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options),
            )
          } catch {
            // Called from a Server Component render; proxy.ts refreshes it.
          }
        },
      },
    },
  )
}
```

## Data access

Keep queries in `lib/` modules (`lib/events.ts`, `lib/photos.ts`), not inline in components, so admin and guest pages share one definition of "visible photo".

Guest-facing reads go through the RPCs, never `.from('events')` — the table returns nothing to `anon` by design:

```ts
export async function getEventBySlug(slug: string) {
  const supabase = await createClient()
  const { data, error } = await supabase
    .rpc('event_by_slug', { p_slug: slug })
    .maybeSingle()

  if (error) throw error
  return data // null → caller calls notFound()
}

export async function getEventPhotos(eventId: string) {
  const supabase = await createClient()
  const { data, error } = await supabase.rpc('event_photos', {
    p_event_id: eventId,
  })

  if (error) throw error
  return data ?? []
}
```

Admin reads are the exception: a signed-in host queries `events` and `photos` directly, and ownership policies scope the result. That path also sees `hidden_at` rows, which the guest RPCs filter out.

Use `.maybeSingle()` for slug lookups (`.single()` throws on miss). Always check `error` — Supabase does not reject the promise on query failure.

## Caching

The gallery must show photos uploaded seconds ago, so it cannot be statically cached. Read fresh on the gallery and event routes (`export const dynamic = 'force-dynamic'`, or `revalidate = 0`), and revalidate after admin mutations. There is no Realtime subscription in scope — guests see new photos on refresh.

## Admin auth

Magic link, guarded by **`proxy.ts`**. Next.js 16 renamed middleware:

> **Email delivery is the weak link.** Supabase's built-in service only delivers
> to project team members and allows 2 messages per hour, with no SLA — it is
> documented as unsuitable for production. Magic link is the only way into
> `/admin`, so configure custom SMTP before launch (ticket 6.7d — Resend:
> `smtp.resend.com`, user `resend`, password = API key). Note that Resend's SMTP
> needs a **verified domain**, so it cannot be set up before `ourfilm.app` resolves.
> To sign in without waiting on mail, `POST /auth/v1/admin/generate_link` with
> the service key returns a usable link directly; that is how the auth flow is
> tested here.

```ts
// proxy.ts at the repo root — refresh the session and gate /admin
export function proxy(request: NextRequest) {
  /* … */
}
export const proxyConfig = { matcher: ['/admin/:path*'] }
```

|        | Next 14–15      | **Next 16 (this project)** |
| ------ | --------------- | -------------------------- |
| File   | `middleware.ts` | `proxy.ts`                 |
| Export | `middleware()`  | `proxy()`                  |
| Config | `config`        | `proxyConfig`              |

This matters more than a rename usually would: a `middleware.ts` in a Next 16 project is **silently ignored**. There is no warning and no error — the file simply never runs, and `/admin` ends up completely unguarded while looking protected in the source tree. Verify the gate by actually requesting `/admin` while signed out.

Inside `proxy()`, create a server client bound to the request/response cookies, call `supabase.auth.getUser()`, and redirect to the login route when there's no user. Use `getUser()` for authorization decisions — never trust `getSession()` on the server, since it reads unverified cookie data.

The ZIP export is the one place that legitimately needs `SUPABASE_SERVICE_ROLE_KEY`: a Route Handler that streams every object for an event, including hidden ones if the host asks. Keep it in a server-only file and re-check the user's session before streaming.
