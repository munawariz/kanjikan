-- Accounts without email.
--
-- Until now each username was a Supabase Auth user signed up as
-- <username>@kanjikan.internal. Supabase Auth rejects addresses on reserved
-- domains like .internal, so no new account could ever be opened, and it has
-- no way to do password sign-in without an email or a phone number at all.
--
-- So accounts leave Supabase Auth. They are a username and a password hash in
-- public.accounts, signed in through public.sessions, and nothing anywhere
-- holds an email address. The app connects to Postgres directly and runs each
-- query as the signed-in account (role authenticated, auth.uid() = the account
-- id), so every row level security policy below keeps working unchanged.

create table if not exists public.accounts (
  id              uuid primary key default gen_random_uuid(),
  -- Lowercase; the app normalises before it stores or looks up.
  username        text not null unique check (username ~ '^[a-z0-9_-]{3,24}$'),
  -- bcrypt. Accounts carried over from Supabase Auth keep their hash, so
  -- their passwords still work.
  password_hash   text not null,
  -- Wrong passwords in a row, and when the account may be tried again. Stops
  -- a password being guessed at the speed of the network.
  failed_attempts integer not null default 0,
  locked_until    timestamptz,
  created_at      timestamptz not null default now()
);

create table if not exists public.sessions (
  -- SHA-256 of the cookie's token. The token itself is never stored, so a
  -- leaked table does not sign anyone in.
  token_hash text primary key,
  account_id uuid not null references public.accounts (id) on delete cascade,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null
);

create index if not exists sessions_account_idx on public.sessions (account_id);

-- Only the server reads these, as the connection's own role. Through the public
-- API they must not exist: row level security with no policies, and no grants.
alter table public.accounts enable row level security;
alter table public.sessions enable row level security;
revoke all on public.accounts, public.sessions from anon, authenticated;

-- ---------------------------------------------------------------------------
-- Carry existing accounts over
-- ---------------------------------------------------------------------------
-- Same id, so every progress row stays attached; the part of the address
-- before the @ becomes the username; the bcrypt hash moves as it is. A user
-- this cannot place (no password, or no usable username) is left behind, and
-- the foreign keys below then refuse to move — the migration fails whole
-- rather than silently orphaning anyone's progress.
insert into public.accounts (id, username, password_hash, created_at)
select u.id, lower(split_part(u.email, '@', 1)), u.encrypted_password, u.created_at
from auth.users u
where coalesce(u.encrypted_password, '') <> ''
  and lower(split_part(u.email, '@', 1)) ~ '^[a-z0-9_-]{3,24}$'
on conflict do nothing;

-- ---------------------------------------------------------------------------
-- Point every table at accounts instead of auth.users
-- ---------------------------------------------------------------------------
do $$
declare
  fk record;
begin
  for fk in
    select c.conrelid::regclass as tbl, c.conname
    from pg_constraint c
    where c.contype = 'f'
      and c.confrelid = 'auth.users'::regclass
      and c.connamespace = 'public'::regnamespace
  loop
    execute format('alter table %s drop constraint %I', fk.tbl, fk.conname);
  end loop;
end $$;

alter table public.profiles
  add constraint profiles_id_fkey foreign key (id) references public.accounts (id) on delete cascade;
alter table public.word_progress
  add constraint word_progress_user_id_fkey foreign key (user_id) references public.accounts (id) on delete cascade;
alter table public.lesson_progress
  add constraint lesson_progress_user_id_fkey foreign key (user_id) references public.accounts (id) on delete cascade;
alter table public.study_sessions
  add constraint study_sessions_user_id_fkey foreign key (user_id) references public.accounts (id) on delete cascade;
alter table public.kanji_progress
  add constraint kanji_progress_user_id_fkey foreign key (user_id) references public.accounts (id) on delete cascade;
alter table public.daily_quiz_answers
  add constraint daily_quiz_answers_user_id_fkey foreign key (user_id) references public.accounts (id) on delete cascade;

-- ---------------------------------------------------------------------------
-- Nothing is read from Supabase Auth any more
-- ---------------------------------------------------------------------------
-- The app creates the profile itself, in the same transaction as the account.
drop trigger if exists on_auth_user_created on auth.users;
drop function if exists public.handle_new_user();

-- Answered "is this username taken" from auth.users for the sign-in form; the
-- server now asks public.accounts directly, and the anon key no longer needs
-- a way in.
drop function if exists public.username_exists(text);
