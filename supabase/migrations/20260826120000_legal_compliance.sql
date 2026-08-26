-- Legal and compliance surface for the disposable-camera pivot.
--
-- Four tables and two columns, and every one of them exists because a legal
-- page now makes a promise the product has to be able to keep:
--
--   * `legal_acceptances` — what the ÁSZF calls "az elfogadott ÁSZF-verzió
--     adatai". Evidence, so append-only for everyone who is not the service
--     role.
--   * `withdrawal_requests` — the 14-day elállás/felmondás intake. Recorded
--     the instant it arrives, because the ÁSZF promises a durable
--     confirmation, and never acted on automatically.
--   * `content_reports` — the jogsértő tartalom intake.
--   * `outbound_emails` — the durable record of both confirmations. Written
--     before delivery is attempted, so a mail provider being down is a
--     retryable row rather than a lost legal notice.
--
-- **Every one of these is service-role only.** RLS is enabled and no policy is
-- created at all, which in Postgres means `anon` and `authenticated` see and
-- write nothing. That is the correct blast radius: a withdrawal request holds
-- a consumer's name, order id and email, and a report holds a complainant's
-- identity that must never reach the person complained about. Nothing in the
-- product renders these to a browser.
--
-- Note the explicit `revoke ... from anon, authenticated`. Supabase grants
-- table privileges to those roles by default at the schema level, and RLS with
-- no policy is what actually stops the read — but revoking the grant as well
-- means a future permissive policy cannot silently open the table. Same
-- lesson as 20260825080000 on the capture RPCs.

-- ---------------------------------------------------------------------------
-- Acceptance evidence
-- ---------------------------------------------------------------------------

-- Which document was accepted or acknowledged.
--
-- `host_terms` and `early_performance` are *contractual*: the host actively
-- agrees. `guest_terms` is the guest acknowledgement before their first shot.
-- There is deliberately no `privacy_notice` value — a privacy notice is read,
-- not accepted, and recording an "acceptance" of one would misdescribe its
-- legal basis.
create type public.legal_document_kind as enum (
  'host_terms',
  'early_performance',
  'guest_terms'
);

create table public.legal_acceptances (
  id             uuid primary key default gen_random_uuid(),
  document       public.legal_document_kind not null,
  -- The version string from lib/legal/config.ts, e.g. '2026-08-26'. Stored as
  -- text rather than a date: it identifies a document revision, and the day it
  -- happens to be named after is not a fact anything computes with.
  legal_version  text not null,
  -- Set for a host acceptance. Null for a guest, who has no account by design.
  user_id        uuid references auth.users (id) on delete set null,
  -- `set null` rather than `cascade`, and this is the point of the table:
  -- deleting an event must not destroy the record that its terms were
  -- accepted. The two snapshots below are what keeps the row meaningful once
  -- the event is gone.
  event_id       uuid references public.events (id) on delete set null,
  participant_id uuid references public.participants (id) on delete set null,
  event_slug     text,
  subject_label  text,
  -- SHA-256 of the client address, salted per deployment. Kept as evidence of
  -- where a declaration came from without storing the address itself.
  ip_hash        text,
  user_agent     text,
  accepted_at    timestamptz not null default now()
);

create index legal_acceptances_participant_idx
  on public.legal_acceptances (participant_id, document, legal_version);
create index legal_acceptances_user_idx
  on public.legal_acceptances (user_id, document, legal_version);
create index legal_acceptances_event_idx on public.legal_acceptances (event_id);

alter table public.legal_acceptances enable row level security;
revoke all on public.legal_acceptances from anon, authenticated;

comment on table public.legal_acceptances is
  'Append-only evidence of contractual acceptance. Service role only: no policies exist, deliberately.';

-- ---------------------------------------------------------------------------
-- Withdrawal / termination declarations
-- ---------------------------------------------------------------------------

create type public.legal_request_status as enum (
  'received',
  'in_review',
  'more_info_requested',
  'accepted',
  'rejected'
);

create table public.withdrawal_requests (
  id              uuid primary key default gen_random_uuid(),
  -- What the confirmation email quotes back. Short, unguessable enough not to
  -- be enumerable, and readable over the phone.
  public_reference text not null unique,
  full_name       text not null,
  order_reference text not null,
  email           text not null,
  note            text,
  legal_version   text not null,
  status          public.legal_request_status not null default 'received',
  ip_hash         text,
  user_agent      text,
  submitted_at    timestamptz not null default now(),
  handled_at      timestamptz,
  -- Internal only. Never rendered to the person who submitted the request.
  handling_note   text
);

create index withdrawal_requests_rate_idx
  on public.withdrawal_requests (ip_hash, submitted_at desc);
create index withdrawal_requests_status_idx
  on public.withdrawal_requests (status, submitted_at desc);

alter table public.withdrawal_requests enable row level security;
revoke all on public.withdrawal_requests from anon, authenticated;

comment on table public.withdrawal_requests is
  'Elállási/felmondási nyilatkozatok. Recorded on arrival; refunds are never automatic.';

-- ---------------------------------------------------------------------------
-- Illegal content reports
-- ---------------------------------------------------------------------------

create type public.content_report_outcome as enum (
  'received',
  'more_info_requested',
  'no_action',
  'restricted',
  'removed',
  'event_restricted'
);

create table public.content_reports (
  id               uuid primary key default gen_random_uuid(),
  public_reference text not null unique,
  reporter_name    text not null,
  reporter_email   text not null,
  event_reference  text not null,
  content_reference text not null,
  reason           text not null,
  legal_basis      text not null,
  -- The good-faith declaration. Constrained true rather than merely stored:
  -- the form refuses without it, and a row that says otherwise would be a form
  -- bug rather than a report.
  good_faith       boolean not null default false,
  legal_version    text not null,
  outcome          public.content_report_outcome not null default 'received',
  ip_hash          text,
  user_agent       text,
  submitted_at     timestamptz not null default now(),
  handled_at       timestamptz,
  handling_note    text,
  constraint content_reports_good_faith_check check (good_faith)
);

create index content_reports_rate_idx
  on public.content_reports (ip_hash, submitted_at desc);
create index content_reports_outcome_idx
  on public.content_reports (outcome, submitted_at desc);

alter table public.content_reports enable row level security;
revoke all on public.content_reports from anon, authenticated;

comment on table public.content_reports is
  'Jogsértő tartalom bejelentések. Reporter identity is never exposed to the uploader or host.';

-- ---------------------------------------------------------------------------
-- Durable outbound mail
-- ---------------------------------------------------------------------------

-- Written before delivery is attempted, so a legal confirmation that could not
-- be sent is a row someone can retry rather than a promise silently broken.
-- This is not a queue with a worker: nothing polls it. It is the record, and
-- the send happens inline in the same request.
create table public.outbound_emails (
  id           uuid primary key default gen_random_uuid(),
  kind         text not null,
  to_email     text not null,
  subject      text not null,
  body         text not null,
  -- The withdrawal request or report this confirms, for an operator joining
  -- the two by hand.
  related_id   uuid,
  attempts     integer not null default 0,
  sent_at      timestamptz,
  last_error   text,
  provider_message_id text,
  created_at   timestamptz not null default now()
);

create index outbound_emails_pending_idx
  on public.outbound_emails (created_at desc) where sent_at is null;

alter table public.outbound_emails enable row level security;
revoke all on public.outbound_emails from anon, authenticated;

comment on table public.outbound_emails is
  'Durable record of every legal confirmation email. Service role only.';

-- ---------------------------------------------------------------------------
-- Retention on events
-- ---------------------------------------------------------------------------

alter table public.events
  -- Set once, by the retention run that sent the warning. The `is null` guard
  -- in that update is the whole idempotency mechanism: a job invoked twice, or
  -- two invocations overlapping, cannot warn the same host twice.
  add column retention_warned_at timestamptz,
  -- A legal hold suspends automatic deletion and says why. Separate from the
  -- retention dates on purpose: "we are keeping this because a lawyer asked"
  -- is not a retention period, and collapsing the two would make the reason
  -- disappear the moment the date passed.
  add column legal_hold_at timestamptz,
  add column legal_hold_reason text,
  add constraint events_legal_hold_check
    check ((legal_hold_at is null) = (legal_hold_reason is null));

comment on column public.events.retention_warned_at is
  'When the 30-day grace warning was sent. Null means not yet warned; set by the retention run under an is-null guard.';
comment on column public.events.legal_hold_at is
  'Suspends automatic deletion. Access is still restricted by the ordinary rules; only the purge is held.';

-- Events whose grace period has started but whose host has not been warned.
--
-- A function rather than a query in the caller because the predicate has to be
-- identical in the warning run and in the host-facing notice, and because the
-- date arithmetic is the part that is easy to get subtly wrong.
create or replace function public.events_awaiting_retention_warning(p_limit integer)
returns setof public.events
language sql
stable
security definer
set search_path = ''
as $$
  select e.*
  from public.events e
  where e.retention_warned_at is null
    and e.legal_hold_at is null
    and now() >= e.capture_end_at + interval '6 months'
  order by e.capture_end_at asc
  limit greatest(p_limit, 0)
$$;

-- Events past the grace period. Warned or not: an event nobody could be warned
-- about must still be deleted on time, and the warning is a courtesy the
-- retention promise does not depend on.
create or replace function public.events_due_for_deletion(p_limit integer)
returns setof public.events
language sql
stable
security definer
set search_path = ''
as $$
  select e.*
  from public.events e
  where e.legal_hold_at is null
    and now() >= e.capture_end_at + interval '6 months' + interval '30 days'
  order by e.capture_end_at asc
  limit greatest(p_limit, 0)
$$;

revoke all on function public.events_awaiting_retention_warning(integer) from public, anon, authenticated;
revoke all on function public.events_due_for_deletion(integer) from public, anon, authenticated;
grant execute on function public.events_awaiting_retention_warning(integer) to service_role;
grant execute on function public.events_due_for_deletion(integer) to service_role;
