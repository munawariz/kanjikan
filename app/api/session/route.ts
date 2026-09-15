import { NextResponse } from "next/server";
import { getUser } from "@/lib/auth";
import { getLesson } from "@/lib/content";
import { getProfile, recordSession } from "@/lib/progress";

/** Logs a finished run. Streaks and the activity chart are built from these. */
export async function POST(request: Request) {
  const user = await getUser();
  if (!user) return NextResponse.json({ error: "Not signed in" }, { status: 401 });

  const body = await request.json().catch(() => null);
  const mode = body?.mode === "review" ? "review" : "lesson";
  const total = Number(body?.total ?? 0);
  const correct = Number(body?.correct ?? 0);
  const lesson = typeof body?.lessonSlug === "string" ? getLesson(body.lessonSlug) : undefined;

  if (!Number.isFinite(total) || total <= 0) {
    return NextResponse.json({ error: "total must be positive" }, { status: 400 });
  }

  // A lesson belongs to one level. A review can mix levels, so it is logged
  // against the one the learner is working through.
  const level = lesson?.level ?? (await getProfile(user.id)).current_level;
  await recordSession(user.id, level, mode, lesson?.slug ?? null, total, Math.min(correct, total));
  return NextResponse.json({ ok: true });
}
