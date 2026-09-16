import { NextResponse } from "next/server";
import { isLocale, LOCALES } from "@/lib/i18n/config";
import { rememberLocale } from "@/lib/i18n/server";

/**
 * Sets the language on this browser, for a guest. A signed-in learner's own
 * setting outranks it, and is saved through /api/settings instead.
 *
 *   locale  "en" or "id"
 */
export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  if (!isLocale(body?.locale)) {
    return NextResponse.json({ error: `locale must be one of ${LOCALES.join(", ")}` }, { status: 400 });
  }
  rememberLocale(body.locale);
  return NextResponse.json({ ok: true });
}
