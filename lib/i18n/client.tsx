"use client";

import { createContext, useContext, useMemo } from "react";
import { DEFAULT_LOCALE, isBuiltInLocale, type Locale, type LocaleInfo } from "./config";
import { messages, type Messages } from "./messages";
import { compileMessages, type InterfaceText } from "./template";

type LocaleState = { locale: Locale; locales: LocaleInfo[]; t: Messages };

const LocaleContext = createContext<LocaleState>({
  locale: DEFAULT_LOCALE,
  locales: [{ code: DEFAULT_LOCALE, name: "English" }],
  t: messages[DEFAULT_LOCALE],
});

/**
 * The strings of the language last provided, for code that runs outside
 * React, such as a failed save reported from a plain function.
 */
let current: Messages = messages[DEFAULT_LOCALE];

export function currentMessages(): Messages {
  return current;
}

/**
 * Carries the request's language to client components.
 *
 * Messages hold functions, which cannot be serialised, so the server sends
 * what can be: the language, the list to pick from, and, for a language
 * written only as a folder, its interface.json. The strings are compiled here
 * from that, exactly as the server compiled them.
 */
export function LocaleProvider({
  locale,
  locales,
  text,
  children,
}: {
  locale: Locale;
  locales: LocaleInfo[];
  text: InterfaceText | null;
  children: React.ReactNode;
}) {
  const value = useMemo<LocaleState>(() => {
    const t = isBuiltInLocale(locale)
      ? messages[locale]
      : compileMessages(messages[DEFAULT_LOCALE], text, locale);
    return { locale, locales, t };
  }, [locale, locales, text]);
  current = value.t;
  return <LocaleContext.Provider value={value}>{children}</LocaleContext.Provider>;
}

export function useLocale(): Locale {
  return useContext(LocaleContext).locale;
}

/** Every language the app offers, English first. */
export function useLocales(): LocaleInfo[] {
  return useContext(LocaleContext).locales;
}

/** The strings for the current language. */
export function useT(): Messages {
  return useContext(LocaleContext).t;
}
