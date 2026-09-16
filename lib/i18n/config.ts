/**
 * The languages the app is written in. Safe to import anywhere, browser
 * included: it reads nothing.
 *
 * Japanese is what is being learned, not a language the app speaks, so it is
 * never one of these. Adding a language means its strings in every file in
 * lib/i18n/messages, its content in data/jlpt/locales/<locale>/, and an entry
 * here and in SHIPPED in scripts/validate-content.mjs. The README's
 * "Contributing" section walks through it.
 */
export const LOCALES = ["en", "id"] as const;

export type Locale = (typeof LOCALES)[number];

export const DEFAULT_LOCALE: Locale = "en";

/**
 * Remembers the last language chosen on this browser, so a guest — or a
 * learner who has signed out — keeps it. A signed-in learner's own setting
 * always wins over it.
 */
export const LOCALE_COOKIE = "kanjikan-locale";

/** Each language's name, written in that language, as the picker shows it. */
export const LOCALE_NAMES: Record<Locale, string> = {
  en: "English",
  id: "Bahasa Indonesia",
};

export function isLocale(value: unknown): value is Locale {
  return typeof value === "string" && (LOCALES as readonly string[]).includes(value);
}
