-- The schedule becomes FSRS v4.
--
-- A word used to carry one integer, srs_stage, stepped up and down a fixed
-- ladder of intervals. It now carries FSRS's model of memory: stability (days
-- until recall falls to 90%), difficulty (1 to 10), and the state and counters
-- the scheduler needs. See lib/srs.ts.
--
-- Writing is on its own schedule, so kanji_progress gets the same columns,
-- prefixed writing_ like the rest of its writing columns.
--
-- The stage columns stop being read or written but are left in place, like
-- recognition_stage before them: they are the only record of how the old
-- schedule saw each word, and dropping them would lose it.
--
-- Legacy stages become a starting stability close to the interval the stage
-- scheduled. Difficulty starts at the middle, 5. Stage 5 and up, a week or
-- more, is Review; below that is still Learning.
--
-- Every backfill only touches rows still at state 0 with a stage above 0, so
-- running this again changes nothing, and never overwrites a row the new
-- scheduler has already graded.

-- ---------------------------------------------------------------------------
-- word_progress
-- ---------------------------------------------------------------------------

alter table public.word_progress
  add column if not exists stability       real    not null default 0.0,
  add column if not exists difficulty      real    not null default 5.0,
  add column if not exists elapsed_days    real    not null default 0.0,
  add column if not exists scheduled_days  real    not null default 0.0,
  add column if not exists reps            integer not null default 0,
  add column if not exists lapses          integer not null default 0,
  -- 0 New, 1 Learning, 2 Review, 3 Relearning.
  add column if not exists state           integer not null default 0,
  -- A mark's undo: the whole memory before the mark, as lib/srs.ts Memory.
  -- Replaces pre_mark_stage and pre_mark_due_at, which cannot hold it. Null on
  -- a marked row means the row did not exist before, as pre_mark_stage did.
  add column if not exists pre_mark_memory jsonb;

alter table public.word_progress drop constraint if exists word_progress_state_check;
alter table public.word_progress
  add constraint word_progress_state_check check (state between 0 and 3);

-- A mark made before this migration keeps its undo: the stage it came from
-- becomes a memory the same way a live stage does, below.
update public.word_progress
   set pre_mark_memory = jsonb_build_object(
         'stability', case pre_mark_stage
           when 0 then 0.0 when 1 then 0.1 when 2 then 0.33 when 3 then 1.0 when 4 then 3.0
           when 5 then 7.0 when 6 then 14.0 when 7 then 30.0 else 90.0 end,
         'difficulty', 5.0,
         'elapsed_days', 0.0,
         'scheduled_days', 0.0,
         'reps', 0,
         'lapses', 0,
         'state', case when pre_mark_stage = 0 then 0 when pre_mark_stage >= 5 then 2 else 1 end,
         'due_at', pre_mark_due_at,
         'last_reviewed_at', last_reviewed_at
       )
 where marked_at is not null and pre_mark_stage is not null and pre_mark_memory is null;

update public.word_progress
   set stability = case srs_stage
         when 1 then 0.1 when 2 then 0.33 when 3 then 1.0 when 4 then 3.0
         when 5 then 7.0 when 6 then 14.0 when 7 then 30.0 else 90.0 end,
       state = case when srs_stage >= 5 then 2 else 1 end,
       reps = correct_count + incorrect_count,
       -- The interval the old schedule last set, in days.
       scheduled_days = case srs_stage
         when 1 then 0.007 when 2 then 0.333 when 3 then 1.0 when 4 then 3.0
         when 5 then 7.0 when 6 then 14.0 when 7 then 30.0 else 90.0 end,
       -- A mark was the last look at a word. The old mark did not record it,
       -- and FSRS needs it to know how long the word has gone unreviewed.
       last_reviewed_at = case
         when marked_at is not null then greatest(last_reviewed_at, marked_at)
         else last_reviewed_at end
 where state = 0 and srs_stage > 0;

-- ---------------------------------------------------------------------------
-- kanji_progress: writing
-- ---------------------------------------------------------------------------

alter table public.kanji_progress
  add column if not exists writing_stability       real    not null default 0.0,
  add column if not exists writing_difficulty      real    not null default 5.0,
  add column if not exists writing_elapsed_days    real    not null default 0.0,
  add column if not exists writing_scheduled_days  real    not null default 0.0,
  add column if not exists writing_reps            integer not null default 0,
  add column if not exists writing_lapses          integer not null default 0,
  add column if not exists writing_state           integer not null default 0,
  add column if not exists pre_mark_writing_memory jsonb;

alter table public.kanji_progress drop constraint if exists kanji_progress_writing_state_check;
alter table public.kanji_progress
  add constraint kanji_progress_writing_state_check check (writing_state between 0 and 3);

update public.kanji_progress
   set pre_mark_writing_memory = jsonb_build_object(
         'stability', case pre_mark_writing_stage
           when 0 then 0.0 when 1 then 0.1 when 2 then 0.33 when 3 then 1.0 when 4 then 3.0
           when 5 then 7.0 when 6 then 14.0 when 7 then 30.0 else 90.0 end,
         'difficulty', 5.0,
         'elapsed_days', 0.0,
         'scheduled_days', 0.0,
         'reps', 0,
         'lapses', 0,
         'state', case when pre_mark_writing_stage = 0 then 0 when pre_mark_writing_stage >= 5 then 2 else 1 end,
         'due_at', pre_mark_writing_due_at,
         'last_reviewed_at', last_reviewed_at
       )
 where writing_marked_at is not null and pre_mark_writing_stage is not null and pre_mark_writing_memory is null;

-- Since 0006 only writing answers set last_reviewed_at, so it is writing's.
update public.kanji_progress
   set writing_stability = case writing_stage
         when 1 then 0.1 when 2 then 0.33 when 3 then 1.0 when 4 then 3.0
         when 5 then 7.0 when 6 then 14.0 when 7 then 30.0 else 90.0 end,
       writing_state = case when writing_stage >= 5 then 2 else 1 end,
       writing_scheduled_days = case writing_stage
         when 1 then 0.007 when 2 then 0.333 when 3 then 1.0 when 4 then 3.0
         when 5 then 7.0 when 6 then 14.0 when 7 then 30.0 else 90.0 end,
       last_reviewed_at = case
         when writing_marked_at is not null then greatest(last_reviewed_at, writing_marked_at)
         else last_reviewed_at end
 where writing_state = 0 and writing_stage > 0;

-- The writing queue now asks for writing_state > 0 rather than writing_stage.
drop index if exists public.kanji_progress_writing_due_idx;
create index if not exists kanji_progress_writing_state_due_idx
  on public.kanji_progress (user_id, writing_due_at)
  where writing_state > 0;

-- ---------------------------------------------------------------------------
-- daily_quiz_answers
-- ---------------------------------------------------------------------------
-- Each answer recorded how well the schedule believed the character was known
-- as a stage. From here it records the stability instead. srs_stage becomes
-- null on new rows rather than a 0 that would read as "unseen".

alter table public.daily_quiz_answers
  add column if not exists stability real;

alter table public.daily_quiz_answers
  alter column srs_stage drop not null,
  alter column srs_stage drop default;
