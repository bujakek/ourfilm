-- Every host gets a language on record.
--
-- `20260924090000_profile_locale.sql` backfilled from each host's latest
-- event, which left accounts that never created one empty. Most of those
-- recorded a language when they signed up — the email sign-up stores the
-- page's language in user metadata — so that is used first. The rest default
-- to Hungarian, the pilot's language and `defaultLocale`.
--
-- The cost is deliberate: for a defaulted account the sign-in callback's
-- fill-if-unset no longer applies, so a later English sign-in stays Hungarian
-- until the host changes it on `/host/account`.

update public.profiles p
set locale = case
    when u.raw_user_meta_data->>'locale' in ('en', 'hu')
      then u.raw_user_meta_data->>'locale'
    else 'hu'
  end
from auth.users u
where u.id = p.id
  and p.locale is null;
