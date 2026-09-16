import { NextResponse } from "next/server";
import { getUser } from "@/lib/auth";
import { getLocale } from "@/lib/i18n/server";
import { getMessages } from "@/lib/i18n/locales";
import { localDate, requestTimeZone, shiftDate } from "@/lib/daily";
import { recordDailyAnswer } from "@/lib/progress";

/**
 * Records one daily quiz answer, graded on the server.
 *
 * Takes only the day, the question's position and the option picked; see
 * recordDailyAnswer for why the verdict is not accepted from the browser.
 */
export async function POST(request: Request) {
  const [user, locale] = await Promise.all([getUser(), getLocale()]);
  const t = getMessages(locale);
  if (!user) return NextResponse.json({ error: t.api.notSignedIn }, { status: 401 });

  const body = await request.json().catch(() => null);
  const date = body?.date;
  const position = Number(body?.position);
  const choiceId = body?.choiceId;

  if (typeof date !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return NextResponse.json({ error: "date must be YYYY-MM-DD" }, { status: 400 });
  }
  if (!Number.isInteger(position) || typeof choiceId !== "string") {
    return NextResponse.json({ error: "position and choiceId are required" }, { status: 400 });
  }

  // Today, or yesterday for a quiz begun just before midnight. Any other day
  // is closed: no answering ahead, and no going back to redo an old one.
  const timeZone = requestTimeZone();
  const today = localDate(timeZone);
  if (date !== today && date !== shiftDate(today, -1)) {
    return NextResponse.json({ error: t.api.quizClosed }, { status: 400 });
  }

  try {
    const result = await recordDailyAnswer(user.id, date, timeZone, position, choiceId, locale);
    if (result.status === "invalid") {
      const error = result.reason === "no-question" ? t.api.noSuchQuestion : t.api.notAnOption;
      return NextResponse.json({ error }, { status: 400 });
    }
    // A repeat is not an error: the answer the learner gave is on record.
    return NextResponse.json({ ok: true, ...result });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
