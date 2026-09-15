import { NextResponse } from "next/server";
import { getUser } from "@/lib/auth";
import { getLesson } from "@/lib/content";
import { saveCheckpoint } from "@/lib/progress";

/**
 * Stores where the learner stopped inside a lesson. Sent as the queue advances,
 * so closing the tab halfway resumes at the same card rather than the start.
 */
export async function POST(request: Request) {
  const user = await getUser();
  if (!user) return NextResponse.json({ error: "Not signed in" }, { status: 401 });

  const body = await request.json().catch(() => null);
  const lessonSlug = body?.lessonSlug;
  const cursor = Number(body?.cursor ?? 0);
  const completed = Boolean(body?.completed);

  const lesson = typeof lessonSlug === "string" ? getLesson(lessonSlug) : undefined;
  if (!lesson) {
    return NextResponse.json({ error: "Unknown lesson" }, { status: 400 });
  }
  if (!Number.isInteger(cursor) || cursor < 0) {
    return NextResponse.json({ error: "cursor must be a non-negative integer" }, { status: 400 });
  }

  await saveCheckpoint(user.id, lesson.level, lesson.slug, cursor, completed);
  return NextResponse.json({ ok: true });
}
