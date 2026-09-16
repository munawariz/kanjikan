import type { Locale } from "./config";

/**
 * The BCP 47 tag to hand Intl for a language. Safe to import anywhere.
 *
 * Numbers and dates follow the language, not the browser, so a page reads the
 * same on the server and after hydration.
 */
export const INTL_TAG: Record<Locale, string> = {
  en: "en-US",
  id: "id-ID",
};

export function formatNumber(locale: Locale, n: number): string {
  return new Intl.NumberFormat(INTL_TAG[locale]).format(n);
}
