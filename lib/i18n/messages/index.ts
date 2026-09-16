import type { BuiltInLocale } from "../config";
import { api } from "./api";
import { auth } from "./auth";
import { common } from "./common";
import { daily } from "./daily";
import { dashboard } from "./dashboard";
import { home } from "./home";
import { kanji } from "./kanji";
import { lessons } from "./lessons";
import { practice } from "./practice";
import { reading } from "./reading";
import { settings } from "./settings";
import { shell } from "./shell";
import { study } from "./study";

/**
 * Every string the app shows, in the languages written here: English and
 * Indonesian. Any other language gives its strings in
 * data/jlpt/locales/<locale>/interface.json, compiled onto English by
 * lib/i18n/template.ts.
 *
 * One file per area, each exporting `{ en, id }`. English is the source: `id`
 * is typed as `typeof en`, so a string added in English and not in Indonesian
 * fails the type check rather than shipping blank.
 *
 * Conventions:
 * - A string that takes values is a function: `due: (n: number) => ...`.
 *   Plurals are decided inside it; Indonesian has no plural forms, so its
 *   version usually ignores the count.
 * - A string with markup inside it is a function returning JSX, and the file
 *   is .tsx.
 * - Indonesian addresses the learner as "kamu", as a friendly app does.
 * - Japanese terms stay as they are in both: kanji, hiragana, onyomi, kunyomi.
 *
 * Server components read these with getT() from lib/i18n/server, client
 * components with useT() from lib/i18n/client.
 */
function build(locale: BuiltInLocale) {
  return {
    api: api[locale],
    auth: auth[locale],
    common: common[locale],
    daily: daily[locale],
    dashboard: dashboard[locale],
    home: home[locale],
    kanji: kanji[locale],
    lessons: lessons[locale],
    practice: practice[locale],
    reading: reading[locale],
    settings: settings[locale],
    shell: shell[locale],
    study: study[locale],
  };
}

export type Messages = ReturnType<typeof build>;

export const messages: Record<BuiltInLocale, Messages> = {
  en: build("en"),
  id: build("id"),
};

/**
 * Strings an interface.json cannot replace, because what they say depends on
 * the shape of their arguments rather than on a count or a flag: a list of
 * levels with their own counts, a range of levels, a sentence that changes
 * with how many levels are built, a handwriting note of one
 * of twenty kinds. A language without TypeScript strings shows these in
 * English. Dotted paths into Messages.
 */
export const TEMPLATE_EXCLUDED = [
  "dashboard.roadBody",
  "home.hereContent",
  "home.hereUnbuilt",
  "kanji.writing.note",
];
