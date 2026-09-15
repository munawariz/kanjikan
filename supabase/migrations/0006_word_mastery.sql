-- Words become the unit of reading mastery; writing becomes its own, optional
-- track; and a learner can mark what they already know.
--
-- Reading: a kanji no longer has a reading score of its own. How well it can
-- be read is worked out from the words that teach it (see kanjiReading in
-- lib/srs.ts), so reviewing 日本語 strengthens 語. kanji_progress.recognition_stage
-- and kanji_progress.due_at stop being read or written, but are left in place:
-- dropping them would throw away history that cannot be rebuilt.
--
-- Writing: kanji_progress.writing_stage keeps its meaning and gains a due date
-- of its own. It used to share due_at with recognition.
--
-- Marks: "I already know this" puts a word, or a kanji's writing, straight at
-- the known stage, due in a week for one check. The state before the mark is
-- kept beside it so the mark can be undone exactly. A null pre_mark stage on a
-- marked row means the row did not exist before, so undoing deletes it. The
-- first answer after a mark settles it and clears all three columns.
--
-- Additive only: every existing row keeps its values.

-- ---------------------------------------------------------------------------
-- profiles
-- ---------------------------------------------------------------------------

-- Null until the learner has chosen, and treated as true until then, so an
-- existing account carries on exactly as before and is asked once.
alter table public.profiles
  add column if not exists study_writing boolean;

-- Due reviews at which starting a lesson shows a "review first?" warning.
-- Null never warns. The warning never blocks.
alter table public.profiles
  add column if not exists review_warning smallint default 20;

alter table public.profiles drop constraint if exists profiles_review_warning_check;
alter table public.profiles
  add constraint profiles_review_warning_check
  check (review_warning is null or review_warning between 1 and 500);

-- ---------------------------------------------------------------------------
-- word_progress: marks
-- ---------------------------------------------------------------------------

alter table public.word_progress
  add column if not exists marked_at       timestamptz,
  add column if not exists pre_mark_stage  smallint,
  add column if not exists pre_mark_due_at timestamptz;

-- ---------------------------------------------------------------------------
-- kanji_progress: writing on its own schedule, and its marks
-- ---------------------------------------------------------------------------

alter table public.kanji_progress
  add column if not exists writing_due_at          timestamptz,
  add column if not exists writing_marked_at       timestamptz,
  add column if not exists pre_mark_writing_stage  smallint,
  add column if not exists pre_mark_writing_due_at timestamptz;

-- The shared due date was the sooner of the two skills, so for a character
-- that has been written it is the earliest the writing could be due. Only
-- filled where still empty, so running this again changes nothing.
update public.kanji_progress
   set writing_due_at = due_at
 where writing_stage > 0 and writing_due_at is null;

create index if not exists kanji_progress_writing_due_idx
  on public.kanji_progress (user_id, writing_due_at)
  where writing_stage > 0;
