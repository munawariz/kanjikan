import { DEFAULT_LOCALE, type Locale } from "./config";

/**
 * The BCP 47 tag to hand Intl for a language. Safe to import anywhere.
 *
 * Numbers and dates follow the language, not the browser, so a page reads the
 * same on the server and after hydration. A language code is already a valid
 * tag; English is pinned to US English, and anything Intl does not accept
 * falls back to it rather than throwing mid-render.
 */
export function intlTag(locale: Locale): string {
  if (locale === DEFAULT_LOCALE) return "en-US";
  try {
    return Intl.getCanonicalLocales(locale)[0] ?? "en-US";
  } catch {
    return "en-US";
  }
}

export function formatNumber(locale: Locale, n: number): string {
  return new Intl.NumberFormat(intlTag(locale)).format(n);
}

/** Joins a list the way the language does: "N5 and N4", "N5 dan N4". */
export function formatList(locale: Locale, items: string[]): string {
  return new Intl.ListFormat(intlTag(locale), { type: "conjunction" }).format(items);
}
