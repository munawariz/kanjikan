import "server-only";
import { cache } from "react";
import { cookies } from "next/headers";
import { getUser } from "@/lib/auth";
import { asSystem } from "@/lib/db";
import { DEFAULT_LOCALE, LOCALE_COOKIE, type Locale } from "./config";
import { getMessages, isAvailableLocale } from "./locales";
import type { Messages } from "./messages";

/**
 * The language of this request.
 *
 * A signed-in learner's setting, then the language last chosen on this
 * browser, then English. A language whose folder has since been removed is
 * skipped. Memoised per request: the layout, the page and everything they
 * render all ask.
 */
export const getLocale = cache(async (): Promise<Locale> => {
  const user = await getUser();
  if (user) {
    try {
      const saved = await asSystem(async (db) => {
        const { rows } = await db.query<{ locale: string | null }>(
          `select locale from public.profiles where id = $1`,
          [user.id],
        );
        return rows[0]?.locale;
      });
      if (isAvailableLocale(saved)) return saved;
    } catch (e) {
      // Before the migration that adds the column, fall through rather than
      // failing every page.
      console.error(`[kanjikan] getLocale failed: ${(e as Error).message}`);
    }
  }
  const cookie = cookies().get(LOCALE_COOKIE)?.value;
  return isAvailableLocale(cookie) ? cookie : DEFAULT_LOCALE;
});

/** The strings for this request's language, with English for anything untranslated. */
export async function getT(): Promise<Messages> {
  return getMessages(await getLocale());
}

/** Remembers a language on this browser. Route handlers and server actions only. */
export function rememberLocale(locale: Locale) {
  cookies().set(LOCALE_COOKIE, locale, {
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 400,
  });
}
