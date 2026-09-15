import { NextResponse } from "next/server";
import { getUser } from "@/lib/auth";
import { saveSettings } from "@/lib/progress";

/**
 * Saves a learner's study choices. Either field may be sent alone.
 *
 *   studyWriting   boolean
 *   reviewWarning  due reviews at which a new lesson warns first, 1–500, or null for never
 */
export async function POST(request: Request) {
  const user = await getUser();
  if (!user) return NextResponse.json({ error: "Not signed in" }, { status: 401 });

  const body = await request.json().catch(() => null);
  const settings: { studyWriting?: boolean; reviewWarning?: number | null } = {};

  if (body && "studyWriting" in body) {
    if (typeof body.studyWriting !== "boolean") {
      return NextResponse.json({ error: "studyWriting must be true or false" }, { status: 400 });
    }
    settings.studyWriting = body.studyWriting;
  }
  if (body && "reviewWarning" in body) {
    const v = body.reviewWarning;
    if (v !== null && !(Number.isInteger(v) && v >= 1 && v <= 500)) {
      return NextResponse.json({ error: "reviewWarning must be 1 to 500, or null" }, { status: 400 });
    }
    settings.reviewWarning = v;
  }

  try {
    await saveSettings(user.id, settings);
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
