"use client";

import { createContext, useContext } from "react";
import { DEFAULT_LOCALE, type Locale } from "./config";
import { messages, type Messages } from "./messages";

const LocaleContext = createContext<Locale>(DEFAULT_LOCALE);

/**
 * Carries the request's language to client components.
 *
 * Only the locale crosses from server to browser. Messages hold functions,
 * which cannot be serialised, so each side looks them up itself.
 */
export function LocaleProvider({ locale, children }: { locale: Locale; children: React.ReactNode }) {
  return <LocaleContext.Provider value={locale}>{children}</LocaleContext.Provider>;
}

export function useLocale(): Locale {
  return useContext(LocaleContext);
}

/** The strings for the current language. */
export function useT(): Messages {
  return messages[useContext(LocaleContext)];
}
