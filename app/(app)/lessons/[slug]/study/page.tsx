import { notFound } from "next/navigation";
import { getLesson } from "@/lib/content";
import { getLessonProgress, getWordProgress } from "@/lib/progress";
import { StudySession } from "@/components/app/StudySession";

export const dynamic = "force-dynamic";

export function generateMetadata({ params }: { params: { slug: string } }) {
  const lesson = getLesson(params.slug);
  return { title: lesson ? `Studying ${lesson.title} — Kanjikan` : "Study — Kanjikan" };
}

export default async function StudyPage({ params }: { params: { slug: string } }) {
  const lesson = getLesson(params.slug);
  if (!lesson) notFound();

  const [progress, lessonRows] = await Promise.all([getWordProgress(), getLessonProgress()]);

  // Resume from the checkpoint. A cursor at or past the end means the lesson
  // was finished, so starting it again should cover the whole thing rather
  // than presenting an empty queue.
  const saved = lessonRows.get(lesson.slug)?.cursor ?? 0;
  const offset = saved > 0 && saved < lesson.words.length ? saved : 0;
  const words = lesson.words.slice(offset);

  const stages: Record<string, number> = {};
  for (const w of words) {
    const p = progress.get(w.id);
    if (p) stages[w.id] = p.srs_stage;
  }

  return (
    <div style={{ maxWidth: 620, margin: "0 auto" }}>
      <StudySession
        mode="lesson"
        lessonSlug={lesson.slug}
        lessonTitle={lesson.title}
        words={words}
        stages={stages}
        cursorOffset={offset}
        lessonLength={lesson.words.length}
        // Seeded on the server so the server render and the client hydration
        // build the same queue. Changes per visit, so repeating a lesson
        // shuffles differently.
        seed={Date.now() % 2147483647}
      />
    </div>
  );
}
