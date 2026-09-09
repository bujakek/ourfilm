# Export worker

Turns a large album into a ZIP. Polls the web app for a job, builds the archive
on its own disk from the public masters, uploads it to the private
`event-exports` bucket over a resumable (TUS) upload, and tells the web app it
is done. Phase 2 of `docs/public-cdn-and-export-worker.md`.

It holds **one secret** — the token that authenticates it to
`/api/exports/*` — and no Supabase key. The photo URLs it reads are public
objects; the upload it writes is authorised by a signed token the web app mints
per job; the database it never sees.

## Environment

```bash
OURFILM_API_URL=                # https://ourfilm.app
EXPORT_WORKER_SECRET=           # the same value Vercel holds
VERCEL_PROTECTION_BYPASS=       # only when OURFILM_API_URL is a preview deployment
EXPORT_TMP_DIR=                 # default: <os tmpdir>/ourfilm-exports
EXPORT_DISK_FLOOR_BYTES=        # default 2 GiB; no job is claimed with less free
EXPORT_POLL_SECONDS=            # default 60
EXPORT_IDLE_BACKOFF_SECONDS=    # default 300, after an hour without work
EXPORT_FETCH_CONCURRENCY=       # default 8 masters in flight while building
```

## Run

```bash
pnpm --filter worker start      # the loop
pnpm --filter worker test       # unit tests: archive assembly, disk floor
pnpm --filter worker typecheck
pnpm --filter worker probe:tus  # the upload experiment, against a local stack
```

## Railway

- Root Directory `.` (the repository root), Dockerfile Path
  `apps/worker/Dockerfile` — the image installs the workspace and copies
  `packages/shared`, so the build context must be the root.
- Watch paths `apps/worker/**` and `packages/shared/**`, so web-only pushes do
  not rebuild it.
- Region `europe-west4` (Amsterdam), closest to Supabase `eu-central-2`.
- No public domain; the worker makes outbound calls only.
- A plan with ephemeral disk for one wedding ZIP plus the floor. Confirm the
  size on the plan in use and set `EXPORT_DISK_FLOOR_BYTES` from it.
- On deploy Railway sends `SIGTERM`; the worker finishes the job in hand and
  claims no more.
