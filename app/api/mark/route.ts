import { NextResponse } from "next/server";
import { getUser } from "@/lib/auth";
import { getT } from "@/lib/i18n/server";
import { markWordsKnown, markWritingKnown, unmarkWords, unmarkWriting } from "@/lib/progress";
import { resolveMark } from "@/lib/sync";

/**
 * "I already know this", and its undo.
 *
 *   scope  word | kanji | lesson — what `id` names (a word id, a character, a lesson slug)
 *   skill  reading | writing     — reading marks words; writing marks characters
 *   undo   true to take the mark back
 *
 * Writing has no word scope. What each scope covers is decided by resolveMark
 * in lib/sync.ts, which study sessions' marks go through too.
 */
export async function POST(request: Request) {
  const [user, t] = await Promise.all([getUser(), getT()]);
  if (!user) return NextResponse.json({ error: t.api.notSignedIn }, { status: 401 });

  const body = await request.json().catch(() => null);
  const scope = body?.scope;
  const id = body?.id;
  const skill = body?.skill === "writing" ? "writing" : "reading";
  const undo = body?.undo === true;

  if (typeof id !== "string") return NextResponse.json({ error: "id is required" }, { status: 400 });

  const resolved = resolveMark(scope, id);
  if (!resolved) {
    return NextResponse.json({ error: "scope must be word, kanji or lesson" }, { status: 400 });
  }
  const { words, kanji } = resolved;

  if (skill === "reading" && words.length === 0) {
    return NextResponse.json({ error: t.api.nothingToMark }, { status: 404 });
  }
  if (skill === "writing" && kanji.length === 0) {
    return NextResponse.json({ error: "Writing is marked by kanji or by lesson" }, { status: 400 });
  }

  try {
    if (skill === "reading") await (undo ? unmarkWords : markWordsKnown)(user.id, words);
    else await (undo ? unmarkWriting : markWritingKnown)(user.id, kanji);
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
