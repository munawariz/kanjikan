import { NextResponse } from "next/server";
import { isAvailableLocale, listLocales } from "@/lib/i18n/locales";
import { rememberLocale } from "@/lib/i18n/server";

/**
 * Sets the language on this browser, for a guest. A signed-in learner's own
 * setting outranks it, and is saved through /api/settings instead.
 *
 *   locale  a language code the app has a folder for
 */
export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  if (!isAvailableLocale(body?.locale)) {
    const codes = listLocales().map((l) => l.code);
    return NextResponse.json({ error: `locale must be one of ${codes.join(", ")}` }, { status: 400 });
  }
  rememberLocale(body.locale);
  return NextResponse.json({ ok: true });
}
