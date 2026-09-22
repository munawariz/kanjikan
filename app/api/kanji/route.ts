import { NextResponse } from "next/server";
import { isRating } from "@/lib/srs";
import { getUser } from "@/lib/auth";
import { getT } from "@/lib/i18n/server";
import { getKanjiChar } from "@/lib/content";
import { recordWritingAnswer } from "@/lib/progress";

/**
 * Grades one attempt at writing a character.
 *
 * Only writing: a character's reading is not graded on its own but worked out
 * from its words, which /api/answer grades.
 *
 * Called once per card rather than batched at the end, so a learner who closes
 * the tab mid-session keeps everything already answered.
 */
export async function POST(request: Request) {
  const [user, t] = await Promise.all([getUser(), getT()]);
  if (!user) return NextResponse.json({ error: t.api.notSignedIn }, { status: 401 });

  const body = await request.json().catch(() => null);
  const char = body?.char;
  // An FSRS rating, 1 (Again) to 4 (Easy), or right and wrong as before.
  const answer = isRating(body?.rating) ? body.rating : Boolean(body?.correct);

  if (typeof char !== "string") {
    return NextResponse.json({ error: "char is required" }, { status: 400 });
  }

  // Resolved against file content, so a forged character cannot write a row
  // for something outside the curriculum.
  const kanji = getKanjiChar(char);
  if (!kanji) return NextResponse.json({ error: t.api.unknownKanji }, { status: 404 });

  try {
    const next = await recordWritingAnswer(user.id, kanji, answer);
    return NextResponse.json({ ok: true, stability: next.stability, state: next.state, dueAt: next.due_at });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
