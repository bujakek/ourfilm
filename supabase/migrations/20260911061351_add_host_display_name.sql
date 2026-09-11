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

-- `profiles.role` must never become self-editable. Restrict the table grant to
-- this one column before adding the row policy; RLS alone cannot distinguish
-- an innocent display-name patch from `role = ''admin''` in the same request.
revoke update on table public.profiles from authenticated;
grant update (display_name) on table public.profiles to authenticated;

create policy "users update own display name"
  on public.profiles for update to authenticated
  using (id = (select auth.uid()))
  with check (id = (select auth.uid()));

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
