-- Accounts are identified by username rather than email.
--
-- Supabase Auth still needs an email to hang a password off, so the app signs
-- each user up as <username>@kanjikan.internal (see lib/username.ts). Nothing
-- in the schema changes: auth.users.email is the username, and the profile
-- trigger in 0001 already derives display_name from it.
--
-- The login form has to tell a wrong password apart from a username nobody
-- has taken: the first is an error, the second offers to create the account.
-- signInWithPassword deliberately answers both the same way, and auth.users is
-- not readable with the anon key, so this function answers that one question
-- and nothing more. It only ever matches the username domain, so it cannot be
-- used to probe for arbitrary email addresses.

create or replace function public.username_exists(p_username text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from auth.users
    where email = lower(p_username) || '@kanjikan.internal'
  );
$$;

revoke all on function public.username_exists(text) from public;
grant execute on function public.username_exists(text) to anon, authenticated;
