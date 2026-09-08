import { NextResponse } from "next/server";
import { getUser } from "@/lib/supabase/server";
import { recordSession } from "@/lib/progress";

/** Logs a finished run. Streaks and the activity chart are built from these. */
export async function POST(request: Request) {
  const user = await getUser();
  if (!user) return NextResponse.json({ error: "Not signed in" }, { status: 401 });

  const body = await request.json().catch(() => null);
  const mode = body?.mode === "review" ? "review" : "lesson";
  const total = Number(body?.total ?? 0);
  const correct = Number(body?.correct ?? 0);
  const lessonSlug = typeof body?.lessonSlug === "string" ? body.lessonSlug : null;

  if (!Number.isFinite(total) || total <= 0) {
    return NextResponse.json({ error: "total must be positive" }, { status: 400 });
  }

  await recordSession(user.id, "N5", mode, lessonSlug, total, Math.min(correct, total));
  return NextResponse.json({ ok: true });
}
