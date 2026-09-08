-- Kanjikan schema.
--
-- Vocabulary content lives in data/jlpt/**.json and is deliberately NOT stored
-- here. These tables hold only per-user mutable state and reference words by
-- the content-derived id from lib/content.ts (wordId). There is therefore no
-- foreign key onto a words table; a word that is removed from the JSON simply
-- leaves an orphan progress row, which is harmless and lets content and
-- progress be versioned independently.

create extension if not exists "pgcrypto";

-- ---------------------------------------------------------------------------
-- profiles
-- ---------------------------------------------------------------------------
-- One row per auth user. Also stores the resume checkpoint: the level and
-- lesson the learner was last working through.

create table if not exists public.profiles (
  id                  uuid primary key references auth.users (id) on delete cascade,
  display_name        text not null default '',
  current_level       text not null default 'N5',
  current_lesson_slug text,
  daily_goal          integer not null default 20 check (daily_goal between 5 and 200),
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- word_progress
-- ---------------------------------------------------------------------------
-- The spaced-repetition record for one learner and one word.
-- srs_stage drives the interval; see lib/srs.ts for the schedule.

create table if not exists public.word_progress (
  user_id          uuid not null references auth.users (id) on delete cascade,
  word_id          text not null,
  level            text not null default 'N5',
  lesson_slug      text not null,
  srs_stage        smallint not null default 0 check (srs_stage between 0 and 8),
  correct_count    integer not null default 0,
  incorrect_count  integer not null default 0,
  streak           integer not null default 0,
  due_at           timestamptz not null default now(),
  last_reviewed_at timestamptz,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  primary key (user_id, word_id)
);

-- The review queue query: everything for this user that is due now.
create index if not exists word_progress_due_idx
  on public.word_progress (user_id, due_at);

create index if not exists word_progress_lesson_idx
  on public.word_progress (user_id, level, lesson_slug);

-- ---------------------------------------------------------------------------
-- lesson_progress
-- ---------------------------------------------------------------------------
-- The checkpoint per lesson. cursor is the index of the next unseen word, so a
-- learner who stops halfway through a 20-word lesson resumes where they left
-- off rather than starting again.

create table if not exists public.lesson_progress (
  user_id      uuid not null references auth.users (id) on delete cascade,
  level        text not null default 'N5',
  lesson_slug  text not null,
  status       text not null default 'learning' check (status in ('learning', 'completed')),
  cursor       integer not null default 0 check (cursor >= 0),
  completed_at timestamptz,
  updated_at   timestamptz not null default now(),
  primary key (user_id, level, lesson_slug)
);

-- ---------------------------------------------------------------------------
-- study_sessions
-- ---------------------------------------------------------------------------
-- One row per finished study or review run. Streaks and the activity chart are
-- computed from these rather than from word_progress, which only ever holds the
-- latest state per word.

create table if not exists public.study_sessions (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users (id) on delete cascade,
  level       text not null default 'N5',
  lesson_slug text,
  mode        text not null check (mode in ('lesson', 'review')),
  total       integer not null default 0,
  correct     integer not null default 0,
  created_at  timestamptz not null default now()
);

create index if not exists study_sessions_user_time_idx
  on public.study_sessions (user_id, created_at desc);

-- ---------------------------------------------------------------------------
-- Row Level Security
-- ---------------------------------------------------------------------------
-- Every table is scoped to the authenticated owner. Without these policies the
-- anon key would expose all learners to each other.

alter table public.profiles        enable row level security;
alter table public.word_progress   enable row level security;
alter table public.lesson_progress enable row level security;
alter table public.study_sessions  enable row level security;

drop policy if exists "own profile" on public.profiles;
create policy "own profile" on public.profiles
  for all using (auth.uid() = id) with check (auth.uid() = id);

drop policy if exists "own word progress" on public.word_progress;
create policy "own word progress" on public.word_progress
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "own lesson progress" on public.lesson_progress;
create policy "own lesson progress" on public.lesson_progress
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "own study sessions" on public.study_sessions;
create policy "own study sessions" on public.study_sessions
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- ---------------------------------------------------------------------------
-- Profile bootstrap
-- ---------------------------------------------------------------------------
-- Creating the profile from the client would need a round trip that can fail
-- between signup and first write, leaving a user with no profile row. Doing it
-- in a trigger makes signup atomic.

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, display_name)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'display_name', split_part(new.email, '@', 1))
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- The trigger only fires on new signups. Anyone who registered before this
-- migration ran has a row in auth.users but none in public.profiles, which
-- leaves saveCheckpoint updating zero rows and the resume pointer never
-- sticking. Backfill them; harmless and idempotent on a fresh project.
insert into public.profiles (id, display_name)
select
  u.id,
  coalesce(u.raw_user_meta_data ->> 'display_name', split_part(u.email, '@', 1))
from auth.users u
on conflict (id) do nothing;

-- ---------------------------------------------------------------------------
-- updated_at maintenance
-- ---------------------------------------------------------------------------

create or replace function public.touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists profiles_touch on public.profiles;
create trigger profiles_touch before update on public.profiles
  for each row execute function public.touch_updated_at();

drop trigger if exists word_progress_touch on public.word_progress;
create trigger word_progress_touch before update on public.word_progress
  for each row execute function public.touch_updated_at();

drop trigger if exists lesson_progress_touch on public.lesson_progress;
create trigger lesson_progress_touch before update on public.lesson_progress
  for each row execute function public.touch_updated_at();
