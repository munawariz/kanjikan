import { NextResponse } from "next/server";
import { getUser } from "@/lib/auth";
import { getKanjiChar } from "@/lib/content";
import { recordKanjiAnswer } from "@/lib/progress";

/**
 * Grades one answer against a character, for either skill.
 *
 * Called once per card rather than batched at the end, so a learner who closes
 * the tab mid-session keeps everything already answered.
 */
export async function POST(request: Request) {
  const user = await getUser();
  if (!user) return NextResponse.json({ error: "Not signed in" }, { status: 401 });

  const body = await request.json().catch(() => null);
  const char = body?.char;
  const correct = Boolean(body?.correct);
  const skill = body?.skill === "writing" ? "writing" : "recognition";

  if (typeof char !== "string") {
    return NextResponse.json({ error: "char is required" }, { status: 400 });
  }

  // Resolved against file content, so a forged character cannot write a row
  // for something outside the curriculum.
  const kanji = getKanjiChar(char);
  if (!kanji) return NextResponse.json({ error: "Unknown kanji" }, { status: 404 });

  try {
    const next = await recordKanjiAnswer(user.id, kanji, correct, skill);
    return NextResponse.json({ ok: true, stage: next.srs_stage, dueAt: next.due_at });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
