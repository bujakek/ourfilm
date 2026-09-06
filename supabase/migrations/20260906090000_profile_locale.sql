-- The host's own language, so it survives a bookmark.
--
-- `/host`, `/host/login` and `/auth` sit outside the locale tree and read
-- their language from `?lang`. Every link inside the product sets it, which
-- works right up until something does not: a bookmark, a hand-typed URL, an
-- email client that dropped the query. `resolveLocale()` then falls back to
-- `defaultLocale`, so an English host reaching a bare `/host` got a Hungarian
-- dashboard. Threading the parameter through one more redirect has been the
-- fix twice now (see the note on `redirectWithin` in proxy.ts); the real
-- problem is that the preference had nowhere durable to live.
--
-- It is deliberately NOT the same value as `events.locale`. That one is the
-- language the *guests* read, and it also selects the Stripe Price — so a
-- Hungarian host running an English-language wedding must be able to hold a
-- Hungarian dashboard and an English camera billed in forint. This column is
-- the default that column starts from, never a binding.

-- ---------------------------------------------------------------------------
-- The column
-- ---------------------------------------------------------------------------

alter table public.profiles add column locale text;

-- Every account that exists today signed up on the Hungarian site — English
-- went live after them — so this is the language they have been reading, not
-- merely a safe default.
update public.profiles set locale = 'hu';

alter table public.profiles alter column locale set default 'hu';
alter table public.profiles alter column locale set not null;

-- Same two values `events.locale` is constrained to. Kept as a check
-- constraint rather than an enum for the same reason that column is: adding a
-- locale should be one migration, not a type change with a cast.
alter table public.profiles
  add constraint profiles_locale_check check (locale in ('en', 'hu'));

comment on column public.profiles.locale is
  'The language the host reads the product in. Seeded from the signup locale by handle_new_user; changed only through set_profile_locale.';

-- ---------------------------------------------------------------------------
-- Seed it at signup
-- ---------------------------------------------------------------------------

-- `sendSignInLink` already writes `data: { locale }` into user metadata on
-- every magic link, so the language someone signed up in is known here and
-- needs no application code to capture — exactly how `role` is handled.
--
-- `coalesce` to the column default rather than assuming metadata is present:
-- a user created through the Supabase dashboard or the admin API carries no
-- metadata at all, and a null would fail the not-null constraint and take the
-- whole signup down with it.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  -- `on conflict do nothing` because the backfill above and this trigger can
  -- both be true for a user created while the migration is running.
  insert into public.profiles (id, locale)
  values (
    new.id,
    case
      when new.raw_user_meta_data ->> 'locale' in ('en', 'hu')
        then new.raw_user_meta_data ->> 'locale'
      else 'hu'
    end
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- Changing it
-- ---------------------------------------------------------------------------

-- **This has to be a function, and the reason is worth stating.**
--
-- `profiles` deliberately has no self-update policy: a host may read their
-- role and may not write it. What makes that more than a convention is that
-- 20260831150000 grants `authenticated` a blanket UPDATE on this table — every
-- column, including `role`. The policy is the only thing standing in the way.
-- So adding "users update own profile" to let someone switch language would
-- also make `role = 'admin'` one PATCH away for anyone holding the anon key
-- and a session, which is everyone.
--
-- A security definer function that writes one named column cannot be talked
-- into writing another. `auth.uid()` is read inside rather than accepted as an
-- argument, so it cannot be pointed at somebody else's row either.
create or replace function public.set_profile_locale(p_locale text)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
begin
  if v_uid is null then
    raise exception 'not authenticated' using errcode = '28000';
  end if;

  if p_locale is null or p_locale not in ('en', 'hu') then
    raise exception 'unsupported locale: %', p_locale using errcode = '22023';
  end if;

  update public.profiles
     set locale = p_locale
   where id = v_uid;

  return p_locale;
end;
$$;

-- Supabase grants execute to anon and authenticated *directly*, so
-- `revoke ... from public` alone leaves the function callable with the anon
-- key that ships in the browser bundle. Revoke by name — the lesson of
-- 20260825080000.
revoke all on function public.set_profile_locale(text) from public, anon, authenticated;
grant execute on function public.set_profile_locale(text) to authenticated;
