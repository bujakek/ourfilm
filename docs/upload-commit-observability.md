# Upload → commit: how a photo ends up `pending`, and how to find out which way

A capture is `reserve_shot` → three PUTs to signed URLs → `commit_shot`. A
`photos` row that is still `pending` with all three objects in Storage stopped
between the second and the third step. This document maps every way the code
can end up there, names the telemetry that tells the ways apart, and gives the
queries to read one photo's history.

It is deliberately about **what the code does**, not about any one incident. A
cause for a specific photo is only established by the reports and rows below.

## Every path to a `pending` row with its files present

Read from `apps/web/lib/upload-queue.ts`, `apps/web/lib/upload-shot.ts`,
`apps/web/lib/commit-observed.ts`, `apps/web/lib/capture.ts` and the SQL in
`supabase/migrations/20260824174542_disposable_camera_rpcs.sql` (`commit_shot`,
`release_shot`) and `20260905003000_…` (`reserve_shot`).

`commit_shot` sets `status`, `width`, `height`, `byte_size` and `taken_at` in
one `update`. A row whose four metadata columns are null has never been
committed; nothing in the schema moves a row back to `pending`.

### A. The commit was never sent

The queue runs one attempt at a time. After the three PUTs resolve, the next
statement sends the commit; between them only a `stopped` check.

1. **The page stopped running.** iOS freezes a hidden tab and may reclaim it;
   a reload, a closed tab or a crash ends the JavaScript. The IndexedDB row
   survives, and the shot is replayed only when this page is opened again on
   the same device within `MAX_AGE_MS` (24 h).
2. **A teardown.** `stop()` runs on unmount. A stop after the PUTs and before
   the commit throws `AbortError`, the attempt is refunded and the row stays in
   IndexedDB. Before this change `notify` was silent after `stop()`, so this
   left no report.
3. **The replay never came.** On resume, a stored row older than 24 h or with
   four spent attempts is discarded (`discardReason`) **without** calling
   `release_shot` — so a reservation whose files had landed in an earlier
   attempt stays `pending` for ever.

### B. The commit was sent and did not reach `commit_shot`

4. **No participant cookie** (`no_session`). `readParticipantTokenHash()` is
   empty; the action answers `committed: false` without calling the RPC.
   Before this change: no server report of any kind.
5. **Host not identified** (`not_owner`, `no_participant`), host camera only.
6. **The request never arrived or its answer was lost.** The browser's 20 s
   commit timeout, or a network failure. `isConnectionFailure` refunds the
   attempt and the whole capture is retried. A request that arrived after the
   browser gave up may still commit.

### C. `commit_shot` ran and did not commit

7. **`not_matched`.** No photo with that id whose participant holds the
   presented token hash — the cookie belongs to another participant row (for
   instance a re-join minted a new token), or the photo id is wrong.
8. **`empty_response`.** PostgREST returned no row. The function always
   returns one, so this is not expected.
9. **The RPC threw.** A `server_error` with operation `commit_shot`.

For 4, 7 and 8 the queue throws `commit refused` and spends an attempt. After
four server-answered failures the photo is dropped and `release_shot` is
called — which deletes the row only when the token hash matches it. Under 4 the
release action returns before calling anything, and under 7 the delete matches
nothing, so **the row stays `pending` with its files**.

### D. The upload looked failed to the browser

10. All three objects landed but a PUT reported an error (a lost response, the
    120 s upload timeout). The whole capture is retried; `upsert: true`
    re-uploads the same paths. If it never succeeds, it ends as A3 or as a
    terminal drop.

## What reports each step

The browser events are sent **urgently** (`send_instantly`) because the ending
that matters is a tab that dies a second later. They are still best effort: a
frozen or reclaimed tab sends nothing, and PostHog loads on idle, so events
before it attaches wait in memory.

| Event (browser)              | Step                                                                          |
| ---------------------------- | ----------------------------------------------------------------------------- |
| `shutter_pressed`            | Capture id minted                                                             |
| `upload_renders_uploaded`    | All three PUTs answered without an error. `upload_ms`, `bytes`                |
| `upload_commit_started`      | The commit request is being sent                                              |
| `upload_commit_finished`     | Its answer: `committed`, `refused` + server `refusal`, or `failed` + `unsent` |
| `upload_attempt_interrupted` | `stop()` ended the attempt, with the `stage` it was in                        |
| `upload_backgrounded`        | The page was hidden (`visibilitychange`) or unloaded (`pagehide`) mid-attempt |
| `upload_issue`               | Existing; now with `attempt_id` when raised inside an attempt                 |
| `upload_confirmed`           | Existing, batched                                                             |
| `upload_restored`            | Existing, batched: a stored shot replayed after a reload                      |

| Event (server)         | Step                                                                                  |
| ---------------------- | ------------------------------------------------------------------------------------- |
| `commit_shot_received` | The action was invoked. Browser-claimed ids only                                      |
| `commit_shot_finished` | `committed` / `refused` + `reason` / `error` + `error_name`; `row` and `status_after` |
| `server_error`         | Existing, operation `commit_shot` or `commit_shot_identify`, now with `event_id`      |

**Joining.** Every attempt — one run of the queue's capture loop — mints an
`attempt_id`, reported by the browser and sent to the commit action. `attempt`
is the budget count, which a refund repeats, so two retries can share a number
but never an id. `capture_id` is the shot's own id and `photos.idempotency_key`.

**Server ids come from the row.** `commit_shot_finished.event_id` and
`capture_id` are read back from `photos` after the commit (or, for a host, the
event their session owns); the browser's claim is `claimed_capture_id`, and
`capture_id_matches` compares the two. `row` is `owned` when the row's
participant holds the caller's token, `foreign` when it exists but does not,
`missing`, or `unknown` when the read-back failed.

**Never the photo id.** The bucket is public and a photo's address is
`{event_id}/{photo_id}.jpg`, so the two uuids together are a link to the
picture. Server events carry `photo_ref`, the SHA-256 of the id:

```bash
printf %s b359f2dd-9a07-4653-8c3b-78c5e2cfdce5 | shasum -a 256
```

**Delivery.** Server events start immediately and are held open with Next's
`after()` (Vercel `waitUntil`), never awaited on the way to the answer.
`posthog-node`'s defaults — 10 s request timeout, 3 retries 3 s apart — can
otherwise hold a response for most of a minute, past the browser's 20 s commit
timeout. `after()` also runs when the action throws. It does not run if the
invocation is killed at its max duration.

**Clocks.** Browser timestamps come from the phone's clock; server events and
`photos.created_at` come from server clocks. Compare durations within one side
(`upload_ms`, `commit_ms`, `duration_ms`) rather than across them.

## Queries

### One photo, every attempt, in order (PostHog SQL)

Fill in the capture id (`photos.idempotency_key`), the photo ref and the event
id. The last clause picks up `server_error`, which carries no capture.

```sql
SELECT
  timestamp,
  event,
  properties.attempt_id AS attempt_id,
  properties.attempt AS attempt,
  properties.surface AS server_surface,
  properties.stage AS stage,
  properties.outcome AS outcome,
  coalesce(properties.reason, properties.refusal, properties.failure) AS why,
  properties.error_name AS error_name,
  properties.unsent AS unsent,
  properties.row AS row,
  properties.status_after AS status_after,
  properties.capture_id_matches AS capture_matches,
  properties.upload_ms AS upload_ms,
  properties.commit_ms AS client_commit_ms,
  properties.duration_ms AS server_ms,
  properties.terminal AS terminal,
  properties.via AS via,
  properties.online AS online,
  properties.visible AS visible,
  properties.environment AS environment
FROM events
WHERE timestamp >= toDateTime('2026-09-12 18:00:00')
  AND timestamp < toDateTime('2026-09-14 00:00:00')
  AND (
    properties.capture_id = '677f29bf-23bd-427e-a8b2-a9ceb7f01857'
    OR properties.claimed_capture_id = '677f29bf-23bd-427e-a8b2-a9ceb7f01857'
    OR properties.photo_ref = '<sha-256 of the photo id>'
    OR (
      event = 'server_error'
      AND properties.operation IN ('reserve_shot', 'commit_shot', 'commit_shot_identify')
      AND properties.event_id = 'f930e8f1-3294-4e0a-9855-9d94e5628cb0'
    )
  )
ORDER BY timestamp ASC
```

### One row per attempt

Where each attempt got to. A row with `uploaded = 1` and `commit_sent = 0` is
path A; `commit_sent = 1` with `server_received = 0` is a request that never
arrived (or whose report was lost); a `server_outcome` other than `committed`
names path B or C.

```sql
SELECT
  properties.attempt_id AS attempt_id,
  min(timestamp) AS first_seen,
  max(timestamp) AS last_seen,
  countIf(event = 'upload_renders_uploaded') AS uploaded,
  countIf(event = 'upload_commit_started') AS commit_sent,
  countIf(event = 'commit_shot_received') AS server_received,
  argMaxIf(properties.outcome, timestamp, event = 'commit_shot_finished') AS server_outcome,
  argMaxIf(properties.reason, timestamp, event = 'commit_shot_finished') AS server_reason,
  argMaxIf(properties.status_after, timestamp, event = 'commit_shot_finished') AS status_after,
  argMaxIf(properties.outcome, timestamp, event = 'upload_commit_finished') AS client_outcome,
  argMaxIf(properties.failure, timestamp, event = 'upload_commit_finished') AS client_failure,
  countIf(event = 'upload_attempt_interrupted') AS interrupted,
  countIf(event = 'upload_backgrounded') AS backgrounded
FROM events
WHERE timestamp >= toDateTime('2026-09-12 18:00:00')
  AND timestamp < toDateTime('2026-09-14 00:00:00')
  AND properties.attempt_id IS NOT NULL
  AND (
    properties.capture_id = '677f29bf-23bd-427e-a8b2-a9ceb7f01857'
    OR properties.claimed_capture_id = '677f29bf-23bd-427e-a8b2-a9ceb7f01857'
  )
GROUP BY attempt_id
ORDER BY first_seen ASC
```

### The database side (read-only)

Run against production only as reads. The storage timestamps are the server's
own record of when each render landed, and whether it was written more than
once.

```sql
select id, status, created_at, width, height, byte_size, taken_at,
       hidden_at, deleted_at, participant_id, idempotency_key
from public.photos
where id = 'b359f2dd-9a07-4653-8c3b-78c5e2cfdce5';

select name, created_at, updated_at, metadata->>'size' as size
from storage.objects
where bucket_id = 'event-photos'
  and name like 'f930e8f1-3294-4e0a-9855-9d94e5628cb0/b359f2dd-9a07-4653-8c3b-78c5e2cfdce5%'
order by name;

-- Did this participant go on shooting, and did those commit? The queue drains
-- in capture order, so a later shot committed from the same device means this
-- one was dropped or its page instance stopped.
select p.id, p.status, p.created_at, p.taken_at
from public.photos p
where p.participant_id = (
  select participant_id from public.photos
  where id = 'b359f2dd-9a07-4653-8c3b-78c5e2cfdce5'
)
order by p.created_at;
```
