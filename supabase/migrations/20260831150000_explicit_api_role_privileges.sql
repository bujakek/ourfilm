-- Make API privileges reproducible from migrations alone.
--
-- RLS decides which rows an API role may reach, but PostgreSQL table grants
-- are checked first. The hosted project already had the standard Supabase
-- grants; a clean `supabase db reset` did not inherit them for tables created
-- by these migrations. Keep the grants explicit so local CI and production
-- have the same authorization boundary.

grant usage on schema public to authenticated, service_role;

-- Hosts use the table API. RLS policies still scope every operation to the
-- owner (or to an admin) and deny operations for which no policy exists.
grant select, insert, update, delete on table
  public.events,
  public.photos,
  public.profiles,
  public.purchases
to authenticated;

grant select on table public.participants to authenticated;

-- Server Actions, Stripe webhooks, and test fixtures use the service role.
-- It is never shipped to a browser and deliberately bypasses RLS.
grant all privileges on table
  public.events,
  public.photos,
  public.participants,
  public.profiles,
  public.purchases,
  public.stripe_webhook_events,
  public.early_couple_applications,
  public.early_couple_rate_limits
to service_role;

grant usage on type
  public.app_role,
  public.purchase_status,
  public.reveal_mode,
  public.photo_status
to authenticated, service_role;
