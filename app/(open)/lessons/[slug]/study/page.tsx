import { notFound } from "next/navigation";
import { getLesson } from "@/lib/content";
import { getUser } from "@/lib/auth";
import { getDueCounts, getProfile, getProgress, reviewsDue, studiesWriting } from "@/lib/progress";
import { StudySession } from "@/components/app/StudySession";

export const dynamic = "force-dynamic";

export default async function StudyPage({ params }: { params: { slug: string } }) {
  const lesson = getLesson(params.slug);
  if (!lesson) notFound();

  // A guest has no stored rows, so they always start at the first character
  // and every card is built as if the words were new.
  const user = await getUser();
  const [{ words: wordRows, kanji: kanjiRows, lessons: lessonRows }, profile, due] = await Promise.all([
    getProgress(user),
    user ? getProfile(user.id) : null,
    user ? getDueCounts(user.id) : null,
  ]);

  // Advice, never a lock: the session shows it before the first card, with a
  // way straight past it.
  const waiting = profile && due ? reviewsDue(due, profile) : 0;
  const warn = profile?.review_warning != null && waiting >= profile.review_warning;

  // The checkpoint counts characters finished, so resuming starts at the next
  // one. A cursor at or past the end means the lesson was completed, and
  // starting it again should cover the whole thing rather than nothing.
  const saved = lessonRows.get(lesson.slug)?.cursor ?? 0;
  const offset = saved > 0 && saved < lesson.kanji.length ? saved : 0;
  const kanji = lesson.kanji.slice(offset);
  const chars = new Set(kanji.map((k) => k.char));
  const words = lesson.words.filter((w) => chars.has(w.teaches));

  const wordStages: Record<string, number> = {};
  const seenKanji = new Set<string>();
  const markedWords: string[] = [];
  for (const w of words) {
    const p = wordRows.get(w.id);
    if (!p) continue;
    wordStages[w.id] = p.srs_stage;
    seenKanji.add(w.teaches);
    if (p.marked_at) markedWords.push(w.id);
  }
  const markedWriting = kanji.filter((k) => kanjiRows.get(k.char)?.writing_marked_at).map((k) => k.char);

  return (
    <div style={{ maxWidth: 620, margin: "0 auto" }}>
      <StudySession
        mode="lesson"
        guest={!user}
        lessonSlug={lesson.slug}
        lessonTitle={lesson.title}
        kanji={kanji}
        words={words}
        wordStages={wordStages}
        seenKanji={[...seenKanji]}
        markedWords={markedWords}
        markedWriting={markedWriting}
        writing={studiesWriting(profile)}
        reviewsWaiting={warn ? waiting : undefined}
        cursorOffset={offset}
        lessonLength={lesson.kanji.length}
        // Seeded on the server so the server render and the client hydration
        // build the same queue.
        seed={Date.now() % 2147483647}
      />
    </div>
  );
}
