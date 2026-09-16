import { NextResponse } from "next/server";
import { getUser } from "@/lib/auth";
import { getT, rememberLocale } from "@/lib/i18n/server";
import type { Locale } from "@/lib/i18n/config";
import { isAvailableLocale, listLocales } from "@/lib/i18n/locales";
import { saveSettings } from "@/lib/progress";

/**
 * Saves a learner's study choices. Any field may be sent alone.
 *
 *   studyWriting   boolean
 *   reviewWarning  due reviews at which a new lesson warns first, 1–500, or null for never
 *   locale         the language the app is shown in: a code the app has a folder for
 */
export async function POST(request: Request) {
  const [user, t] = await Promise.all([getUser(), getT()]);
  if (!user) return NextResponse.json({ error: t.api.notSignedIn }, { status: 401 });

  const body = await request.json().catch(() => null);
  const settings: { studyWriting?: boolean; reviewWarning?: number | null; locale?: Locale } = {};

  if (body && "studyWriting" in body) {
    if (typeof body.studyWriting !== "boolean") {
      return NextResponse.json({ error: "studyWriting must be true or false" }, { status: 400 });
    }
    settings.studyWriting = body.studyWriting;
  }
  if (body && "reviewWarning" in body) {
    const v = body.reviewWarning;
    if (v !== null && !(Number.isInteger(v) && v >= 1 && v <= 500)) {
      return NextResponse.json({ error: "reviewWarning must be 1 to 500, or null" }, { status: 400 });
    }
    settings.reviewWarning = v;
  }
  if (body && "locale" in body) {
    if (!isAvailableLocale(body.locale)) {
      const codes = listLocales().map((l) => l.code);
      return NextResponse.json({ error: `locale must be one of ${codes.join(", ")}` }, { status: 400 });
    }
    settings.locale = body.locale;
  }

  try {
    await saveSettings(user.id, settings);
    // Also on this browser, so the language holds after signing out.
    if (settings.locale) rememberLocale(settings.locale);
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
