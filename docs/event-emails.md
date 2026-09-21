# Host event emails

Three transactional messages use the shared OurFilm email layout and the event's
stored English or Hungarian locale:

- **Camera created:** queued in the same transaction as the new event and sent
  by the next five-minute sweep (subject to queue volume and retries). Confirms
  creation, separates the host management destination from the shareable guest
  link, shows the capture deadline and reveal settings in the event's timezone,
  and explains where to download the printable QR code. Private galleries get
  their own wording. The first send reads current settings; retries retain the
  exact original body. Existing events are not backfilled.
- **Upcoming:** 10:00, two calendar days before the local `capture_end_at` date.
  Reminds the host to print QR codes and share the localized guest link. The
  button opens the host event page, where the QR button offers a printable PNG.
  Three short tips suggest visible QR placement, a spoken introduction and
  taking the first photo as the host. There is no separate tutorial email.
- **After the event:** 09:00 the calendar day after the local end date. Thanks
  the host and reports the number of ready, non-deleted photos received so far,
  including the host's own photos and hidden photos still in their album.
  Zero photos gets its own copy. The email explains that offline uploads may
  still arrive and respects the configured reveal time; it contains no photos
  or storage URLs.

Both times use `events.time_zone`, including daylight-saving changes. The end
date anchors the reminder because events have no separately scheduled start:
their camera opens at creation. An event ending at 02:00 on Sunday gets its
follow-up on Monday at 09:00.

## Deployment

1. Deploy the app with `/api/event-emails/sweep`.
2. Apply `20260921061638_event_emails.sql` and
   `20260921105709_event_created_email.sql` through the normal migration process.
3. Production needs `RESEND_API_KEY`, `EXPORT_WORKER_SECRET`, and optionally
   `AUTH_EMAIL_FROM` (the existing email sender). Set `OURFILM_EVENT_EMAILS=true`
   in Production to enable delivery. Keep it unset in previews and development.
4. The migration schedules `event-emails-sweep-http` every five minutes using
   the existing Vault entries `ourfilm_api_url` and `export_worker_secret`.
   The URL must point at Production, and the Vault secret must match the app's
   `EXPORT_WORKER_SECRET`. Without these entries the job does nothing.

No customer email is sent by migrations or tests. The local test stack has no
Vault destination. Setting `OURFILM_EVENT_EMAILS=false` pauses sends immediately
after deployment without changing other scheduled jobs.

## Delivery behavior

Each event gets one creation confirmation and at most one reminder/follow-up
per schedule. An indexed private outbox and
an atomic five-minute claim prevent concurrent sends. The full provider body
is saved before sending and reused with the same Resend idempotency key, even
if photos arrive or code changes between attempts. Provider calls time out
after ten seconds. Successful delivery is recorded only after provider success;
database failures retry the same body and key.

The sweep handles three emails per invocation. Initial reminder/follow-up delivery is eligible for
12 hours after the scheduled time, so enabling the feature does not mail old
events. Events created after their reminder time do not receive that reminder.
Retries stop after 12 claims or 23 hours from queue creation, staying inside
[Resend's 24-hour deduplication window](https://resend.com/docs/dashboard/emails/idempotency-keys).
Exhausted rows remain unsent for investigation; do not automatically replay
them with a fresh key because a timed-out request may have delivered.

Changing an event's date or timezone changes its schedule, before or after
queueing. A queued reminder/follow-up for the abandoned schedule is suppressed and never
sent; the new schedule is queued in its own right when its time comes, so a
host who postpones still gets a reminder two days before the date they moved
to. The outbox is keyed on `(event_id, kind, scheduled_at)` for exactly this
reason — keyed on the kind alone, a reminder sent for a since-abandoned date
was the only one that event would ever get, and moving the end forwards is
how a host reopens a closed camera. Rows for abandoned schedules stay as
history: what a host was told is on the record.

The 12-hour eligibility window is the only bound on how often a rescheduling
host can be mailed. Moving a date later never sends immediately — the new
reminder time is in the future — so in practice this costs one extra message
to a host who genuinely postponed. Deleting the event cascades its outbox
rows. Recipient changes suppress an already queued message. The row stores the
recipient and email body, is inaccessible to both anon and signed-in hosts,
and goes away when the event is deleted.

Creation confirmations are queued only by an event-insert trigger, so replaying
an idempotent creation request or editing an event never queues another one.
They are eligible while the camera remains open and the outbox retry window is
valid, even if the host changes the end date before the first send. Paused
delivery does not prevent queueing; enabling it can send confirmations queued
within the last 23 hours, but never older ones.

The endpoint returns send/failure counts, reports failures under
`event_email_delivery` / `event_email_sweep`, and reports every authorized run
as an `event_email_sweep` event. pg_cron never reads the response, so that
event is the only sign the schedule is alive: no run for an hour is the alert,
and a run carrying `skipped` is a schedule paused by `OURFILM_EVENT_EMAILS`
rather than a dead one. Inspect `event_emails` for unsent rows with 12
attempts or an age of 23 hours. Scheduling uses the same
[Supabase Cron HTTP pattern](https://supabase.com/docs/guides/cron/quickstart)
as invoice and export sweeps.

## Verification

`pnpm verify` checks rendering and mocked delivery without sending email.
`pnpm test:db` verifies timezone boundaries, concurrent claims, retry limits,
rescheduling in both directions — the abandoned schedule suppressed, the new
one reissued — photo counts and service-role-only access on local Supabase.
