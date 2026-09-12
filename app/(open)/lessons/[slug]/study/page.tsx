import { notFound } from "next/navigation";
import { getLesson } from "@/lib/content";
import { getUser } from "@/lib/auth";
import { getProgress } from "@/lib/progress";
import { StudySession } from "@/components/app/StudySession";

export const dynamic = "force-dynamic";

export default async function StudyPage({ params }: { params: { slug: string } }) {
  const lesson = getLesson(params.slug);
  if (!lesson) notFound();

  // A guest has no stored rows, so they always start at the first character
  // and every card is built as if the words were new.
  const user = await getUser();
  const { words: wordRows, kanji: kanjiRows, lessons: lessonRows } = await getProgress(user);

  // The checkpoint counts characters finished, so resuming starts at the next
  // one. A cursor at or past the end means the lesson was completed, and
  // starting it again should cover the whole thing rather than nothing.
  const saved = lessonRows.get(lesson.slug)?.cursor ?? 0;
  const offset = saved > 0 && saved < lesson.kanji.length ? saved : 0;
  const kanji = lesson.kanji.slice(offset);
  const chars = new Set(kanji.map((k) => k.char));
  const words = lesson.words.filter((w) => chars.has(w.teaches));

  const kanjiStages: Record<string, number> = {};
  for (const k of kanji) {
    const p = kanjiRows.get(k.char);
    if (p) kanjiStages[k.char] = p.recognition_stage;
  }

  const wordStages: Record<string, number> = {};
  for (const w of words) {
    const p = wordRows.get(w.id);
    if (p) wordStages[w.id] = p.srs_stage;
  }

  return (
    <div style={{ maxWidth: 620, margin: "0 auto" }}>
      <StudySession
        mode="lesson"
        guest={!user}
        lessonSlug={lesson.slug}
        lessonTitle={lesson.title}
        kanji={kanji}
        words={words}
        kanjiStages={kanjiStages}
        wordStages={wordStages}
        cursorOffset={offset}
        lessonLength={lesson.kanji.length}
        // Seeded on the server so the server render and the client hydration
        // build the same queue.
        seed={Date.now() % 2147483647}
      />
    </div>
  );
}
