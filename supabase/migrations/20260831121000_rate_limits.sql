-- Distributed fixed-window limits for public/server-action write surfaces.
-- There are no client policies: only trusted server code may consume a slot.
create table public.rate_limits (
  key text primary key,
  window_started_at timestamptz not null,
  request_count integer not null check (request_count > 0),
  updated_at timestamptz not null default now()
);

alter table public.rate_limits enable row level security;
revoke all on table public.rate_limits from public, anon, authenticated;

create function public.consume_rate_limit(
  p_key text, p_limit integer, p_window_seconds integer
) returns boolean
language plpgsql security definer set search_path = '' as $$
declare
  allowed boolean;
begin
  if p_limit < 1 or p_window_seconds < 1 or length(p_key) > 200 then
    return false;
  end if;

  insert into public.rate_limits as limits
    (key, window_started_at, request_count, updated_at)
  values (p_key, now(), 1, now())
  on conflict (key) do update set
    window_started_at = case
      when limits.window_started_at <= now() - make_interval(secs => p_window_seconds)
      then now() else limits.window_started_at end,
    request_count = case
      when limits.window_started_at <= now() - make_interval(secs => p_window_seconds)
      then 1 else limits.request_count + 1 end,
    updated_at = now()
  returning request_count <= p_limit into allowed;

  return allowed;
end;
$$;

revoke all on function public.consume_rate_limit(text, integer, integer) from public, anon, authenticated;
grant execute on function public.consume_rate_limit(text, integer, integer) to service_role;

create function public.event_ready_photo_bytes(p_event_id uuid)
returns bigint language sql stable security definer set search_path = '' as $$
  select coalesce(sum(byte_size), 0)::bigint from public.photos
  where event_id = p_event_id and status = 'ready'
$$;

revoke all on function public.event_ready_photo_bytes(uuid) from public, anon, authenticated;
grant execute on function public.event_ready_photo_bytes(uuid) to service_role;

