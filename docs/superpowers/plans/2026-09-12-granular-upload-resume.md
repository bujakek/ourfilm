# Granular Upload Resume Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A retried capture continues from the step its last attempt reached: skip renders already in Storage, go straight to the commit when all three landed, and confirm without sending anything when the commit already went through.

**Architecture:** The server is the only party that saw every ending, so it reports progress. When `reserve_shot` replays an existing reservation, it also returns the row's status and the byte size of each render already in `storage.objects`, all in the same RPC call with no extra round trip. A pure function, `planResume`, turns that report plus the stored shot into one of three plans: `committed`, `commit` or `upload` (listing the missing renders). The queue follows the plan. The device keeps no checkpoint of its own.

**Tech Stack:** Postgres plpgsql (Supabase), Next.js 16 server actions, TypeScript, vitest + fake-indexeddb, local Supabase stack for `pnpm test:db`.

**Spec:** No separate spec. The "Research" section below is the spec.

## Research

### Where a retry wastes work today

`apps/web/lib/upload-queue.ts` `runCapture` runs every attempt start to finish:
`reserve` → `prepare` (decode the master and encode view and thumb) → `upload`
(three parallel PUTs) → `commit`. Nothing carries over between attempts, so:

| Ending of the previous attempt                          | What the retry repeats today                                                       |
| ------------------------------------------------------- | ---------------------------------------------------------------------------------- |
| Master PUT timed out; view and thumb landed             | Decode, all three PUTs (a 2.2 MB master on bad wifi), commit                       |
| All three PUTs landed; a lost response made one throw   | Decode, all three PUTs, commit                                                     |
| All three landed; tab killed before the commit was sent | Decode, all three PUTs, commit                                                     |
| Commit ran on the server; its response was lost         | Decode, all three PUTs (**overwriting objects the CDN may already serve**), commit |

### Why the server reports progress, not an IndexedDB checkpoint

- The endings that matter are answers the device **never received**: a PUT
  that completed after the client's 120 s timeout, or a commit whose response
  was lost in transit (path B6 in `docs/upload-commit-observability.md`). A
  device-side "landed" flag would be false in exactly those cases.
- CLAUDE.md: "Do not persist photo ids or signed URLs; a replay gets fresh
  ones." This design persists neither.
- A HEAD request against the public object URL was rejected. It adds three
  requests from the phone on the worst network in the flow, and a CDN can
  cache a 404.

### Facts verified in this repo

- `reserve_shot` (`supabase/migrations/20260912120000_upload_grace.sql`) is
  `security definer`, owned by `postgres`. On the local stack
  `has_table_privilege('postgres','storage.objects','select')` is `t`, so the
  function can read `storage.objects` directly.
- A replay looks up the row by `(participant_id, idempotency_key)` whatever its
  status, and returns the same `photo_id` and paths, so the object names are
  stable across attempts.
- `commit_shot` is a plain `update … set status = 'ready'`, so it is already
  idempotent on a `ready` row. Resuming at the commit needs no SQL change.
- `storage.objects` has `bucket_id`, `name` and `metadata` (jsonb).
  `metadata->>'size'` is the object size. The observability doc already queries
  it. The local storage-api is v1.70.4.
- Signed upload URLs are minted with `upsert: true`, so re-sending one render is
  safe.
- The master uploaded for a compressed row is `shot.blob` as it stands
  (`prepareStoredShot` returns `full: shot.blob`). Its size is known exactly
  without a decode, so a stored master can be checked by byte size. View and
  thumb are re-encoded on every prepare, so their bytes can differ between
  attempts; for them, being present is enough.
- A **raw** row (`compressed: false`) is decoded again on every prepare and
  gives a different master each time, so it cannot vouch for anything in
  Storage. The fix is to write the prepared master back to the store before
  uploading it. From then on the row is compressed and can resume.

### Deploy order is safe either way

- New web code against the old database: the new columns are missing,
  `reservationProgress` returns `null`, and the queue takes the full path it
  takes today.
- Old web code against the new database: supabase-js ignores the extra
  columns.

`ReserveState.progress` is optional so that a tab running new client code
against an older deployment also falls back to the full path.

### Known risk, not verified here

storage-api writes the `storage.objects` row only after the backend write
completes, so a row means a complete object. This was not tested with an
aborted mid-body PUT. Two guards limit the exposure:

- the master must match the device's byte count exactly;
- a render with no `size` in its metadata, or a size of zero, counts as absent.

## Global Constraints

- pnpm only. Run every command from the repository root.
- `pnpm test:db` runs **only against the local stack**
  (`pnpm supabase start`, `pnpm supabase db reset`). Never push the migration
  as part of this plan: `pnpm supabase db push` is a deploy step for a human.
- Revoke function grants from `anon, authenticated` **by name**. `revoke … from public` does not remove Supabase's direct grants.
- A plpgsql body is not checked until it runs. Reference only `bucket_id`,
  `name` and `metadata` on `storage.objects`: a column the hosted storage
  schema lacks would break every production reservation, not the migration.
- Do not persist photo ids or signed URLs in IndexedDB. Do not release a
  reservation between retries. `MAX_ATTEMPTS`, `MAX_AGE_MS` and the attempt
  budget rules in `apps/web/lib/upload-failure.ts` are unchanged.
- Code, comments and commit messages in English. Prettier: no semicolons,
  single quotes. Run `pnpm format` after writing files.
- Commit messages follow the repo's sentence style (e.g. "Let a replayed
  reservation say which renders already landed") and end with:

  ```
  Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>
  Claude-Session: https://claude.ai/code/session_013zvecyHH5an4GNepuiLuah
  ```

---

## File Structure

| File                                                                                         | Change     | Responsibility                                                                                                        |
| -------------------------------------------------------------------------------------------- | ---------- | --------------------------------------------------------------------------------------------------------------------- |
| `supabase/migrations/20260912160000_reserve_shot_reports_progress.sql`                       | Create     | `reserve_shot` replay returns `photo_status` plus the size of each stored render                                      |
| `apps/web/tests/db/storage.test.ts`                                                          | Modify     | Pins what a replay reports                                                                                            |
| `apps/web/lib/supabase/database.types.ts`                                                    | Regenerate | New return columns                                                                                                    |
| `apps/web/lib/upload-resume.ts`                                                              | Create     | `RenderKind`, `ReservationProgress`, `reservationProgress()`, `planResume()`: pure, importable from server and client |
| `apps/web/tests/unit/upload-resume.test.ts`                                                  | Create     | The decision table                                                                                                    |
| `apps/web/lib/capture.ts`                                                                    | Modify     | Maps the RPC row to `progress`                                                                                        |
| `apps/web/app/(product)/e/[slug]/actions.ts`                                                 | Modify     | `ReserveState.progress`; guest action passes it through                                                               |
| `apps/web/app/(product)/host/events/[slug]/capture-actions.ts`                               | Modify     | Host action passes it through                                                                                         |
| `apps/web/lib/upload-shot.ts`                                                                | Modify     | Uploads a list of renders instead of always three                                                                     |
| `apps/web/lib/upload-queue.ts`                                                               | Modify     | Follows the plan; writes a raw row's prepared master back to the store; `resumed` attempt step                        |
| `apps/web/tests/unit/upload-queue.test.ts`                                                   | Modify     | Resume behaviour; the upload-args change                                                                              |
| `apps/web/lib/telemetry.ts`                                                                  | Modify     | `upload_resumed`; `renders_sent`                                                                                      |
| `apps/web/components/event/guest-event-view.tsx`                                             | Modify     | Maps the `resumed` step to the event                                                                                  |
| `CLAUDE.md`, `.cursor/skills/ourfilm-upload/SKILL.md`, `docs/upload-commit-observability.md` | Modify     | Record the rule                                                                                                       |

---

### Task 1: `reserve_shot` reports how far a replayed reservation got

**Files:**

- Create: `supabase/migrations/20260912160000_reserve_shot_reports_progress.sql`
- Modify: `apps/web/tests/db/storage.test.ts`
- Regenerate: `apps/web/lib/supabase/database.types.ts`

**Interfaces:**

- Produces: the four-argument `reserve_shot` returns four extra columns:
  `photo_status text` (`'pending' | 'ready'`, null on a refusal),
  `full_bytes bigint`, `view_bytes bigint`, `thumb_bytes bigint` (null when
  there is no object, and always null except on a replay of a `pending` row).
  The three-argument overload is untouched.

- [ ] **Step 1: Make sure the local stack is up and migrated**

Run: `pnpm supabase status && pnpm supabase db reset`
Expected: the local API URL is printed and the reset applies all migrations without error.

- [ ] **Step 2: Write the failing DB tests**

In `apps/web/tests/db/storage.test.ts`, add `import { randomUUID } from 'node:crypto'` as the first import, add `commitShot` to the `./harness` import list, and append this block at the end of the file:

```ts
describe('a replayed reservation', () => {
  /**
   * A retry asks `reserve_shot` again with the same capture id, and the answer
   * says how far the last attempt got. The device cannot know that on its own:
   * the endings that matter are a PUT that landed after the browser gave up
   * and a commit whose response was lost.
   */
  it('says nothing is stored for a row it has just made', async () => {
    const event = await createEvent({ ownerId: host.id })
    try {
      const session = newSession()
      await joinEvent(event.slug, 'Réka', session)
      const first = await reserveShot(event.id, session)

      expect(first).toMatchObject({
        photo_status: 'pending',
        full_bytes: null,
        view_bytes: null,
        thumb_bytes: null,
      })
    } finally {
      await deleteEvent(event.id)
    }
  }, 60_000)

  it('names each render Storage already holds, with its size', async () => {
    const event = await createEvent({ ownerId: host.id })
    const db = serviceClient()
    let path: string | null = null
    try {
      const session = newSession()
      await joinEvent(event.slug, 'Réka', session)
      const key = randomUUID()
      const first = await reserveShot(event.id, session, key)
      path = first!.storage_path as string

      const { error } = await db.storage
        .from(BUCKET)
        .upload(path, JPEG, { contentType: 'image/jpeg' })
      expect(error).toBeNull()

      const replay = await reserveShot(event.id, session, key)
      expect(replay?.photo_id).toBe(first?.photo_id)
      expect(replay).toMatchObject({
        photo_status: 'pending',
        full_bytes: JPEG.size,
        view_bytes: null,
        thumb_bytes: null,
      })
    } finally {
      if (path) await db.storage.from(BUCKET).remove([path])
      await deleteEvent(event.id)
    }
  }, 60_000)

  it('says a committed row needs nothing more', async () => {
    const event = await createEvent({ ownerId: host.id })
    try {
      const session = newSession()
      await joinEvent(event.slug, 'Réka', session)
      const key = randomUUID()
      const first = await reserveShot(event.id, session, key)
      await commitShot(first!.photo_id as string, session)

      const replay = await reserveShot(event.id, session, key)
      expect(replay).toMatchObject({
        photo_id: first?.photo_id,
        photo_status: 'ready',
        refusal: null,
      })
    } finally {
      await deleteEvent(event.id)
    }
  }, 60_000)

  it('reports no status on a refusal', async () => {
    const event = await createEvent({ ownerId: host.id })
    try {
      // Never joined: the RPC refuses before any row exists.
      const replay = await reserveShot(event.id, newSession())
      expect(replay).toMatchObject({
        refusal: 'no_session',
        photo_status: null,
      })
    } finally {
      await deleteEvent(event.id)
    }
  }, 60_000)
})
```

- [ ] **Step 3: Run the DB tests to verify they fail**

Run: `pnpm test:db`
Expected: the four new tests in `storage.test.ts` FAIL (`photo_status` is `undefined`); everything else passes. The file does not typecheck yet either; vitest runs it regardless.

- [ ] **Step 4: Write the migration**

Create `supabase/migrations/20260912160000_reserve_shot_reports_progress.sql`:

```sql
-- Tell a replayed reservation how far its last attempt got.
--
-- A capture is reserve → three PUTs → commit, and a retry used to repeat all
-- of it: decode the master again, send all three renders again, commit again.
-- The device cannot do better on its own. The endings that matter are answers
-- it never received — a PUT that landed after the browser's timeout, a commit
-- that went through while its response was lost — so only the server knows
-- where the photo really stopped, and now it says:
--
--   photo_status                        'pending' | 'ready'. A ready row needs
--                                       nothing more from the device.
--   full_bytes, view_bytes, thumb_bytes the size Storage holds for each render,
--                                       null where there is no object.
--
-- Storage is consulted only on a replay of a pending row. A row this call
-- inserted cannot have objects yet, a ready row does not need them, and a
-- refusal has no row: all four are null there.
--
-- Only `bucket_id`, `name` and `metadata` are read from storage.objects, and
-- by (bucket_id, name), which its unique index serves. A plpgsql body is not
-- checked until it runs, so a column the hosted storage schema lacks would
-- break every reservation in production rather than fail this migration.
--
-- The return type grows, which `create or replace` refuses, so the
-- four-argument function is dropped and recreated. The three-argument wrapper
-- selects its columns by name and is left as it is.

drop function if exists public.reserve_shot(uuid, text, text, timestamptz);

create function public.reserve_shot(
  p_event_id          uuid,
  p_token_hash        text,
  p_idempotency_key   text,
  p_capture_started_at timestamptz
)
returns table (
  photo_id             uuid,
  storage_path         text,
  view_path            text,
  thumb_path           text,
  shots_remaining      integer,
  refusal              text,
  late_seconds         integer,
  claimed_lead_seconds integer,
  photo_status         text,
  full_bytes           bigint,
  view_bytes           bigint,
  thumb_bytes          bigint
)
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_participant public.participants%rowtype;
  v_event       public.events%rowtype;
  v_existing    public.photos%rowtype;
  v_used        integer;
  v_photo_id    uuid;
  v_prefix      text;
  v_late        integer;
  v_lead        integer;
  v_full        bigint;
  v_view        bigint;
  v_thumb       bigint;
begin
  select * into v_participant
  from public.participants p
  where p.event_id = p_event_id
    and p.session_token_hash = p_token_hash
  for update;

  if not found then
    return query select null::uuid, null::text, null::text, null::text, 0, 'no_session', null::integer, null::integer,
      null::text, null::bigint, null::bigint, null::bigint;
    return;
  end if;

  select * into v_event from public.events e where e.id = p_event_id;

  -- A reservation is stronger server-side evidence than any client timestamp.
  -- Replay it before applying either the capture window or the upload grace.
  select * into v_existing
  from public.photos p
  where p.participant_id = v_participant.id
    and p.idempotency_key = p_idempotency_key;

  if found then
    if v_existing.status::text = 'pending' then
      select
        max((o.metadata ->> 'size')::bigint) filter (where o.name = v_existing.storage_path),
        max((o.metadata ->> 'size')::bigint) filter (where o.name = v_existing.view_path),
        max((o.metadata ->> 'size')::bigint) filter (where o.name = v_existing.thumb_path)
      into v_full, v_view, v_thumb
      from storage.objects o
      where o.bucket_id = 'event-photos'
        and o.name in (v_existing.storage_path, v_existing.view_path, v_existing.thumb_path);
    end if;

    return query select
      v_existing.id, v_existing.storage_path, v_existing.view_path, v_existing.thumb_path,
      greatest(v_event.shots_per_participant - public.participant_shots_used(v_participant.id), 0),
      null::text, null::integer, null::integer,
      v_existing.status::text, v_full, v_view, v_thumb;
    return;
  end if;

  if now() < v_event.capture_start_at then
    return query select null::uuid, null::text, null::text, null::text, 0, 'not_started', null::integer, null::integer,
      null::text, null::bigint, null::bigint, null::bigint;
    return;
  end if;

  -- While the camera is open, server time is the only clock that matters. Once
  -- it closes, a new reservation needs both an in-window device claim and an
  -- arrival inside the bounded upload grace period.
  if now() > v_event.capture_end_at and (
    now() > v_event.capture_end_at + public.shot_upload_grace()
    or p_capture_started_at is null
    or p_capture_started_at < v_event.capture_start_at
    or p_capture_started_at > v_event.capture_end_at
    -- Guest joins stay available after the event so a new viewer can enter a
    -- revealed gallery. That must not also mint a late roll. The host row is
    -- exempt: it is created lazily on the host's first reserve call, after the
    -- action has already proved event ownership.
    or (v_participant.user_id is null and v_participant.joined_at > v_event.capture_end_at)
  ) then
    return query select null::uuid, null::text, null::text, null::text, 0, 'ended', null::integer, null::integer,
      null::text, null::bigint, null::bigint, null::bigint;
    return;
  end if;

  v_used := public.participant_shots_used(v_participant.id);

  if v_used >= v_event.shots_per_participant then
    return query select null::uuid, null::text, null::text, null::text, 0, 'no_shots', null::integer, null::integer,
      null::text, null::bigint, null::bigint, null::bigint;
    return;
  end if;

  -- Past this point after the close, the grace is what let the shot in.
  if now() > v_event.capture_end_at then
    v_late := floor(extract(epoch from now() - v_event.capture_end_at))::integer;
    v_lead := floor(extract(epoch from v_event.capture_end_at - p_capture_started_at))::integer;
  end if;

  v_photo_id := gen_random_uuid();
  v_prefix := p_event_id::text || '/' || v_photo_id::text;

  insert into public.photos (
    id, event_id, participant_id, status, idempotency_key,
    storage_path, view_path, thumb_path, mime_type
  ) values (
    v_photo_id, p_event_id, v_participant.id, 'pending', p_idempotency_key,
    v_prefix || '.jpg', v_prefix || '_view.jpg', v_prefix || '_thumb.jpg', 'image/jpeg'
  );

  return query select
    v_photo_id, v_prefix || '.jpg', v_prefix || '_view.jpg', v_prefix || '_thumb.jpg',
    greatest(v_event.shots_per_participant - (v_used + 1), 0),
    null::text, v_late, v_lead,
    'pending'::text, null::bigint, null::bigint, null::bigint;
end;
$$;

-- A dropped function loses its grants, and Supabase grants a new one to the
-- API roles directly. Reassert the boundary by name.
revoke all on function public.reserve_shot(uuid, text, text, timestamptz) from public;
revoke all on function public.reserve_shot(uuid, text, text, timestamptz)
  from anon, authenticated;
grant execute on function public.reserve_shot(uuid, text, text, timestamptz)
  to service_role;
```

- [ ] **Step 5: Apply it and run the DB tests**

Run: `pnpm supabase db reset && pnpm test:db`
Expected: the whole DB suite passes. That includes `capture.test.ts`, which covers the grace, the replay and the anon lockout (`does not expose the capture RPCs to the anon key`), so the dropped function's grants are proven too.

- [ ] **Step 6: Regenerate the types from the local stack**

Run: `pnpm supabase gen types typescript --local > apps/web/lib/supabase/database.types.ts && pnpm types:check:local && pnpm typecheck`
Expected: the four-argument `reserve_shot` `Returns` gains `photo_status`, `full_bytes`, `view_bytes` and `thumb_bytes`; `types:check:local` reports a match; typecheck passes. `pnpm types:check` (linked) will report drift until someone pushes the migration, which is expected.

- [ ] **Step 7: Commit**

```bash
pnpm format
git add supabase/migrations/20260912160000_reserve_shot_reports_progress.sql apps/web/tests/db/storage.test.ts apps/web/lib/supabase/database.types.ts
git commit -m "Let a replayed reservation say which renders already landed" -m "Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_013zvecyHH5an4GNepuiLuah"
```

---

### Task 2: `planResume`, the whole decision in one pure function

**Files:**

- Create: `apps/web/lib/upload-resume.ts`
- Test: `apps/web/tests/unit/upload-resume.test.ts`

**Interfaces:**

- Consumes: the column names from Task 1.
- Produces:

  ```ts
  export type RenderKind = 'full' | 'view' | 'thumb'
  export const RENDER_KINDS: readonly RenderKind[]
  export type ReservationProgress = {
    status: 'pending' | 'ready'
    stored: Record<RenderKind, number | null>
  }
  export function reservationProgress(
    row: ProgressRow,
  ): ReservationProgress | null
  export type MasterFacts = { width: number; height: number; byteSize: number }
  export type ResumePlan =
    | { kind: 'committed' }
    | { kind: 'commit'; present: number; master: MasterFacts }
    | {
        kind: 'upload'
        present: number
        renders: RenderKind[]
        decode: boolean
        master: MasterFacts | null
      }
  export function planResume(
    progress: ReservationProgress | null | undefined,
    shot: ResumeShot,
  ): ResumePlan
  ```

- [ ] **Step 1: Write the failing tests**

Create `apps/web/tests/unit/upload-resume.test.ts`:

```ts
import { describe, expect, it } from 'vitest'

import {
  planResume,
  reservationProgress,
  type ReservationProgress,
} from '@/lib/upload-resume'

const master = {
  compressed: true,
  blobSize: 2_200_000,
  width: 3200,
  height: 2400,
}
const raw = {
  compressed: false,
  blobSize: 8_000_000,
  width: null,
  height: null,
}

function pending(stored: Partial<ReservationProgress['stored']> = {}) {
  return {
    status: 'pending' as const,
    stored: { full: null, view: null, thumb: null, ...stored },
  }
}

describe('reading what the server reported', () => {
  it('is nothing at all from a server that does not say', () => {
    expect(reservationProgress({})).toBeNull()
    expect(reservationProgress({ photo_status: null })).toBeNull()
    expect(reservationProgress({ photo_status: 'archived' })).toBeNull()
  })

  it('treats an object with no size, or none, as not there', () => {
    expect(
      reservationProgress({
        photo_status: 'pending',
        full_bytes: 0,
        view_bytes: null,
        thumb_bytes: 4_000,
      }),
    ).toEqual({
      status: 'pending',
      stored: { full: null, view: null, thumb: 4_000 },
    })
  })
})

describe('what a retry still has to do', () => {
  it('starts from the beginning when the server said nothing', () => {
    expect(planResume(null, master)).toEqual({
      kind: 'upload',
      present: 0,
      renders: ['full', 'view', 'thumb'],
      decode: true,
      master: { width: 3200, height: 2400, byteSize: 2_200_000 },
    })
  })

  it('sends nothing for a row that is already ready', () => {
    expect(planResume({ ...pending(), status: 'ready' }, master)).toEqual({
      kind: 'committed',
    })
    // Whatever the device holds: the commit is the server's fact, not ours.
    expect(planResume({ ...pending(), status: 'ready' }, raw)).toEqual({
      kind: 'committed',
    })
  })

  it('goes straight to the commit when every render landed', () => {
    const progress = pending({ full: 2_200_000, view: 300_000, thumb: 30_000 })
    expect(planResume(progress, master)).toEqual({
      kind: 'commit',
      present: 3,
      master: { width: 3200, height: 2400, byteSize: 2_200_000 },
    })
  })

  it('sends only the master, without a decode, when the renders from it landed', () => {
    const progress = pending({ view: 300_000, thumb: 30_000 })
    expect(planResume(progress, master)).toMatchObject({
      kind: 'upload',
      present: 2,
      renders: ['full'],
      decode: false,
    })
  })

  it('decodes when a render derived from the master is missing', () => {
    const progress = pending({ full: 2_200_000, thumb: 30_000 })
    expect(planResume(progress, master)).toMatchObject({
      kind: 'upload',
      present: 2,
      renders: ['view'],
      decode: true,
    })
  })

  it('sends the master again when Storage holds a different one', () => {
    const progress = pending({ full: 999, view: 300_000, thumb: 30_000 })
    expect(planResume(progress, master)).toMatchObject({
      kind: 'upload',
      present: 2,
      renders: ['full'],
    })
  })

  it('trusts nothing in Storage for a raw row, whose next master differs', () => {
    const progress = pending({ full: 2_200_000, view: 300_000, thumb: 30_000 })
    expect(planResume(progress, raw)).toEqual({
      kind: 'upload',
      present: 0,
      renders: ['full', 'view', 'thumb'],
      decode: true,
      master: null,
    })
  })
})
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `pnpm test -- upload-resume`
Expected: FAIL with `Cannot find module '@/lib/upload-resume'`.

- [ ] **Step 3: Write the module**

Create `apps/web/lib/upload-resume.ts`:

```ts
/**
 * Where a retried capture picks up.
 *
 * A capture is reserve → three PUTs → commit, and a retry used to repeat all
 * of it. This is the whole of the decision that replaced that, as a pure
 * function over two things: what `reserve_shot` reported about the row and
 * its objects, and the shot the device is holding.
 *
 * The server's report is the only input about progress, deliberately. The
 * endings this exists for are answers the device never received — a PUT that
 * landed after the timeout, a commit whose response was lost — so a checkpoint
 * kept on the device would be wrong in exactly the cases that matter.
 *
 * No `server-only` or `client-only` import: `lib/capture.ts` reads the row with
 * `reservationProgress`, and the queue decides with `planResume`.
 */

export type RenderKind = 'full' | 'view' | 'thumb'

export const RENDER_KINDS: readonly RenderKind[] = ['full', 'view', 'thumb']

export type ReservationProgress = {
  status: 'pending' | 'ready'
  /** Byte size of each render already in Storage; null where there is none. */
  stored: Record<RenderKind, number | null>
}

/** The columns `reserve_shot` returns for it. Optional: an older database has
 *  none of them, and that must read as "unknown", never as "nothing stored". */
export type ProgressRow = {
  photo_status?: string | null
  full_bytes?: number | null
  view_bytes?: number | null
  thumb_bytes?: number | null
}

export function reservationProgress(
  row: ProgressRow,
): ReservationProgress | null {
  const status = row.photo_status
  if (status !== 'pending' && status !== 'ready') return null
  return {
    status,
    stored: {
      full: size(row.full_bytes),
      view: size(row.view_bytes),
      thumb: size(row.thumb_bytes),
    },
  }
}

/** An object with no size, or a size of zero, is one worth sending again. */
function size(value: number | null | undefined): number | null {
  return typeof value === 'number' && Number.isFinite(value) && value > 0
    ? value
    : null
}

export type ResumeShot = {
  compressed: boolean
  blobSize: number
  width: number | null
  height: number | null
}

/** What the commit needs about the master, when it is known without a decode. */
export type MasterFacts = { width: number; height: number; byteSize: number }

/**
 * - `committed` — the row is `ready`. Its commit went through on an earlier
 *   attempt and the answer never came back. Nothing is sent again; re-sending
 *   would overwrite objects the CDN may already be serving.
 * - `commit` — all three renders are in Storage. Only the commit is left.
 * - `upload` — `renders` still have to go up. `decode` says whether the
 *   master has to be decoded for them (a view or thumb among them, or a raw
 *   row); `master` is null when only a decode can say what it is.
 */
export type ResumePlan =
  | { kind: 'committed' }
  | { kind: 'commit'; present: number; master: MasterFacts }
  | {
      kind: 'upload'
      present: number
      renders: RenderKind[]
      decode: boolean
      master: MasterFacts | null
    }

export function planResume(
  progress: ReservationProgress | null | undefined,
  shot: ResumeShot,
): ResumePlan {
  if (progress?.status === 'ready') return { kind: 'committed' }

  // A raw row is decoded again on every attempt, and each decode is a
  // different master of a different size: nothing in Storage can be matched
  // to it. The queue writes the master it prepares back to the store, so this
  // lasts one attempt.
  const master =
    shot.compressed && shot.width !== null && shot.height !== null
      ? { width: shot.width, height: shot.height, byteSize: shot.blobSize }
      : null

  if (!progress || !master) {
    return {
      kind: 'upload',
      present: 0,
      renders: [...RENDER_KINDS],
      decode: true,
      master,
    }
  }

  const renders = RENDER_KINDS.filter((kind) => {
    const stored = progress.stored[kind]
    if (stored === null) return true
    // The master goes up as the exact bytes on disk, so a size that differs is
    // a different master. View and thumb are re-encoded every attempt, and any
    // complete one will do.
    return kind === 'full' && stored !== master.byteSize
  })
  const present = RENDER_KINDS.length - renders.length

  if (renders.length === 0) return { kind: 'commit', present, master }
  return {
    kind: 'upload',
    present,
    renders,
    decode: renders.some((kind) => kind !== 'full'),
    master,
  }
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `pnpm test -- upload-resume`
Expected: PASS, 9 tests.

- [ ] **Step 5: Commit**

```bash
pnpm format
git add apps/web/lib/upload-resume.ts apps/web/tests/unit/upload-resume.test.ts
git commit -m "Decide where a retried capture picks up in one pure function" -m "Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_013zvecyHH5an4GNepuiLuah"
```

---

### Task 3: Carry the report through both reserve actions

**Files:**

- Modify: `apps/web/lib/capture.ts:36-50` (`ReservedShot`) and `:111-125` (the return)
- Modify: `apps/web/app/(product)/e/[slug]/actions.ts:139-150` (`ReserveState`) and the guest action's return
- Modify: `apps/web/app/(product)/host/events/[slug]/capture-actions.ts` (host action's return)

**Interfaces:**

- Consumes: `reservationProgress`, `ReservationProgress` (Task 2).
- Produces: `ReserveState` ok variant gains `progress?: ReservationProgress | null`. It is optional so that a browser on new code talking to an older deployment reads it as unknown.

- [ ] **Step 1: `lib/capture.ts`**

Add `import { reservationProgress, type ReservationProgress } from './upload-resume'` beside the other imports. Add this field to `ReservedShot` after `grace`:

```ts
/**
 * How far an earlier attempt at this reservation got: the row's status and
 * the renders already in Storage. Null from a database that predates the
 * report, which the queue reads as "start from the beginning".
 */
progress: ReservationProgress | null
```

In `reserveShot`'s returned `shot`, add after `grace`:

```ts
      progress: reservationProgress(data),
```

- [ ] **Step 2: `ReserveState` and the guest action**

In `apps/web/app/(product)/e/[slug]/actions.ts`, add `import type { ReservationProgress } from '@/lib/upload-resume'`. Add the field to the ok variant of `ReserveState`:

```ts
      /** See `ReservedShot.progress`. Optional: an older deployment omits it. */
      progress?: ReservationProgress | null
```

In `reserveShotAction`'s final return, add `progress: result.shot.progress,`.

- [ ] **Step 3: The host action**

In `hostReserveShotAction`'s final return (`capture-actions.ts`), add `progress: result.shot.progress,`.

- [ ] **Step 4: Verify**

Run: `pnpm typecheck && pnpm test`
Expected: both pass. No behaviour changes yet; the queue ignores the field.

- [ ] **Step 5: Commit**

```bash
pnpm format
git add apps/web/lib/capture.ts "apps/web/app/(product)/e/[slug]/actions.ts" "apps/web/app/(product)/host/events/[slug]/capture-actions.ts"
git commit -m "Hand the camera what a replayed reservation already holds" -m "Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_013zvecyHH5an4GNepuiLuah"
```

---

### Task 4: Upload a list of renders, not always three

A refactor with no behaviour change, so Task 5's diff contains only the resume logic.

**Files:**

- Modify: `apps/web/lib/upload-shot.ts`
- Modify: `apps/web/lib/upload-queue.ts:58-63` (`UploadQueueDeps.upload`) and `:721-745` (the upload call and its trace)
- Modify: `apps/web/tests/unit/upload-queue.test.ts:431` and `:1179`

**Interfaces:**

- Consumes: `RenderKind` (Task 2).
- Produces:

  ```ts
  // lib/upload-shot.ts
  export type RenderUpload = { kind: RenderKind; slot: SignedUpload; body: Blob }
  export async function uploadShotRenders(args: { renders: readonly RenderUpload[]; onProgress?: (fraction: number) => void; signal?: AbortSignal }): Promise<void>
  // lib/upload-queue.ts
  UploadQueueDeps['upload']: (args: { renders: RenderUpload[]; onProgress?: (fraction: number) => void; signal?: AbortSignal }) => Promise<void>
  ```

- [ ] **Step 1: Write the failing test**

In `apps/web/tests/unit/upload-queue.test.ts`, add inside `describe('a shot the guest has just taken', …)`:

```ts
it('sends each render to its own signed slot', async () => {
  const h = harness({ reserve: vi.fn(async () => reserved('photo-1')) })
  const q = queueFor(h)
  q.enqueue('shot-1', file(), NOW)
  await q.drain()

  const [{ renders }] = vi.mocked(h.deps.upload).mock.calls[0]
  expect(
    renders.map(({ kind, slot, body }) => [kind, slot.path, body.size]),
  ).toEqual([
    ['full', `${EVENT}/photo-1.jpg`, prepared.full.size],
    ['view', `${EVENT}/photo-1_view.jpg`, prepared.view.size],
    ['thumb', `${EVENT}/photo-1_thumb.jpg`, prepared.thumb.size],
  ])
})
```

Update the two fakes that read the old argument.

Line 431:

```ts
      upload: vi.fn(async ({ renders }) => {
        if (renders.some((r) => r.slot.path.includes('photo-for-older'))) {
```

Line 1179:

```ts
      upload: vi.fn(async ({ renders }) => {
        if (renders.some((r) => r.slot.path.includes('photo-for-a'))) {
```

- [ ] **Step 2: Run to verify it fails**

Run: `pnpm test -- upload-queue`
Expected: the new test FAILS (`renders` is undefined on the call).

- [ ] **Step 3: `lib/upload-shot.ts`**

Replace the file body below the imports with:

```ts
export type SignedUpload = { path: string; token: string }

/** One render and the signed slot `reserve_shot` minted for it. */
export type RenderUpload = { kind: RenderKind; slot: SignedUpload; body: Blob }

/**
 * PUT the renders a capture still needs to the signed URLs `reserve_shot`
 * minted — all three on a first attempt, only the missing ones on a retry that
 * found the others in Storage (see `lib/upload-resume.ts`).
 *
 * Parallel: the thumbnail would otherwise wait a round trip behind the master.
 * Not retried here — the queue replays the capture with a fresh reserve.
 * `signal` aborts the PUTs when the queue's upload timeout fires.
 */
export async function uploadShotRenders({
  renders,
  onProgress,
  signal,
}: {
  renders: readonly RenderUpload[]
  onProgress?: (fraction: number) => void
  signal?: AbortSignal
}): Promise<void> {
  const supabase = createGuestClient(
    signal ? (input, init) => fetch(input, { ...init, signal }) : undefined,
  )

  const total = renders.reduce((sum, { body }) => sum + body.size, 0)
  let landed = 0

  const puts = await Promise.all(
    renders.map(({ slot, body }) =>
      supabase.storage
        .from(PHOTO_BUCKET)
        .uploadToSignedUrl(slot.path, slot.token, body, {
          contentType: 'image/jpeg',
          cacheControl: '31536000',
        })
        .then((result) => {
          if (!result.error) {
            landed += body.size
            onProgress?.(total > 0 ? landed / total : 1)
          }
          return result
        })
        .catch((error: unknown) => ({ error })),
    ),
  )

  for (const { error } of puts) {
    if (error) throw error
  }
}
```

and add `import type { RenderKind } from './upload-resume'` to its imports. Remove the now-unused `PreparedPhoto` import.

- [ ] **Step 4: The queue**

In `apps/web/lib/upload-queue.ts`:

Change the import `import type { SignedUpload } from '@/lib/upload-shot'` to `import type { RenderUpload } from '@/lib/upload-shot'`.

Change `UploadQueueDeps.upload` to:

```ts
upload: (args: {
  renders: RenderUpload[]
  onProgress?: (fraction: number) => void
  signal?: AbortSignal
}) => Promise<void>
```

In the `'uploaded'` variant of `AttemptStep`, add after `bytes: number`:

```ts
/** How many renders this attempt sent; fewer than three on a resume. */
renders: number
```

Replace the upload block (from `const uploadStarted = clock()` through the `trace(shot.id, { kind: 'uploaded', … })` call) with:

```ts
const renders: RenderUpload[] = [
  { kind: 'full', slot: reserved.uploads.full, body: prepared.full },
  { kind: 'view', slot: reserved.uploads.view, body: prepared.view },
  { kind: 'thumb', slot: reserved.uploads.thumb, body: prepared.thumb },
]
const uploadStarted = clock()
await withTimeout(
  (signal) =>
    deps.upload({
      renders,
      onProgress: (fraction) =>
        notify(() => handlers.onProgress(shot.id, fraction)),
      signal,
    }),
  limits.upload,
  'Uploading a photo',
)
// Every render sent answered without an error. This and the two steps
// below are the stretch a `pending` row with its files present sits in.
trace(shot.id, {
  kind: 'uploaded',
  ...step,
  photoId: reserved.photoId,
  ms: clock() - uploadStarted,
  bytes: renders.reduce((sum, { body }) => sum + body.size, 0),
  renders: renders.length,
})
```

In `apps/web/components/event/guest-event-view.tsx`, change the `'uploaded'` case payload to `{ ...attempt, upload_ms: step.ms, bytes: step.bytes, renders_sent: step.renders }`. In `apps/web/lib/telemetry.ts`, add `renders_sent: number` to `upload_renders_uploaded`:

```ts
  upload_renders_uploaded: AttemptProperties & {
    upload_ms: number
    bytes: number
    /** Fewer than three when a retry found the rest already in Storage. */
    renders_sent: number
  }
```

- [ ] **Step 5: Verify**

Run: `pnpm typecheck && pnpm test`
Expected: all pass, including the new test.

- [ ] **Step 6: Commit**

```bash
pnpm format
git add apps/web/lib/upload-shot.ts apps/web/lib/upload-queue.ts apps/web/lib/telemetry.ts apps/web/components/event/guest-event-view.tsx apps/web/tests/unit/upload-queue.test.ts
git commit -m "Upload the renders a capture names rather than always three" -m "Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_013zvecyHH5an4GNepuiLuah"
```

---

### Task 5: The queue follows the plan

**Files:**

- Modify: `apps/web/lib/upload-queue.ts` (`AttemptStep`, `runCapture` from `photoId = reserved.photoId` through the commit call, a new `promote`)
- Modify: `apps/web/tests/unit/upload-queue.test.ts`

**Interfaces:**

- Consumes: `planResume`, `RenderKind`, `ReservationProgress` (Task 2); `ReserveState.progress` (Task 3); `RenderUpload` (Task 4).
- Produces: a new `AttemptStep` variant, used by Task 6:

  ```ts
  | { kind: 'resumed'; attemptId: string; attempt: number; photoId: string; plan: 'committed' | 'commit' | 'upload'; present: number | null }
  ```

  It is emitted only when the plan is `committed`, `commit`, or an `upload` with `present > 0`, never on a fresh start.

- [ ] **Step 1: Write the failing tests**

In `apps/web/tests/unit/upload-queue.test.ts`, add `import type { ReservationProgress } from '@/lib/upload-resume'`. Below `reserved()`, add:

```ts
function resumed(
  photoId: string,
  progress: ReservationProgress,
  shotsRemaining = 23,
) {
  return { ...reserved(photoId, shotsRemaining), progress }
}

function kinds(h: Harness, call = 0) {
  return vi.mocked(h.deps.upload).mock.calls[call][0].renders.map((r) => r.kind)
}
```

Append this block at the end of the file. `orphan()`'s default blob is 2 bytes and its default dimensions are 4032×3024.

```ts
describe('a retry that picks up where the last attempt stopped', () => {
  /**
   * The server's replay of `reserve_shot` says how far the photo got. Nothing
   * that already happened is done again — not the decode, not a PUT, not the
   * commit — because the endings this exists for are a master that timed out
   * on venue wifi and a commit whose answer never came back.
   */
  function steps(h: Harness) {
    return vi
      .mocked(h.handlers.onAttemptStep!)
      .mock.calls.map(([, step]) => step as unknown as Record<string, unknown>)
  }

  it('confirms a shot whose commit went through, and sends nothing', async () => {
    await orphan({ id: 'shot-1' })
    const h = harness({
      reserve: vi.fn(async () =>
        resumed(
          'photo-1',
          { status: 'ready', stored: { full: null, view: null, thumb: null } },
          20,
        ),
      ),
    })
    h.handlers.onAttemptStep = vi.fn()
    const q = queueFor(h)
    await q.resume()
    await q.drain()

    expect(h.deps.prepare).not.toHaveBeenCalled()
    expect(h.deps.upload).not.toHaveBeenCalled()
    expect(h.deps.commit).not.toHaveBeenCalled()
    expect(h.handlers.onConfirmed).toHaveBeenCalledWith('shot-1', 20)
    expect(await stored()).toEqual([])
    expect(steps(h)).toEqual([
      expect.objectContaining({
        kind: 'resumed',
        plan: 'committed',
        present: null,
      }),
    ])
  })

  it('commits straight away when every render already landed', async () => {
    await orphan({ id: 'shot-1' })
    const h = harness({
      reserve: vi.fn(async () =>
        resumed('photo-1', {
          status: 'pending',
          stored: { full: 2, view: 16, thumb: 4 },
        }),
      ),
    })
    h.handlers.onAttemptStep = vi.fn()
    const q = queueFor(h)
    await q.resume()
    await q.drain()

    expect(h.deps.prepare).not.toHaveBeenCalled()
    expect(h.deps.upload).not.toHaveBeenCalled()
    expect(h.deps.commit).toHaveBeenCalledWith(
      expect.objectContaining({
        photoId: 'photo-1',
        width: 4032,
        height: 3024,
        byteSize: 2,
        takenAt: new Date(NOW).toISOString(),
      }),
    )
    expect(h.handlers.onConfirmed).toHaveBeenCalledWith('shot-1', 23)
    expect(steps(h).map((s) => s.kind)).toEqual([
      'resumed',
      'commit_started',
      'commit_finished',
    ])
  })

  it('sends only the master, without decoding, when the renders from it landed', async () => {
    await orphan({ id: 'shot-1' })
    const h = harness({
      reserve: vi.fn(async () =>
        resumed('photo-1', {
          status: 'pending',
          stored: { full: null, view: 16, thumb: 4 },
        }),
      ),
    })
    const q = queueFor(h)
    await q.resume()
    await q.drain()

    expect(h.deps.prepare).not.toHaveBeenCalled()
    expect(kinds(h)).toEqual(['full'])
    expect(vi.mocked(h.deps.upload).mock.calls[0][0].renders[0].body.size).toBe(
      2,
    )
    expect(h.deps.commit).toHaveBeenCalledWith(
      expect.objectContaining({ byteSize: 2 }),
    )
  })

  it('decodes once and sends only what is missing when a derived render did not land', async () => {
    await orphan({ id: 'shot-1' })
    const h = harness({
      reserve: vi.fn(async () =>
        resumed('photo-1', {
          status: 'pending',
          stored: { full: 2, view: null, thumb: 4 },
        }),
      ),
    })
    const q = queueFor(h)
    await q.resume()
    await q.drain()

    expect(h.deps.prepare).toHaveBeenCalledTimes(1)
    expect(kinds(h)).toEqual(['view'])
  })

  it('sends the master again when Storage holds a different one', async () => {
    await orphan({ id: 'shot-1' })
    const h = harness({
      reserve: vi.fn(async () =>
        resumed('photo-1', {
          status: 'pending',
          stored: { full: 999, view: 16, thumb: 4 },
        }),
      ),
    })
    const q = queueFor(h)
    await q.resume()
    await q.drain()

    expect(kinds(h)).toEqual(['full'])
  })

  it('keeps the master it prepared from a raw row, so the next retry can resume', async () => {
    await orphan({ id: 'shot-1', compressed: false, width: null, height: null })
    let reserves = 0
    const h = harness({
      reserve: vi.fn(async () => {
        reserves += 1
        // First: renders from some earlier raw decode — a raw row trusts none.
        // Second: the master this attempt kept, plus the two derived renders.
        return resumed('photo-1', {
          status: 'pending',
          stored:
            reserves === 1
              ? { full: 2, view: 16, thumb: 4 }
              : { full: prepared.full.size, view: 16, thumb: 4 },
        })
      }),
      upload: vi.fn(async () => {
        throw Object.assign(new Error('HTTP 500'), { status: 500 })
      }),
    })
    const q = queueFor(h)
    await q.resume()
    await q.drain()

    expect(kinds(h)).toEqual(['full', 'view', 'thumb'])
    const [row] = await uploadStore.listByEvent(EVENT)
    expect(row).toMatchObject({ compressed: true, width: 4032, height: 3024 })
    expect(row.blob.size).toBe(prepared.full.size)

    armed(h)!.run()
    await until(async () => (await stored()).length === 0)

    expect(h.deps.prepare).toHaveBeenCalledTimes(1)
    expect(h.deps.upload).toHaveBeenCalledTimes(1)
    expect(h.deps.commit).toHaveBeenCalledWith(
      expect.objectContaining({ byteSize: prepared.full.size }),
    )
  })
})
```

The existing test `reports the renders, the commit and its answer under one attempt id` already pins that a fresh shot, whose `reserved()` carries no `progress`, emits no `resumed` step.

- [ ] **Step 2: Run to verify they fail**

Run: `pnpm test -- upload-queue`
Expected: the six new tests FAIL. For example, `prepare` was called when it should not have been, and `kinds` lists all three renders.

- [ ] **Step 3: Add the `resumed` step type**

In `AttemptStep`, add this variant after `'uploaded'`:

```ts
  | {
      /**
       * The server's replay said part of the capture was already done.
       * `present` is how many renders were in Storage; null for a row that
       * was already `ready`, where nothing was looked up.
       */
      kind: 'resumed'
      attemptId: string
      attempt: number
      photoId: string
      plan: 'committed' | 'commit' | 'upload'
      present: number | null
    }
```

Add this import (`PreparedPhoto` is already imported from `@/lib/image`):

```ts
import {
  planResume,
  type MasterFacts,
  type RenderKind,
} from '@/lib/upload-resume'
```

- [ ] **Step 4: Add `promote` beside `refund`**

```ts
/**
 * Keep the master an attempt had to make from a raw row.
 *
 * A raw row vouches for nothing in Storage: its next decode is a different
 * master of a different size, so a retry could only start again. Written
 * **before** the upload, so a master that lands is always the bytes on disk
 * and the next retry resumes from it — and never decodes the camera file
 * again, which is the same trade `settle` makes.
 */
async function promote(item: QueueItem, prepared: PreparedPhoto) {
  item.shot.blob = prepared.full
  item.shot.compressed = true
  item.shot.width = prepared.width
  item.shot.height = prepared.height
  item.shot.takenAt = prepared.takenAt?.toISOString() ?? null
  await deps.store.put(item.shot)
}
```

- [ ] **Step 5: Follow the plan in `runCapture`**

Replace everything from `attempt.stage = stage = 'prepare'` (just after `notify(() => handlers.onReserved(…))`) through the closing of the `trace(shot.id, { kind: 'uploaded', … })` call with:

```ts
const plan = planResume(reserved.progress, {
  compressed: shot.compressed,
  blobSize: shot.blob.size,
  width: shot.width,
  height: shot.height,
})
if (plan.kind !== 'upload' || plan.present > 0) {
  trace(shot.id, {
    kind: 'resumed',
    ...step,
    photoId: reserved.photoId,
    plan: plan.kind,
    present: plan.kind === 'committed' ? null : plan.present,
  })
}

if (plan.kind === 'committed') {
  // An earlier attempt's commit went through and its answer was lost.
  // The replay's count already includes this frame.
  if (await deps.store.remove(shot.id)) claimed.delete(shot.id)
  notify(() => handlers.onConfirmed(shot.id, reserved.shotsRemaining))
  return 'done'
}

let master: MasterFacts
let takenAt: string | null
if (plan.kind === 'commit') {
  master = plan.master
  takenAt = shot.takenAt
} else {
  let prepared: PreparedPhoto | null = null
  if (plan.decode) {
    attempt.stage = stage = 'prepare'
    prepared = await deps.prepare(shot)
    if (!shot.compressed) await promote(item, prepared)
  }
  const facts =
    plan.master ??
    (prepared && {
      width: prepared.width,
      height: prepared.height,
      byteSize: prepared.full.size,
    })
  // `planResume` only skips the decode for a master it could measure.
  if (!facts) throw new Error('No master to upload')
  master = facts
  takenAt = prepared ? (prepared.takenAt?.toISOString() ?? null) : shot.takenAt

  const body = (kind: RenderKind): Blob => {
    if (kind === 'full') return prepared?.full ?? shot.blob
    if (!prepared) throw new Error(`No ${kind} render was prepared`)
    return prepared[kind]
  }
  const renders: RenderUpload[] = plan.renders.map((kind) => ({
    kind,
    slot: reserved.uploads[kind],
    body: body(kind),
  }))

  attempt.stage = stage = 'upload'
  const uploadStarted = clock()
  await withTimeout(
    (signal) =>
      deps.upload({
        renders,
        onProgress: (fraction) =>
          notify(() => handlers.onProgress(shot.id, fraction)),
        signal,
      }),
    limits.upload,
    'Uploading a photo',
  )
  // Every render sent answered without an error. This and the two steps
  // below are the stretch a `pending` row with its files present sits in.
  trace(shot.id, {
    kind: 'uploaded',
    ...step,
    photoId: reserved.photoId,
    ms: clock() - uploadStarted,
    bytes: renders.reduce((sum, { body }) => sum + body.size, 0),
    renders: renders.length,
  })
}
```

In the commit call below, replace the four arguments that read `prepared`:

```ts
              width: master.width,
              height: master.height,
              byteSize: master.byteSize,
```

and replace the `takenAt:` expression (keep its comment) with:

```ts
              takenAt: takenAt ?? new Date(shot.capturedAt).toISOString(),
```

This keeps today's precedence on the decode path (the prepared EXIF time, then the shutter time), which the existing tests `commits the shutter time when the file carries no capture time` and `prefers the capture time in the file over the shutter time` pin.

In the `catch`, the `stage === 'prepare'` branch is unchanged. `stage` is now only set to `'prepare'` when a decode actually runs, so the reported stage stays true.

- [ ] **Step 6: Run the whole unit suite**

Run: `pnpm test`
Expected: all pass. If `still uploads when compression itself fails` asserts that the stored row is still raw (`compressed: false`) _after a successful attempt_, it pins the behaviour Step 4 deliberately changes. Update that one assertion to `compressed: true` and say so in the commit body. Nothing else should need changing.

- [ ] **Step 7: Commit**

```bash
pnpm format
git add apps/web/lib/upload-queue.ts apps/web/tests/unit/upload-queue.test.ts
git commit -m "Resume a retried capture at the step it stopped on" -m "Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_013zvecyHH5an4GNepuiLuah"
```

---

### Task 6: Report resumes, and record the rule

**Files:**

- Modify: `apps/web/lib/telemetry.ts` (after `upload_renders_uploaded`)
- Modify: `apps/web/components/event/guest-event-view.tsx` (the `onAttemptStep` switch)
- Modify: `CLAUDE.md`, `.cursor/skills/ourfilm-upload/SKILL.md`, `docs/upload-commit-observability.md`

**Interfaces:**

- Consumes: the `resumed` `AttemptStep` (Task 5).
- Produces: browser event `upload_resumed`.

- [ ] **Step 1: The event**

In `apps/web/lib/telemetry.ts`, after `upload_renders_uploaded`:

```ts
  /**
   * A retry found part of the capture already done and skipped it:
   * `committed` (the commit had gone through; nothing sent), `commit` (all
   * renders in Storage) or `upload` with some renders present.
   */
  upload_resumed: AttemptProperties & {
    resume: 'committed' | 'commit' | 'upload'
    renders_present: number | null
  }
```

In `guest-event-view.tsx`, add this case to the `onAttemptStep` switch:

```ts
            case 'resumed':
              track(
                'upload_resumed',
                {
                  ...attempt,
                  resume: step.plan,
                  renders_present: step.present,
                },
                { urgent: true },
              )
              return
```

The host camera does not map attempt steps today and is left as it is.

- [ ] **Step 2: Verify**

Run: `pnpm typecheck && pnpm test -- telemetry`
Expected: pass. The switch has no `default` and no exhaustiveness check, so typecheck would not notice a missing case; confirm by reading that the `'resumed'` case is there.

- [ ] **Step 3: `CLAUDE.md`**

In "The upload queue survives the tab", after the paragraph beginning "Resume replays with the same capture id", add:

```markdown
**A replay resumes where the last attempt stopped, and the server says where
that was.** `reserve_shot` replaying an existing reservation also returns the
row's `photo_status` and the byte size of each render already in Storage
(`20260912160000`), and `planResume` in `apps/web/lib/upload-resume.ts` is the
whole decision: a `ready` row is confirmed without sending anything — its
commit went through and the answer was lost; a pending row with all three
renders goes straight to the commit; otherwise only the missing renders go up,
and the master is decoded only when the view or thumb is among them. The
device keeps no checkpoint of its own on purpose: the endings this exists for
are answers it never received. A raw row vouches for nothing in Storage — its
next decode is a different master — so a master prepared from one is written
back to the store before it is uploaded.
```

In the guest-path telemetry table, add after `upload_renders_uploaded`:

```markdown
| `upload_resumed` | A retry skipped work already done: `committed`, `commit`, or some renders |
```

- [ ] **Step 4: The upload skill**

In `.cursor/skills/ourfilm-upload/SKILL.md`, append to the bullet "**Resume replays with the same capture id.**":

```markdown
The replay's `reserve_shot` answer says how far the last attempt got
(`photo_status` and each render's stored size), and
`apps/web/lib/upload-resume.ts` turns that into what is left: nothing, the
commit, or only the missing renders.
```

- [ ] **Step 5: The observability doc**

In `docs/upload-commit-observability.md`:

- In B.6, replace "A request that arrived after the browser gave up may still commit." with: "A request that arrived after the browser gave up may still commit; the retry's `reserve_shot` then reports the row `ready`, and the device confirms it without uploading or committing again (`upload_resumed`, `resume = 'committed'`)."
- In D.10, replace "The whole capture is retried; `upsert: true` re-uploads the same paths." with: "The retry's `reserve_shot` reports the objects that landed, and only the missing renders are sent again (`upload_resumed`); a stored master whose size differs from the device's is sent again under `upsert: true`."
- In the browser events table, add after `upload_renders_uploaded`:
  `| \`upload_resumed\` | A retry skipped what was already done: \`committed\`, \`commit\`, or \`upload\` with \`renders_present\` |`
- In the "One photo, every attempt" query's select list, add `properties.resume AS resume, properties.renders_present AS renders_present,` after `properties.outcome AS outcome,`.

- [ ] **Step 6: Commit**

```bash
pnpm format
git add apps/web/lib/telemetry.ts apps/web/components/event/guest-event-view.tsx CLAUDE.md .cursor/skills/ourfilm-upload/SKILL.md docs/upload-commit-observability.md
git commit -m "Report when a retry skips work already done, and record the rule" -m "Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_013zvecyHH5an4GNepuiLuah"
```

---

### Task 7: Verify end to end

**Files:** none

- [ ] **Step 1: The offline gate**

Run: `pnpm format && pnpm verify`
Expected: typecheck, lint, unit tests and build all pass.

- [ ] **Step 2: The database, locally**

Run: `pnpm supabase db reset && pnpm test:db && pnpm types:check:local`
Expected: all DB tests pass; types match the local schema.

- [ ] **Step 3: One real resume in the browser (local stack, `pnpm dev`)**

1. `pnpm seed` (set `SEED_HOST_EMAIL` if needed), then open the seeded event's `/e/<slug>` at 390px width in Chrome and join.
2. DevTools → Network → throttle "Slow 3G". Take a photo, and as soon as the `_view.jpg` and `_thumb.jpg` PUTs finish while the master's is still running, switch to "Offline".
3. Switch back online. In the Network panel, confirm that the retry's reserve action is followed by **one** PUT (`<photo>.jpg`) and a commit, with no `_view` or `_thumb` PUT.
4. Repeat, going offline right after the commit request is sent. When back online, confirm the retry sends no PUT and no commit, and the frame shows as confirmed.
5. `docker exec supabase_db_fomio psql -U postgres -c "select status, byte_size from public.photos order by created_at desc limit 2;"`. Both are `ready`, and `byte_size` equals the master's `metadata->>'size'`.

- [ ] **Step 4: Deploy note for the human**

Do not run this. Tell the user: the migration is safe to push before or after the web deploy (see Research → "Deploy order is safe either way"). After `pnpm supabase db push`, `pnpm types:check` against the linked project should match.
