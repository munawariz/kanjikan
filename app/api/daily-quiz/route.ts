import { NextResponse } from "next/server";
import { getUser } from "@/lib/supabase/server";
import { localDate, requestTimeZone, shiftDate } from "@/lib/daily";
import { recordDailyAnswer } from "@/lib/progress";

/**
 * Records one daily quiz answer, graded on the server.
 *
 * Takes only the day, the question's position and the option picked; see
 * recordDailyAnswer for why the verdict is not accepted from the browser.
 */
export async function POST(request: Request) {
  const user = await getUser();
  if (!user) return NextResponse.json({ error: "Not signed in" }, { status: 401 });

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
    return NextResponse.json({ error: "That quiz is closed" }, { status: 400 });
  }

  try {
    const result = await recordDailyAnswer(user.id, date, timeZone, position, choiceId);
    if (result.status === "invalid") {
      return NextResponse.json({ error: result.reason }, { status: 400 });
    }
    // A repeat is not an error: the answer the learner gave is on record.
    return NextResponse.json({ ok: true, ...result });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
