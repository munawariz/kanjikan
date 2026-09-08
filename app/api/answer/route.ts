import { NextResponse } from "next/server";
import { getUser } from "@/lib/supabase/server";
import { getAllWords } from "@/lib/content";
import { recordAnswer } from "@/lib/progress";

/**
 * Grades one answer. Called once per card rather than batched at the end so a
 * learner who closes the tab mid-session keeps everything already answered.
 */
export async function POST(request: Request) {
  const user = await getUser();
  if (!user) return NextResponse.json({ error: "Not signed in" }, { status: 401 });

  const body = await request.json().catch(() => null);
  const wordId = body?.wordId;
  const correct = Boolean(body?.correct);

  if (typeof wordId !== "string") {
    return NextResponse.json({ error: "wordId is required" }, { status: 400 });
  }

  // Resolve against file content: the client never gets to say what level or
  // lesson a word belongs to, so a forged id cannot write a bogus row.
  const word = getAllWords().find((w) => w.id === wordId);
  if (!word) return NextResponse.json({ error: "Unknown word" }, { status: 404 });

  try {
    const next = await recordAnswer(user.id, word, correct);
    return NextResponse.json({ ok: true, srsStage: next.srs_stage, dueAt: next.due_at });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
