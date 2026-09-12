import "server-only";
import { createClient } from "@/lib/supabase/server";
import { getAllWords, getKanji, getLessons, type Kanji, type Level, type Word } from "@/lib/content";
import { bandFor, grade, KNOWN_STAGE, streakFromDates, type MasteryBand } from "@/lib/srs";

export type WordProgressRow = {
  word_id: string;
  lesson_slug: string;
  srs_stage: number;
  correct_count: number;
  incorrect_count: number;
  streak: number;
  due_at: string;
  last_reviewed_at: string | null;
};

export type KanjiProgressRow = {
  char: string;
  recognition_stage: number;
  writing_stage: number;
  correct_count: number;
  incorrect_count: number;
  due_at: string;
  last_reviewed_at: string | null;
};

export type LessonProgressRow = {
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
      "[kanjikan] A table is missing. Run `npm run migrate`, or `npm run doctor` to check.",
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
    .select("word_id, lesson_slug, srs_stage, correct_count, incorrect_count, streak, due_at, last_reviewed_at")
    .eq("level", level);
  report("getWordProgress", error);
  return new Map((data ?? []).map((r) => [r.word_id as string, r as WordProgressRow]));
}

export async function getKanjiProgress(level: Level = "N5"): Promise<Map<string, KanjiProgressRow>> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("kanji_progress")
    .select("char, recognition_stage, writing_stage, correct_count, incorrect_count, due_at, last_reviewed_at")
    .eq("level", level);
  report("getKanjiProgress", error);
  return new Map((data ?? []).map((r) => [r.char as string, r as KanjiProgressRow]));
}

export async function getLessonProgress(level: Level = "N5"): Promise<Map<string, LessonProgressRow>> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("lesson_progress")
    .select("lesson_slug, status, cursor, completed_at")
    .eq("level", level);
  report("getLessonProgress", error);
  return new Map((data ?? []).map((r) => [r.lesson_slug as string, r as LessonProgressRow]));
}

export type ProgressMaps = {
  words: Map<string, WordProgressRow>;
  kanji: Map<string, KanjiProgressRow>;
  lessons: Map<string, LessonProgressRow>;
};

/**
 * All of a learner's stored progress, or none for a guest.
 *
 * A guest has no rows by definition, so their queries are skipped rather than
 * sent for Row Level Security to answer with nothing.
 */
export async function getProgress(user: { id: string } | null, level: Level = "N5"): Promise<ProgressMaps> {
  if (!user) return { words: new Map(), kanji: new Map(), lessons: new Map() };
  const [words, kanji, lessons] = await Promise.all([
    getWordProgress(level),
    getKanjiProgress(level),
    getLessonProgress(level),
  ]);
  return { words, kanji, lessons };
}

export type LessonSummary = {
  slug: string;
  title: string;
  summary: string;
  order: number;
  kanji: string[];
  /** Characters whose recognition has reached the known stage. */
  kanjiKnown: number;
  /** Characters that can also be written from memory. */
  kanjiWritten: number;
  words: number;
  wordsKnown: number;
  due: number;
  status: "not_started" | "learning" | "completed";
  cursor: number;
  percent: number;
};

/**
 * One row per lesson, merging file content with this user's stored progress.
 *
 * Percentage is measured in kanji, not words: the curriculum is spined on
 * characters, so "half done" should mean half the characters are known, not
 * half the vocabulary answered.
 */
export async function getLessonSummaries(
  level: Level = "N5",
  preloaded?: Partial<ProgressMaps>,
): Promise<LessonSummary[]> {
  const words = preloaded?.words ?? (await getWordProgress(level));
  const kanjiRows = preloaded?.kanji ?? (await getKanjiProgress(level));
  const lessonRows = preloaded?.lessons ?? (await getLessonProgress(level));
  const now = Date.now();

  return getLessons(level).map((lesson) => {
    let kanjiKnown = 0;
    let kanjiWritten = 0;
    let started = 0;

    for (const k of lesson.kanji) {
      const p = kanjiRows.get(k.char);
      if (!p) continue;
      started++;
      if (p.recognition_stage >= KNOWN_STAGE) kanjiKnown++;
      if (p.writing_stage >= KNOWN_STAGE) kanjiWritten++;
    }

    let wordsKnown = 0;
    let due = 0;
    for (const w of lesson.words) {
      const p = words.get(w.id);
      if (!p) continue;
      started++;
      if (p.srs_stage >= KNOWN_STAGE) wordsKnown++;
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
      kanji: lesson.kanji.map((k) => k.char),
      kanjiKnown,
      kanjiWritten,
      words: lesson.words.length,
      wordsKnown,
      due,
      status,
      cursor: row?.cursor ?? 0,
      percent: lesson.kanji.length ? Math.round((kanjiKnown / lesson.kanji.length) * 100) : 0,
    };
  });
}

export type DashboardData = {
  profile: Profile;
  totalKanji: number;
  kanjiStarted: number;
  kanjiKnown: number;
  kanjiWritten: number;
  totalWords: number;
  wordsKnown: number;
  dueNow: number;
  writingDue: number;
  streak: number;
  reviewedToday: number;
  bands: Record<MasteryBand, number>;
  activity: { label: string; value: number }[];
  nextLesson: LessonSummary | null;
  resumeLesson: LessonSummary | null;
};

export async function getDashboard(userId: string, level: Level = "N5"): Promise<DashboardData> {
  const supabase = createClient();
  const [profile, wordRows, kanjiRows, lessonRows] = await Promise.all([
    getProfile(userId),
    getWordProgress(level),
    getKanjiProgress(level),
    getLessonProgress(level),
  ]);
  const lessons = await getLessonSummaries(level, {
    words: wordRows,
    kanji: kanjiRows,
    lessons: lessonRows,
  });

  const allKanji = getKanji(level);
  const allWords = getAllWords(level);
  const now = Date.now();

  // Mastery bands describe kanji recognition — the headline metric.
  const bands: Record<MasteryBand, number> = { new: 0, learning: 0, known: 0, mastered: 0 };
  let kanjiKnown = 0;
  let kanjiWritten = 0;
  let writingDue = 0;
  for (const k of allKanji) {
    const p = kanjiRows.get(k.char);
    bands[bandFor(p?.recognition_stage)]++;
    if ((p?.recognition_stage ?? 0) >= KNOWN_STAGE) kanjiKnown++;
    if ((p?.writing_stage ?? 0) >= KNOWN_STAGE) kanjiWritten++;
    if (p && p.writing_stage > 0 && new Date(p.due_at).getTime() <= now) writingDue++;
  }

  let wordsKnown = 0;
  let dueNow = 0;
  for (const w of allWords) {
    const p = wordRows.get(w.id);
    if (!p) continue;
    if (p.srs_stage >= KNOWN_STAGE) wordsKnown++;
    if (new Date(p.due_at).getTime() <= now) dueNow++;
  }

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
    totalKanji: allKanji.length,
    kanjiStarted: bands.learning + bands.known + bands.mastered,
    kanjiKnown,
    kanjiWritten,
    totalWords: allWords.length,
    wordsKnown,
    dueNow,
    writingDue,
    streak: streakFromDates(rows.map((s) => s.created_at as string)),
    reviewedToday: byDay.get(new Date(now).toDateString()) ?? 0,
    bands,
    activity,
    nextLesson: lessons.find((l) => l.status === "not_started") ?? null,
    resumeLesson,
  };
}

/** Words due for review, most overdue first. */
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

/** Characters due for writing practice, most overdue first. */
export async function getWritingQueue(level: Level = "N5", limit = 12): Promise<Kanji[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("kanji_progress")
    .select("char, due_at, writing_stage")
    .eq("level", level)
    .gt("writing_stage", 0)
    .lte("due_at", new Date().toISOString())
    .order("due_at", { ascending: true })
    .limit(limit);
  report("getWritingQueue", error);

  const order = new Map((data ?? []).map((r, i) => [r.char as string, i]));
  return getKanji(level)
    .filter((k) => order.has(k.char))
    .sort((a, b) => order.get(a.char)! - order.get(b.char)!);
}

/** Applies one graded answer to a word. Upserts because the first has no row. */
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

/**
 * Applies one graded answer to a character.
 *
 * Recognition and writing advance independently — being able to read 語 says
 * nothing about being able to write it — but they share one due date, so a
 * character comes back as a single item rather than nagging twice.
 */
export async function recordKanjiAnswer(
  userId: string,
  kanji: Kanji,
  correct: boolean,
  skill: "recognition" | "writing",
) {
  const supabase = createClient();

  const { data: existing } = await supabase
    .from("kanji_progress")
    .select("recognition_stage, writing_stage, correct_count, incorrect_count, due_at, last_reviewed_at")
    .eq("char", kanji.char)
    .maybeSingle();

  const column = skill === "writing" ? "writing_stage" : "recognition_stage";
  const currentStage = (existing?.[column] as number | undefined) ?? 0;

  const next = grade(
    {
      srs_stage: currentStage,
      correct_count: existing?.correct_count ?? 0,
      incorrect_count: existing?.incorrect_count ?? 0,
      streak: 0,
      due_at: existing?.due_at ?? new Date().toISOString(),
      last_reviewed_at: existing?.last_reviewed_at ?? null,
    },
    correct,
  );

  const { error } = await supabase.from("kanji_progress").upsert(
    {
      user_id: userId,
      char: kanji.char,
      level: kanji.level,
      recognition_stage:
        skill === "recognition" ? next.srs_stage : (existing?.recognition_stage ?? 0),
      writing_stage: skill === "writing" ? next.srs_stage : (existing?.writing_stage ?? 0),
      correct_count: next.correct_count,
      incorrect_count: next.incorrect_count,
      // The sooner of the two skills decides when the character resurfaces.
      due_at:
        existing?.due_at && new Date(existing.due_at) < new Date(next.due_at)
          ? existing.due_at
          : next.due_at,
      last_reviewed_at: next.last_reviewed_at,
    },
    { onConflict: "user_id,char" },
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
  mode: "lesson" | "review" | "writing",
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

/** Number of words currently due, for the nav badge. */
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
