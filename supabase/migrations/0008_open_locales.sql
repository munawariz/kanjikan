-- Languages are no longer a fixed list.
--
-- A language is added by adding its folder under data/jlpt/locales/, so the
-- database cannot know them in advance. The check now only asks for something
-- shaped like a language code; the app decides whether it offers that language
-- (isAvailableLocale in lib/i18n/locales.ts) and falls back to English when a
-- saved one has since been removed.
--
-- Additive only: every value the old check allowed still passes.

alter table public.profiles drop constraint if exists profiles_locale_check;
alter table public.profiles
  add constraint profiles_locale_check
  check (locale is null or locale ~ '^[a-z]{2,3}(-[A-Za-z0-9]{2,8})*$');
