-- The language the app is shown in, per account.
--
-- Null until the learner chooses, and read as the language last picked on
-- their browser, then English (see getLocale in lib/i18n/server.ts). Only the
-- interface and the explanations change: progress is keyed on the Japanese,
-- so switching language keeps everything learned.
--
-- Additive only.

alter table public.profiles
  add column if not exists locale text;

alter table public.profiles drop constraint if exists profiles_locale_check;
alter table public.profiles
  add constraint profiles_locale_check
  check (locale is null or locale in ('en', 'id'));
