-- Kanji becomes the unit of progress.
--
-- The curriculum is now spined on characters rather than themes: a lesson
-- teaches five kanji and the words that demonstrate them. Word progress still
-- matters, but "how many kanji do I know" is the headline number, and writing
-- is tracked separately because recognising a character and being able to
-- write it are genuinely different skills that decay at different rates.

create table if not exists public.kanji_progress (
  user_id           uuid not null references auth.users (id) on delete cascade,
  level             text not null default 'N5',
  char              text not null,
  -- Recognition: meaning and reading, quizzed through vocabulary.
  recognition_stage smallint not null default 0 check (recognition_stage between 0 and 8),
  -- Writing: reproducing the character from memory, self-assessed.
  writing_stage     smallint not null default 0 check (writing_stage between 0 and 8),
  correct_count     integer not null default 0,
  incorrect_count   integer not null default 0,
  due_at            timestamptz not null default now(),
  last_reviewed_at  timestamptz,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  primary key (user_id, char)
);

create index if not exists kanji_progress_due_idx
  on public.kanji_progress (user_id, due_at);

alter table public.kanji_progress enable row level security;

drop policy if exists "own kanji progress" on public.kanji_progress;
create policy "own kanji progress" on public.kanji_progress
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop trigger if exists kanji_progress_touch on public.kanji_progress;
create trigger kanji_progress_touch before update on public.kanji_progress
  for each row execute function public.touch_updated_at();

-- Study sessions gain a kanji mode alongside lesson and review.
alter table public.study_sessions drop constraint if exists study_sessions_mode_check;
alter table public.study_sessions
  add constraint study_sessions_mode_check
  check (mode in ('lesson', 'review', 'writing'));

-- The old curriculum was themed and its lesson slugs are gone, so every word
-- id derived from those slugs now points at nothing. Clearing the orphans
-- keeps the dashboard honest rather than counting progress against words that
-- no longer exist. Kanji progress starts empty either way.
delete from public.word_progress
 where lesson_slug not in (
   'one-to-five', 'six-to-ten', 'hundreds-and-money', 'days-months-time',
   'people', 'family-and-teachers', 'weather-and-land', 'five-elements',
   'size-and-position', 'directions', 'coming-and-going', 'front-back-left-right',
   'seeing-and-saying', 'school-and-language', 'eating-and-resting', 'describing-things'
 );

delete from public.lesson_progress
 where lesson_slug not in (
   'one-to-five', 'six-to-ten', 'hundreds-and-money', 'days-months-time',
   'people', 'family-and-teachers', 'weather-and-land', 'five-elements',
   'size-and-position', 'directions', 'coming-and-going', 'front-back-left-right',
   'seeing-and-saying', 'school-and-language', 'eating-and-resting', 'describing-things'
 );
