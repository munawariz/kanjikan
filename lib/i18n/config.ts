/**
 * The languages the app is written in. Safe to import anywhere, browser
 * included: it reads nothing.
 *
 * Japanese is what is being learned, not a language the app speaks, so it is
 * never one of these.
 *
 * A language is any folder under data/jlpt/locales/ whose name is a language
 * code: adding the folder is what adds the language (see lib/i18n/locales.ts,
 * which lists them on the server). Whatever a language has not translated yet
 * is shown in English. English and Indonesian also have their interface text
 * written in TypeScript, in lib/i18n/messages; any other language writes it
 * in the folder's interface.json. CONTRIBUTING.md walks through it.
 */

/** A language code, such as "en", "id" or "pt-BR". */
export type Locale = string;

/** The languages whose interface text is written in lib/i18n/messages. */
export const BUILT_IN_LOCALES = ["en", "id"] as const;

export type BuiltInLocale = (typeof BUILT_IN_LOCALES)[number];

/** The reference language, and what anything untranslated falls back to. */
export const DEFAULT_LOCALE = "en" satisfies BuiltInLocale;

/**
 * Remembers the last language chosen on this browser, so a guest — or a
 * learner who has signed out — keeps it. A signed-in learner's own setting
 * always wins over it.
 */
export const LOCALE_COOKIE = "kanjikan-locale";

/** A language as the pickers show it. */
export type LocaleInfo = {
  code: Locale;
  /** The language's own name for itself, from its locale.json. */
  name: string;
};

/**
 * Whether a string is shaped like a language code: two or three lower-case
 * letters, then optional subtags ("pt-BR", "zh-Hant"). Says nothing about
 * whether the app has that language; see isAvailableLocale on the server, or
 * the list in useLocales on the client.
 */
export function isLocaleCode(value: unknown): value is Locale {
  return typeof value === "string" && /^[a-z]{2,3}(-[A-Za-z0-9]{2,8})*$/.test(value);
}

export function isBuiltInLocale(value: unknown): value is BuiltInLocale {
  return typeof value === "string" && (BUILT_IN_LOCALES as readonly string[]).includes(value);
}
