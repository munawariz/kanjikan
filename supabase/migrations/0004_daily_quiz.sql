-- The daily quiz: five questions a day on kanji the learner already knows.
--
-- One row per question answered. The quiz itself is not stored: it is rebuilt
-- from the date and the characters learned before it (see getDailyQuiz in
-- lib/progress.ts), and the server grades each answer against that rebuild, so
-- a row here is a verdict the browser could not have forged.
--
-- The rows are kept for analysis rather than scheduling. Nothing reads them to
-- decide what to show next, and the quiz deliberately leaves kanji_progress
-- alone, so the results measure what has stuck without disturbing the review
-- schedule they are measuring.

create table if not exists public.daily_quiz_answers (
  user_id     uuid not null references auth.users (id) on delete cascade,
  level       text not null default 'N5',
  -- The learner's own calendar day, not the server's. See time_zone.
  quiz_date   date not null,
  -- 1-based order within the day's quiz.
  position    smallint not null check (position between 1 and 5),
  -- Only one kind so far; recorded so a second can be added without guessing
  -- what the old rows were.
  kind        text not null default 'kanji-meaning' check (kind in ('kanji-meaning')),
  char        text not null,
  -- Option labels exactly as shown, in the order shown: the right one, the one
  -- picked, and all four. Kept as text rather than ids so a row still reads
  -- correctly after the content files change.
  answer      text not null,
  chosen      text not null,
  options     text[] not null,
  correct     boolean not null,
  -- The character's recognition stage when it was asked, so a result can later
  -- be read against how well the schedule believed it was known.
  srs_stage   smallint not null default 0,
  -- The IANA zone quiz_date was reckoned in.
  time_zone   text not null default 'UTC',
  answered_at timestamptz not null default now(),
  primary key (user_id, quiz_date, position)
);

alter table public.daily_quiz_answers enable row level security;

-- Read and insert only. With no update or delete policy an answer cannot be
-- changed once given, which is what makes a reload unable to take a question
-- again.
drop policy if exists "read own daily answers" on public.daily_quiz_answers;
create policy "read own daily answers" on public.daily_quiz_answers
  for select using (auth.uid() = user_id);

drop policy if exists "insert own daily answers" on public.daily_quiz_answers;
create policy "insert own daily answers" on public.daily_quiz_answers
  for insert with check (auth.uid() = user_id);
