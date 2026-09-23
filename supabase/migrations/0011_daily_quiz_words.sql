-- The daily quiz asks about words, not single characters.
--
-- Each question is a word asked one of three ways, as in lessons and reviews:
-- its meaning, its reading, or the word from its meaning. Rows from before
-- this keep kind 'kanji-meaning' and hold a character in char.
--
-- For a word, char holds the word as written, so a row still reads correctly
-- after the content files change, and word_id ties it to word_progress.
-- stability is the word's own, where older rows hold the character's.

alter table public.daily_quiz_answers
  drop constraint if exists daily_quiz_answers_kind_check;

alter table public.daily_quiz_answers
  add constraint daily_quiz_answers_kind_check
  check (kind in ('kanji-meaning', 'word-meaning', 'word-reading', 'word-recall'));

alter table public.daily_quiz_answers
  alter column kind drop default;

alter table public.daily_quiz_answers
  add column if not exists word_id text;
