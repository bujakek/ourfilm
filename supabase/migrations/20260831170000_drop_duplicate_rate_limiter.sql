-- One rate limiter, not two.
--
-- `early_couple_rate_limits` and `consume_early_couple_rate_limit` were a
-- second fixed-window implementation of `public.consume_rate_limit`, shipped
-- 75 minutes after it. The Early Couple action now calls the generic limiter
-- with scope 'early-couple', so the bespoke pair has no caller left.
drop function if exists public.consume_early_couple_rate_limit(text);
drop table if exists public.early_couple_rate_limits;

-- The generic limiter never reclaimed anything: one row per
-- (scope, hashed identifier), kept forever. The function this replaces swept
-- on write rather than depending on pg_cron, and that is worth keeping —
-- every window here is an hour at most, so a row untouched for a day is dead
-- by definition.
create or replace function public.consume_rate_limit(
  p_key text, p_limit integer, p_window_seconds integer
) returns boolean
language plpgsql security definer set search_path = '' as $$
declare
  allowed boolean;
begin
  if p_limit < 1 or p_window_seconds < 1 or length(p_key) > 200 then
    return false;
  end if;

  delete from public.rate_limits where updated_at < now() - interval '1 day';

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

-- `create or replace` preserves the existing ACL, but state these anyway: the
-- default grants to anon/authenticated are what 20260825080000 exists to undo.
revoke all on function public.consume_rate_limit(text, integer, integer)
  from public, anon, authenticated;
grant execute on function public.consume_rate_limit(text, integer, integer)
  to service_role;
