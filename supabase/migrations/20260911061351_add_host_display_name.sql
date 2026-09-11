-- A host-visible name, separate from the email used to sign in.
--
-- Host capture already represents the account as one participant per event,
-- and every photo credit is read from that participant row. Keeping the
-- canonical name on `profiles` lets the account screen own the setting; the
-- trigger below copies a change to every existing host participant so earlier
-- photos change credit too. The participant row remains the snapshot the
-- guest-facing photo queries already know how to read.

alter table public.profiles
  add column display_name text;

alter table public.profiles
  add constraint profiles_display_name_valid
  check (
    display_name is null
    or (
      display_name = btrim(display_name)
      and char_length(display_name) between 2 and 40
    )
  );

comment on column public.profiles.display_name is
  'The host name shown on photos they upload. Null falls back to the local part of the account email until the host chooses a name.';

-- ---------------------------------------------------------------------------
-- set_host_display_name()
-- ---------------------------------------------------------------------------

-- The write goes through a function, and `profiles` keeps no self-update
-- policy at all. That sentence is the whole design, and it is worth saying why
-- the obvious alternative was rejected.
--
-- A self-update policy — `using (id = auth.uid())` — is what a display name
-- appears to need, and it is not safe on this table. **RLS is a row filter,
-- not a column filter.** It answers "may this user touch this row" and has no
-- opinion about which columns the statement sets, so
-- `PATCH /profiles?id=eq.<self> {"role":"admin"}` satisfies both `using` and
-- `with check` — it really is that user's own row. Self-promotion, one request
-- away for anyone holding a session and the anon key that ships in every
-- browser bundle. Nor can the policy be written to forbid it: `using` sees the
-- old row and `with check` the new one, with no way to correlate them, so
-- there is no `new.role = old.role` to express. Pinning `with check
-- (role = 'user')` would refuse an admin their own display name.
--
-- Narrowing the table grant to this one column also works, and was the first
-- attempt. It is rejected here for being wider than it looks: `revoke update
-- on profiles from authenticated` is role-wide, so it would also take away an
-- admin's session-level write and leave the `admins manage profiles` policy
-- describing something it no longer delivers.
--
-- A definer function has neither problem. `profiles` is untouched — no new
-- policy, no grant surgery, `role` exactly as unwritable as it was — and this
-- is how every other privileged write in the schema already works
-- (`join_event`, `reserve_shot`, `host_participant`, `grant_event_plan`).
--
-- It takes no user id. The row it writes is `auth.uid()` and can be no other,
-- so "update someone else's name" is not a request this API can express.
create function public.set_host_display_name(p_name text)
returns text
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_user uuid := (select auth.uid());
  v_name text := btrim(coalesce(p_name, ''));
begin
  if v_user is null then
    raise exception 'Nincs bejelentkezett felhasználó.'
      using errcode = 'insufficient_privilege';
  end if;

  -- The same 2–40 range as `profiles_display_name_valid`, checked here so the
  -- caller gets a sentence instead of a constraint name.
  if char_length(v_name) < 2 or char_length(v_name) > 40 then
    raise exception 'A név 2–40 karakter hosszú lehet.'
      using errcode = 'check_violation';
  end if;

  update public.profiles
  set display_name = v_name
  where id = v_user;

  return v_name;
end;
$$;

-- `revoke all … from public` does not remove Supabase's own grants: it grants
-- execute to `anon` and `authenticated` directly, so both have to be named.
-- `authenticated` is then granted back deliberately — unlike the guest capture
-- RPCs, this one is called by the signed-in host's own session.
revoke all on function public.set_host_display_name(text)
  from public, anon, authenticated;
grant execute on function public.set_host_display_name(text) to authenticated;

-- ---------------------------------------------------------------------------
-- Credit already-taken photos
-- ---------------------------------------------------------------------------

-- A photo's credit is read from its participant row, so changing the profile
-- has to reach the rows that already exist. Written as a trigger rather than
-- inside the function above because it must also hold for a name set by an
-- admin or by the service role.
create function public.sync_host_participant_display_name()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.display_name is distinct from old.display_name
     and new.display_name is not null then
    update public.participants
    set display_name = new.display_name
    where user_id = new.id;
  end if;

  return new;
end;
$$;

revoke all on function public.sync_host_participant_display_name()
  from public, anon, authenticated;

create trigger on_host_display_name_changed
  after update of display_name on public.profiles
  for each row execute function public.sync_host_participant_display_name();
