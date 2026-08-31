-- Early Couple Program applications.
--
-- This is a founder-led validation channel, not a public CRM. Applicants do
-- not need an OurFilm account, and neither the anon key nor an ordinary host
-- session may read or write the pipeline. The Server Action is the only write
-- path and uses the service role after validating and rate-limiting the form.

create table public.early_couple_applications (
  id                    uuid primary key default gen_random_uuid(),
  name                  text not null check (char_length(name) between 2 and 120),
  partner_name          text check (partner_name is null or char_length(partner_name) between 2 and 120),
  email                 text not null unique check (
                          email = lower(email)
                          and char_length(email) between 3 and 320
                        ),
  wedding_date          date not null,
  wedding_location      text not null check (char_length(wedding_location) between 2 and 160),
  guest_count_range     text not null check (
                          guest_count_range in ('1-50', '51-100', '101-150', '151-200', '200+')
                        ),
  why_interested        text not null check (char_length(why_interested) between 10 and 2000),
  locale                text not null check (locale in ('en', 'hu')),
  status                text not null default 'new' check (
                          status in ('new', 'contacted', 'accepted', 'rejected', 'completed', 'withdrawn')
                        ),
  first_call_status     text not null default 'not_scheduled' check (
                          first_call_status in ('not_scheduled', 'scheduled', 'completed', 'cancelled')
                        ),
  first_call_at         timestamptz,
  second_call_status    text not null default 'not_scheduled' check (
                          second_call_status in ('not_scheduled', 'scheduled', 'completed', 'cancelled')
                        ),
  second_call_at        timestamptz,
  user_id               uuid references auth.users (id) on delete set null,
  event_id              uuid references public.events (id) on delete set null,
  founder_notes         text,
  utm_source            text,
  utm_medium            text,
  utm_campaign          text,
  utm_content           text,
  utm_term              text,
  referrer              text,
  agreement_accepted_at timestamptz not null default now(),
  retention_until       date not null default (current_date + 365),
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now()
);

create index early_couple_applications_status_idx
  on public.early_couple_applications (status, created_at desc);
create index early_couple_applications_wedding_date_idx
  on public.early_couple_applications (wedding_date);

create or replace function public.touch_early_couple_application_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger early_couple_application_updated_at
  before update on public.early_couple_applications
  for each row execute function public.touch_early_couple_application_updated_at();

revoke all on function public.touch_early_couple_application_updated_at()
  from public, anon, authenticated;

alter table public.early_couple_applications enable row level security;

-- Table Editor and the service role remain available. A browser key gets
-- nothing, even when it carries a signed-in host session. There are no RLS
-- policies to accidentally widen later.
revoke all on public.early_couple_applications from anon, authenticated;

-- A small, database-backed fixed window. Vercel functions are ephemeral, so
-- an in-memory counter would reset on every cold start and provide no limit at
-- all. The application stores only an HMAC of the network address; the raw
-- address never lands in Postgres.
create table public.early_couple_rate_limits (
  key_hash             text primary key check (key_hash ~ '^[0-9a-f]{64}$'),
  window_started_at    timestamptz not null default now(),
  submission_count     smallint not null default 1 check (submission_count > 0)
);

alter table public.early_couple_rate_limits enable row level security;
revoke all on public.early_couple_rate_limits from anon, authenticated;

create or replace function public.consume_early_couple_rate_limit(p_key_hash text)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_count smallint;
begin
  if p_key_hash is null or p_key_hash !~ '^[0-9a-f]{64}$' then
    return false;
  end if;

  -- Best-effort minimisation without depending on pg_cron. Active traffic
  -- clears expired pseudonymous keys; no application row contains this key.
  delete from public.early_couple_rate_limits
  where window_started_at < now() - interval '30 days';

  insert into public.early_couple_rate_limits (
    key_hash,
    window_started_at,
    submission_count
  )
  values (p_key_hash, now(), 1)
  on conflict (key_hash) do update
  set
    window_started_at = case
      when public.early_couple_rate_limits.window_started_at < now() - interval '15 minutes'
        then now()
      else public.early_couple_rate_limits.window_started_at
    end,
    submission_count = case
      when public.early_couple_rate_limits.window_started_at < now() - interval '15 minutes'
        then 1
      else least(public.early_couple_rate_limits.submission_count + 1, 6)
    end
  returning submission_count into v_count;

  return v_count <= 5;
end;
$$;

-- Supabase grants functions directly to API roles by default. Revoke those
-- roles by name; `from public` alone would leave the RPC callable.
revoke all on function public.consume_early_couple_rate_limit(text)
  from public, anon, authenticated;
grant execute on function public.consume_early_couple_rate_limit(text)
  to service_role;
