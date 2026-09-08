import { NextResponse } from "next/server";
import { getUser } from "@/lib/supabase/server";
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

  if (typeof lessonSlug !== "string" || !getLesson(lessonSlug)) {
    return NextResponse.json({ error: "Unknown lesson" }, { status: 400 });
  }
  if (!Number.isInteger(cursor) || cursor < 0) {
    return NextResponse.json({ error: "cursor must be a non-negative integer" }, { status: 400 });
  }

  await saveCheckpoint(user.id, "N5", lessonSlug, cursor, completed);
  return NextResponse.json({ ok: true });
}
