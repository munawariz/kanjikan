import "server-only";
import { createClient } from "@/lib/supabase/server";
import { getAllWords, getLessons, type Level, type Word } from "@/lib/content";
import { bandFor, grade, KNOWN_STAGE, streakFromDates, type MasteryBand } from "@/lib/srs";

export type WordProgressRow = {
  word_id: string;
  level: string;
  lesson_slug: string;
  srs_stage: number;
  correct_count: number;
  incorrect_count: number;
  streak: number;
  due_at: string;
  last_reviewed_at: string | null;
};

export type LessonProgressRow = {
  level: string;
  lesson_slug: string;
  status: "learning" | "completed";
  cursor: number;
  completed_at: string | null;
};

export type Profile = {
  id: string;
  display_name: string;
  current_level: Level;
  current_lesson_slug: string | null;
  daily_goal: number;
};

/**
 * Every query below runs under the caller's session, so Row Level Security is
 * what actually scopes the data. user_id is passed explicitly only on writes,
 * where Postgres needs a value to store.
 */

/**
 * Reads degrade to empty rather than crashing a page, but the failure must not
 * be silent: an absent table and a learner with no progress yet both produce an
 * empty map, and telling them apart from the UI alone is impossible.
 */
function report(where: string, error: { message: string; code?: string } | null) {
  if (!error) return;
  console.error(`[kanjikan] ${where} failed: ${error.message}${error.code ? ` (${error.code})` : ""}`);
  if (error.code === "PGRST205" || error.message.includes("schema cache")) {
    console.error(
      "[kanjikan] The tables do not exist yet. Run supabase/migrations/0001_init.sql " +
        "in the Supabase SQL editor, or run `npm run doctor` to check.",
    );
  }
}

export async function getProfile(userId: string): Promise<Profile> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("profiles")
    .select("id, display_name, current_level, current_lesson_slug, daily_goal")
    .eq("id", userId)
    .maybeSingle();
  report("getProfile", error);

  // The signup trigger creates this row. Fall back to a sensible shape rather
  // than blanking the UI if it is somehow absent.
  return (
    (data as Profile | null) ?? {
      id: userId,
      display_name: "",
      current_level: "N5",
      current_lesson_slug: null,
      daily_goal: 20,
    }
  );
}

export async function getWordProgress(level: Level = "N5"): Promise<Map<string, WordProgressRow>> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("word_progress")
    .select("word_id, level, lesson_slug, srs_stage, correct_count, incorrect_count, streak, due_at, last_reviewed_at")
    .eq("level", level);
  report("getWordProgress", error);

  return new Map((data ?? []).map((r) => [r.word_id as string, r as WordProgressRow]));
}

export async function getLessonProgress(
  level: Level = "N5",
): Promise<Map<string, LessonProgressRow>> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("lesson_progress")
    .select("level, lesson_slug, status, cursor, completed_at")
    .eq("level", level);
  report("getLessonProgress", error);

  return new Map((data ?? []).map((r) => [r.lesson_slug as string, r as LessonProgressRow]));
}

export type LessonSummary = {
  slug: string;
  title: string;
  summary: string;
  order: number;
  total: number;
  started: number;
  known: number;
  due: number;
  status: "not_started" | "learning" | "completed";
  cursor: number;
  percent: number;
};

/**
 * One row per lesson, merging file content with this user's stored progress.
 *
 * Callers that have already loaded the progress maps pass them in; the
 * dashboard needs the same two queries for its own totals, and refetching them
 * here would triple the round trips for one page.
 */
export async function getLessonSummaries(
  level: Level = "N5",
  preloaded?: { words?: Map<string, WordProgressRow>; lessons?: Map<string, LessonProgressRow> },
): Promise<LessonSummary[]> {
  const words = preloaded?.words ?? (await getWordProgress(level));
  const lessonRows = preloaded?.lessons ?? (await getLessonProgress(level));
  const lessons = getLessons(level);
  const now = Date.now();

  return lessons.map((lesson) => {
    let started = 0;
    let known = 0;
    let due = 0;

    for (const w of lesson.words) {
      const p = words.get(w.id);
      if (!p) continue;
      started++;
      if (p.srs_stage >= KNOWN_STAGE) known++;
      if (new Date(p.due_at).getTime() <= now) due++;
    }

    const row = lessonRows.get(lesson.slug);
    const status: LessonSummary["status"] =
      row?.status === "completed" ? "completed" : started > 0 ? "learning" : "not_started";

    return {
      slug: lesson.slug,
      title: lesson.title,
      summary: lesson.summary,
      order: lesson.order,
      total: lesson.words.length,
      started,
      known,
      due,
      status,
      cursor: row?.cursor ?? 0,
      percent: lesson.words.length ? Math.round((known / lesson.words.length) * 100) : 0,
    };
  });
}

export type DashboardData = {
  profile: Profile;
  totalWords: number;
  startedWords: number;
  knownWords: number;
  dueNow: number;
  streak: number;
  reviewedToday: number;
  bands: Record<MasteryBand, number>;
  activity: { label: string; value: number }[];
  nextLesson: LessonSummary | null;
  resumeLesson: LessonSummary | null;
};

export async function getDashboard(userId: string, level: Level = "N5"): Promise<DashboardData> {
  const supabase = createClient();
  const [profile, progress, lessonRows] = await Promise.all([
    getProfile(userId),
    getWordProgress(level),
    getLessonProgress(level),
  ]);
  const lessons = await getLessonSummaries(level, { words: progress, lessons: lessonRows });
  const all = getAllWords(level);
  const now = Date.now();

  const bands: Record<MasteryBand, number> = { new: 0, learning: 0, known: 0, mastered: 0 };
  let dueNow = 0;
  for (const w of all) {
    const p = progress.get(w.id);
    bands[bandFor(p?.srs_stage)]++;
    if (p && new Date(p.due_at).getTime() <= now) dueNow++;
  }

  // Sessions from the last 30 days drive both the streak and the activity chart.
  const since = new Date(now - 29 * 86_400_000).toISOString();
  const { data: sessions, error: sessionsError } = await supabase
    .from("study_sessions")
    .select("created_at, total")
    .gte("created_at", since)
    .order("created_at", { ascending: true });

  report("getDashboard sessions", sessionsError);
  const rows = sessions ?? [];
  const byDay = new Map<string, number>();
  for (const s of rows) {
    const key = new Date(s.created_at as string).toDateString();
    byDay.set(key, (byDay.get(key) ?? 0) + Number(s.total ?? 0));
  }

  const activity: { label: string; value: number }[] = [];
  for (let i = 13; i >= 0; i--) {
    const d = new Date(now - i * 86_400_000);
    activity.push({
      label: d.toLocaleDateString(undefined, { weekday: "narrow" }),
      value: byDay.get(d.toDateString()) ?? 0,
    });
  }

  const resumeLesson =
    lessons.find((l) => l.slug === profile.current_lesson_slug && l.status !== "completed") ??
    lessons.find((l) => l.status === "learning") ??
    null;

  return {
    profile,
    totalWords: all.length,
    startedWords: bands.learning + bands.known + bands.mastered,
    knownWords: bands.known + bands.mastered,
    dueNow,
    streak: streakFromDates(rows.map((s) => s.created_at as string)),
    reviewedToday: byDay.get(new Date(now).toDateString()) ?? 0,
    bands,
    activity,
    nextLesson: lessons.find((l) => l.status === "not_started") ?? null,
    resumeLesson,
  };
}

/**
 * Words due for review, hardest first.
 *
 * Ordering by due_at ascending puts the most overdue at the front, which is the
 * behaviour a learner expects after a few days away.
 */
export async function getReviewQueue(level: Level = "N5", limit = 30): Promise<Word[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("word_progress")
    .select("word_id, due_at")
    .eq("level", level)
    .lte("due_at", new Date().toISOString())
    .order("due_at", { ascending: true })
    .limit(limit);

  report("getReviewQueue", error);
  const order = new Map((data ?? []).map((r, i) => [r.word_id as string, i]));
  return getAllWords(level)
    .filter((w) => order.has(w.id))
    .sort((a, b) => order.get(a.id)! - order.get(b.id)!);
}

/** Applies one graded answer. Upserts because the first answer has no row yet. */
export async function recordAnswer(userId: string, word: Word, correct: boolean) {
  const supabase = createClient();

  const { data: existing } = await supabase
    .from("word_progress")
    .select("srs_stage, correct_count, incorrect_count, streak, due_at, last_reviewed_at")
    .eq("word_id", word.id)
    .maybeSingle();

  const next = grade(existing ?? null, correct);

  const { error } = await supabase.from("word_progress").upsert(
    {
      user_id: userId,
      word_id: word.id,
      level: word.level,
      lesson_slug: word.lessonSlug,
      ...next,
    },
    { onConflict: "user_id,word_id" },
  );

  if (error) throw new Error(error.message);
  return next;
}

export async function saveCheckpoint(
  userId: string,
  level: Level,
  lessonSlug: string,
  cursor: number,
  completed: boolean,
) {
  const supabase = createClient();

  await supabase.from("lesson_progress").upsert(
    {
      user_id: userId,
      level,
      lesson_slug: lessonSlug,
      cursor,
      status: completed ? "completed" : "learning",
      completed_at: completed ? new Date().toISOString() : null,
    },
    { onConflict: "user_id,level,lesson_slug" },
  );

  await supabase
    .from("profiles")
    .update({ current_level: level, current_lesson_slug: lessonSlug })
    .eq("id", userId);
}

export async function recordSession(
  userId: string,
  level: Level,
  mode: "lesson" | "review",
  lessonSlug: string | null,
  total: number,
  correct: number,
) {
  const supabase = createClient();
  await supabase.from("study_sessions").insert({
    user_id: userId,
    level,
    mode,
    lesson_slug: lessonSlug,
    total,
    correct,
  });
}

/** Number of words currently due, for the nav badge. Counts rows, not content. */
export async function getDueCount(level: Level = "N5"): Promise<number> {
  const supabase = createClient();
  const { count, error } = await supabase
    .from("word_progress")
    .select("word_id", { count: "exact", head: true })
    .eq("level", level)
    .lte("due_at", new Date().toISOString());
  report("getDueCount", error);
  return count ?? 0;
}
