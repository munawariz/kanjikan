import { NextResponse } from "next/server";
import { getUser } from "@/lib/auth";
import { getAllWords, getKanjiChar, getLesson, getWordsTeaching, type Kanji, type Word } from "@/lib/content";
import { markWordsKnown, markWritingKnown, unmarkWords, unmarkWriting } from "@/lib/progress";

/**
 * "I already know this", and its undo.
 *
 *   scope  word | kanji | lesson — what `id` names (a word id, a character, a lesson slug)
 *   skill  reading | writing     — reading marks words; writing marks characters
 *   undo   true to take the mark back
 *
 * Reading a kanji or a lesson means reading the words that teach it, since
 * that is where reading mastery lives. Writing has no word scope.
 *
 * Everything is resolved against the content files, so a forged id cannot
 * write a row for something outside the curriculum.
 */
export async function POST(request: Request) {
  const user = await getUser();
  if (!user) return NextResponse.json({ error: "Not signed in" }, { status: 401 });

  const body = await request.json().catch(() => null);
  const scope = body?.scope;
  const id = body?.id;
  const skill = body?.skill === "writing" ? "writing" : "reading";
  const undo = body?.undo === true;

  if (typeof id !== "string") return NextResponse.json({ error: "id is required" }, { status: 400 });

  let words: Word[] = [];
  let kanji: Kanji[] = [];
  if (scope === "word") {
    words = getAllWords().filter((w) => w.id === id);
  } else if (scope === "kanji") {
    const k = getKanjiChar(id);
    if (k) {
      kanji = [k];
      words = getWordsTeaching(k.char);
    }
  } else if (scope === "lesson") {
    const lesson = getLesson(id);
    if (lesson) {
      kanji = lesson.kanji;
      words = lesson.words;
    }
  } else {
    return NextResponse.json({ error: "scope must be word, kanji or lesson" }, { status: 400 });
  }

  if (skill === "reading" && words.length === 0) {
    return NextResponse.json({ error: "Nothing to mark" }, { status: 404 });
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
