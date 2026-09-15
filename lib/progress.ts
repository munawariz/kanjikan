import "server-only";
import { asUser, type Db } from "@/lib/db";
import { getAllWords, getKanji, getLessons, type Kanji, type Level, type Word } from "@/lib/content";
import {
  dueAfter,
  grade,
  kanjiReading,
  KNOWN_STAGE,
  streakFromDates,
  type KanjiReading,
  type MarkState,
  type MasteryBand,
  type Progress,
} from "@/lib/srs";
import { buildDailyQuiz, type KanjiQuizCard } from "@/lib/study";
import { DAILY_QUIZ_SIZE, dailySeed, localDate } from "@/lib/daily";

export type WordProgressRow = {
  word_id: string;
  lesson_slug: string;
  srs_stage: number;
  correct_count: number;
  incorrect_count: number;
  streak: number;
  due_at: string;
  last_reviewed_at: string | null;
  /**
   * Set while the word stands at known because the learner said they knew it,
   * until its first check settles the mark one way or the other.
   */
  marked_at: string | null;
  created_at: string;
};

/**
 * A character's writing. Its reading is not stored: it comes from its words
 * (see getKanjiReadings). The table's recognition_stage and due_at columns are
 * from before that, and nothing reads them.
 */
export type KanjiProgressRow = {
  char: string;
  writing_stage: number;
  /** Null for a character that has never been written. */
  writing_due_at: string | null;
  writing_marked_at: string | null;
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
  /** Null until the learner has chosen. Read it through {@link studiesWriting}. */
  study_writing: boolean | null;
  /** Due reviews at which starting a lesson warns first. Null never warns. */
  review_warning: number | null;
};

/**
 * Whether writing is part of this learner's study. Until they choose it is,
 * which is how the app worked before there was a choice.
 */
export function studiesWriting(profile: Pick<Profile, "study_writing"> | null): boolean {
  return profile?.study_writing !== false;
}

/**
 * Every query runs through asUser, as the account it belongs to, so row level
 * security scopes the data: a query cannot return another learner's rows even
 * if it forgets to ask for this one's. The explicit user_id filters are for
 * the indexes, which are keyed on it, not for safety.
 */

function report(where: string, e: unknown) {
  const err = e as { message?: string; code?: string };
  console.error(`[kanjikan] ${where} failed: ${err.message}${err.code ? ` (${err.code})` : ""}`);
  if (err.code === "42P01" || err.code === "42703") {
    console.error("[kanjikan] A table or column is missing. Run `npm run migrate`, or `npm run doctor` to check.");
  }
}

/**
 * Reads degrade to a fallback rather than crashing a page, but the failure must
 * not be silent: an absent table and a learner with no progress yet both
 * produce an empty map, and telling them apart from the UI alone is impossible.
 */
async function read<T>(where: string, userId: string, fallback: T, fn: (db: Db) => Promise<T>): Promise<T> {
  try {
    return await asUser(userId, fn);
  } catch (e) {
    report(where, e);
    return fallback;
  }
}

export async function getProfile(userId: string): Promise<Profile> {
  const fallback: Profile = {
    id: userId,
    display_name: "",
    current_level: "N5",
    current_lesson_slug: null,
    daily_goal: 20,
    study_writing: null,
    review_warning: 20,
  };
  return read("getProfile", userId, fallback, async (db) => {
    const { rows } = await db.query<Profile>(
      `select id, display_name, current_level, current_lesson_slug, daily_goal, study_writing, review_warning
         from public.profiles where id = $1`,
      [userId],
    );
    return rows[0] ?? fallback;
  });
}

export async function getWordProgress(userId: string, level: Level = "N5"): Promise<Map<string, WordProgressRow>> {
  return read("getWordProgress", userId, new Map(), async (db) => {
    const { rows } = await db.query<WordProgressRow>(
      `select word_id, lesson_slug, srs_stage, correct_count, incorrect_count, streak, due_at, last_reviewed_at,
              marked_at, created_at
         from public.word_progress where user_id = $1 and level = $2`,
      [userId, level],
    );
    return new Map(rows.map((r) => [r.word_id, r]));
  });
}

export async function getKanjiProgress(userId: string, level: Level = "N5"): Promise<Map<string, KanjiProgressRow>> {
  return read("getKanjiProgress", userId, new Map(), async (db) => {
    const { rows } = await db.query<KanjiProgressRow>(
      `select char, writing_stage, writing_due_at, writing_marked_at
         from public.kanji_progress where user_id = $1 and level = $2`,
      [userId, level],
    );
    return new Map(rows.map((r) => [r.char, r]));
  });
}

export async function getLessonProgress(userId: string, level: Level = "N5"): Promise<Map<string, LessonProgressRow>> {
  return read("getLessonProgress", userId, new Map(), async (db) => {
    const { rows } = await db.query<LessonProgressRow>(
      `select lesson_slug, status, cursor, completed_at
         from public.lesson_progress where user_id = $1 and level = $2`,
      [userId, level],
    );
    return new Map(rows.map((r) => [r.lesson_slug, r]));
  });
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
 * sent for row level security to answer with nothing.
 */
export async function getProgress(user: { id: string } | null, level: Level = "N5"): Promise<ProgressMaps> {
  if (!user) return { words: new Map(), kanji: new Map(), lessons: new Map() };
  const [words, kanji, lessons] = await Promise.all([
    getWordProgress(user.id, level),
    getKanjiProgress(user.id, level),
    getLessonProgress(user.id, level),
  ]);
  return { words, kanji, lessons };
}

/**
 * Every kanji's reading mastery, worked out from the words that teach it.
 * See kanjiReading in lib/srs.ts for the rule.
 */
export function getKanjiReadings(
  words: Map<string, Pick<WordProgressRow, "srs_stage">>,
  level: Level = "N5",
): Map<string, KanjiReading> {
  const stages = new Map<string, number[]>();
  for (const w of getAllWords(level)) {
    const list = stages.get(w.teaches) ?? [];
    list.push(words.get(w.id)?.srs_stage ?? 0);
    stages.set(w.teaches, list);
  }
  return new Map(getKanji(level).map((k) => [k.char, kanjiReading(stages.get(k.char) ?? [])]));
}

/** What "I already know this" can do for a set of words. */
export function wordMarkState(words: Word[], rows: Map<string, WordProgressRow>): MarkState {
  let markable = 0;
  let marked = 0;
  for (const w of words) {
    const r = rows.get(w.id);
    if (r?.marked_at) marked++;
    else if ((r?.srs_stage ?? 0) < KNOWN_STAGE) markable++;
  }
  return { markable, marked };
}

/** The same for the writing of a set of characters. */
export function writingMarkState(chars: string[], rows: Map<string, KanjiProgressRow>): MarkState {
  let markable = 0;
  let marked = 0;
  for (const c of chars) {
    const r = rows.get(c);
    if (r?.writing_marked_at) marked++;
    else if ((r?.writing_stage ?? 0) < KNOWN_STAGE) markable++;
  }
  return { markable, marked };
}

export type LessonSummary = {
  slug: string;
  title: string;
  summary: string;
  order: number;
  kanji: string[];
  /** Each character's reading band, in the same order as `kanji`. */
  bands: MasteryBand[];
  /** Characters most of whose words are known. */
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
 * One row per lesson, merging file content with a learner's stored progress.
 *
 * Percentage is measured in kanji, not words: the curriculum is spined on
 * characters, so "half done" should mean half the characters are known, not
 * half the vocabulary answered. Whether a character is known comes from its
 * words, so the two cannot disagree.
 */
export function getLessonSummaries(progress: ProgressMaps, level: Level = "N5"): LessonSummary[] {
  const now = Date.now();
  const readings = getKanjiReadings(progress.words, level);

  return getLessons(level).map((lesson) => {
    const bands = lesson.kanji.map((k) => readings.get(k.char)?.band ?? "new");
    const kanjiKnown = bands.filter((b) => b === "known" || b === "mastered").length;

    let kanjiWritten = 0;
    let started = 0;
    for (const k of lesson.kanji) {
      const p = progress.kanji.get(k.char);
      if (!p) continue;
      started++;
      if (p.writing_stage >= KNOWN_STAGE) kanjiWritten++;
    }

    let wordsKnown = 0;
    let due = 0;
    for (const w of lesson.words) {
      const p = progress.words.get(w.id);
      if (!p) continue;
      started++;
      if (p.srs_stage >= KNOWN_STAGE) wordsKnown++;
      if (new Date(p.due_at).getTime() <= now) due++;
    }

    const row = progress.lessons.get(lesson.slug);
    const status: LessonSummary["status"] =
      row?.status === "completed" ? "completed" : started > 0 || row ? "learning" : "not_started";

    return {
      slug: lesson.slug,
      title: lesson.title,
      summary: lesson.summary,
      order: lesson.order,
      kanji: lesson.kanji.map((k) => k.char),
      bands,
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
  studyWriting: boolean;
  /** The rows everything below is computed from, for pages that need more. */
  progress: ProgressMaps;
  lessons: LessonSummary[];
  totalKanji: number;
  kanjiStarted: number;
  kanjiKnown: number;
  kanjiWritten: number;
  totalWords: number;
  wordsKnown: number;
  wordsDue: number;
  writingDue: number;
  /** Everything waiting in Review: words, and writing for a learner who studies it. */
  dueNow: number;
  streak: number;
  reviewedToday: number;
  bands: Record<MasteryBand, number>;
  activity: { label: string; value: number }[];
  nextLesson: LessonSummary | null;
  resumeLesson: LessonSummary | null;
};

export async function getDashboard(userId: string, level: Level = "N5"): Promise<DashboardData> {
  const now = Date.now();
  const since = new Date(now - 29 * 86_400_000).toISOString();

  const [profile, progress, sessions] = await Promise.all([
    getProfile(userId),
    getProgress({ id: userId }, level),
    read("getDashboard sessions", userId, [] as { created_at: string; total: number }[], async (db) => {
      const { rows } = await db.query<{ created_at: string; total: number }>(
        `select created_at, total from public.study_sessions
          where user_id = $1 and created_at >= $2 order by created_at`,
        [userId, since],
      );
      return rows;
    }),
  ]);
  const lessons = getLessonSummaries(progress, level);
  const studyWriting = studiesWriting(profile);

  const allKanji = getKanji(level);
  const allWords = getAllWords(level);
  const readings = getKanjiReadings(progress.words, level);

  // Mastery bands describe reading, the headline metric.
  const bands: Record<MasteryBand, number> = { new: 0, learning: 0, known: 0, mastered: 0 };
  let kanjiWritten = 0;
  let writingDue = 0;
  for (const k of allKanji) {
    bands[readings.get(k.char)?.band ?? "new"]++;
    const p = progress.kanji.get(k.char);
    if ((p?.writing_stage ?? 0) >= KNOWN_STAGE) kanjiWritten++;
    if (p && p.writing_stage > 0 && p.writing_due_at && new Date(p.writing_due_at).getTime() <= now) writingDue++;
  }

  let wordsKnown = 0;
  let wordsDue = 0;
  for (const w of allWords) {
    const p = progress.words.get(w.id);
    if (!p) continue;
    if (p.srs_stage >= KNOWN_STAGE) wordsKnown++;
    if (new Date(p.due_at).getTime() <= now) wordsDue++;
  }

  const byDay = new Map<string, number>();
  for (const s of sessions) {
    const key = new Date(s.created_at).toDateString();
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
    studyWriting,
    progress,
    lessons,
    totalKanji: allKanji.length,
    kanjiStarted: bands.learning + bands.known + bands.mastered,
    kanjiKnown: bands.known + bands.mastered,
    kanjiWritten,
    totalWords: allWords.length,
    wordsKnown,
    wordsDue,
    writingDue,
    dueNow: wordsDue + (studyWriting ? writingDue : 0),
    streak: streakFromDates(sessions.map((s) => s.created_at)),
    reviewedToday: byDay.get(new Date(now).toDateString()) ?? 0,
    bands,
    activity,
    nextLesson: lessons.find((l) => l.status === "not_started") ?? null,
    resumeLesson,
  };
}

/** Words due for review, most overdue first. */
export async function getReviewQueue(userId: string, level: Level = "N5", limit = 30): Promise<Word[]> {
  const due = await read("getReviewQueue", userId, [] as { word_id: string }[], async (db) => {
    const { rows } = await db.query<{ word_id: string }>(
      `select word_id from public.word_progress
        where user_id = $1 and level = $2 and due_at <= now()
        order by due_at limit $3`,
      [userId, level, limit],
    );
    return rows;
  });
  const order = new Map(due.map((r, i) => [r.word_id, i]));
  return getAllWords(level)
    .filter((w) => order.has(w.id))
    .sort((a, b) => order.get(a.id)! - order.get(b.id)!);
}

/** Characters whose writing is due, most overdue first. */
export async function getWritingReviewQueue(userId: string, level: Level = "N5", limit = 10): Promise<Kanji[]> {
  const due = await read("getWritingReviewQueue", userId, [] as { char: string }[], async (db) => {
    const { rows } = await db.query<{ char: string }>(
      `select char from public.kanji_progress
        where user_id = $1 and level = $2 and writing_stage > 0 and writing_due_at <= now()
        order by writing_due_at limit $3`,
      [userId, level, limit],
    );
    return rows;
  });
  const order = new Map(due.map((r, i) => [r.char, i]));
  return getKanji(level)
    .filter((k) => order.has(k.char))
    .sort((a, b) => order.get(a.char)! - order.get(b.char)!);
}

/**
 * Applies one graded answer to a word. Upserts because the first has no row;
 * the row is locked while it is read so two quick answers cannot both grade
 * the same starting state.
 *
 * An answer settles a mark: from here on the word is where its answers put it,
 * and there is nothing left to undo.
 */
export async function recordAnswer(userId: string, word: Word, correct: boolean) {
  return asUser(userId, async (db) => {
    const { rows } = await db.query<Progress>(
      `select srs_stage, correct_count, incorrect_count, streak, due_at, last_reviewed_at
         from public.word_progress where user_id = $1 and word_id = $2 for update`,
      [userId, word.id],
    );
    const next = grade(rows[0] ?? null, correct);
    await db.query(
      `insert into public.word_progress
         (user_id, word_id, level, lesson_slug, srs_stage, correct_count, incorrect_count, streak, due_at, last_reviewed_at)
       values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
       on conflict (user_id, word_id) do update set
         level = excluded.level,
         lesson_slug = excluded.lesson_slug,
         srs_stage = excluded.srs_stage,
         correct_count = excluded.correct_count,
         incorrect_count = excluded.incorrect_count,
         streak = excluded.streak,
         due_at = excluded.due_at,
         last_reviewed_at = excluded.last_reviewed_at,
         marked_at = null,
         pre_mark_stage = null,
         pre_mark_due_at = null`,
      [
        userId,
        word.id,
        word.level,
        word.lessonSlug,
        next.srs_stage,
        next.correct_count,
        next.incorrect_count,
        next.streak,
        next.due_at,
        next.last_reviewed_at,
      ],
    );
    return next;
  });
}

/**
 * Applies one graded answer to a character's writing.
 *
 * Writing keeps its own stage and its own due date, apart from reading: being
 * able to read 語 says nothing about being able to write it, and a learner who
 * does not study writing should never have it come due. Like a word's answer,
 * it settles any mark.
 */
export async function recordWritingAnswer(userId: string, kanji: Kanji, correct: boolean) {
  return asUser(userId, async (db) => {
    const { rows } = await db.query<{
      writing_stage: number;
      correct_count: number;
      incorrect_count: number;
      writing_due_at: string | null;
      last_reviewed_at: string | null;
    }>(
      `select writing_stage, correct_count, incorrect_count, writing_due_at, last_reviewed_at
         from public.kanji_progress where user_id = $1 and char = $2 for update`,
      [userId, kanji.char],
    );
    const existing = rows[0];

    const next = grade(
      existing
        ? {
            srs_stage: existing.writing_stage,
            correct_count: existing.correct_count,
            incorrect_count: existing.incorrect_count,
            streak: 0,
            due_at: existing.writing_due_at ?? new Date().toISOString(),
            last_reviewed_at: existing.last_reviewed_at,
          }
        : null,
      correct,
    );

    await db.query(
      `insert into public.kanji_progress
         (user_id, char, level, writing_stage, correct_count, incorrect_count, writing_due_at, last_reviewed_at)
       values ($1, $2, $3, $4, $5, $6, $7, $8)
       on conflict (user_id, char) do update set
         level = excluded.level,
         writing_stage = excluded.writing_stage,
         correct_count = excluded.correct_count,
         incorrect_count = excluded.incorrect_count,
         writing_due_at = excluded.writing_due_at,
         last_reviewed_at = excluded.last_reviewed_at,
         writing_marked_at = null,
         pre_mark_writing_stage = null,
         pre_mark_writing_due_at = null`,
      [
        userId,
        kanji.char,
        kanji.level,
        next.srs_stage,
        next.correct_count,
        next.incorrect_count,
        next.due_at,
        next.last_reviewed_at,
      ],
    );
    return next;
  });
}

/**
 * "I already know these": puts each word at the known stage, due in a week for
 * one check. Words already at known or past it, and words already marked, are
 * left as they are.
 *
 * What the word was before is kept beside the mark so it can be undone
 * exactly; a word with no row until now keeps nothing, and undoing deletes it.
 * In an update's SET list every column reads the row as it was, so the
 * pre_mark columns take the old values.
 */
export async function markWordsKnown(userId: string, words: Word[]) {
  if (words.length === 0) return;
  await asUser(userId, (db) =>
    db.query(
      `insert into public.word_progress as p (user_id, word_id, level, lesson_slug, srs_stage, due_at, marked_at)
       select $1, w.id, w.lvl, w.slug, $5, $6, now()
         from unnest($2::text[], $3::text[], $4::text[]) as w(id, lvl, slug)
       on conflict (user_id, word_id) do update set
         pre_mark_stage = p.srs_stage,
         pre_mark_due_at = p.due_at,
         srs_stage = excluded.srs_stage,
         due_at = excluded.due_at,
         marked_at = excluded.marked_at
       where p.srs_stage < excluded.srs_stage and p.marked_at is null`,
      [
        userId,
        words.map((w) => w.id),
        words.map((w) => w.level),
        words.map((w) => w.lessonSlug),
        KNOWN_STAGE,
        dueAfter(KNOWN_STAGE),
      ],
    ),
  );
}

/** Undoes {@link markWordsKnown} for whichever of these words are still marked. */
export async function unmarkWords(userId: string, words: Word[]) {
  if (words.length === 0) return;
  const ids = words.map((w) => w.id);
  await asUser(userId, async (db) => {
    await db.query(
      `delete from public.word_progress
        where user_id = $1 and word_id = any($2) and marked_at is not null and pre_mark_stage is null`,
      [userId, ids],
    );
    await db.query(
      `update public.word_progress
          set srs_stage = pre_mark_stage, due_at = pre_mark_due_at,
              marked_at = null, pre_mark_stage = null, pre_mark_due_at = null
        where user_id = $1 and word_id = any($2) and marked_at is not null`,
      [userId, ids],
    );
  });
}

/** "I can already write these": the same as {@link markWordsKnown}, for writing. */
export async function markWritingKnown(userId: string, kanji: Kanji[]) {
  if (kanji.length === 0) return;
  await asUser(userId, (db) =>
    db.query(
      `insert into public.kanji_progress as p (user_id, char, level, writing_stage, writing_due_at, writing_marked_at)
       select $1, c.ch, c.lvl, $4, $5, now()
         from unnest($2::text[], $3::text[]) as c(ch, lvl)
       on conflict (user_id, char) do update set
         pre_mark_writing_stage = p.writing_stage,
         pre_mark_writing_due_at = p.writing_due_at,
         writing_stage = excluded.writing_stage,
         writing_due_at = excluded.writing_due_at,
         writing_marked_at = excluded.writing_marked_at
       where p.writing_stage < excluded.writing_stage and p.writing_marked_at is null`,
      [userId, kanji.map((k) => k.char), kanji.map((k) => k.level), KNOWN_STAGE, dueAfter(KNOWN_STAGE)],
    ),
  );
}

/** Undoes {@link markWritingKnown} for whichever of these characters are still marked. */
export async function unmarkWriting(userId: string, kanji: Kanji[]) {
  if (kanji.length === 0) return;
  const chars = kanji.map((k) => k.char);
  await asUser(userId, async (db) => {
    await db.query(
      `delete from public.kanji_progress
        where user_id = $1 and char = any($2) and writing_marked_at is not null and pre_mark_writing_stage is null`,
      [userId, chars],
    );
    await db.query(
      `update public.kanji_progress
          set writing_stage = pre_mark_writing_stage, writing_due_at = pre_mark_writing_due_at,
              writing_marked_at = null, pre_mark_writing_stage = null, pre_mark_writing_due_at = null
        where user_id = $1 and char = any($2) and writing_marked_at is not null`,
      [userId, chars],
    );
  });
}

export async function saveSettings(
  userId: string,
  settings: { studyWriting?: boolean; reviewWarning?: number | null },
) {
  await asUser(userId, async (db) => {
    if (settings.studyWriting !== undefined) {
      await db.query(`update public.profiles set study_writing = $2 where id = $1`, [userId, settings.studyWriting]);
    }
    if (settings.reviewWarning !== undefined) {
      await db.query(`update public.profiles set review_warning = $2 where id = $1`, [userId, settings.reviewWarning]);
    }
  });
}

export async function saveCheckpoint(
  userId: string,
  level: Level,
  lessonSlug: string,
  cursor: number,
  completed: boolean,
) {
  await asUser(userId, async (db) => {
    await db.query(
      `insert into public.lesson_progress (user_id, level, lesson_slug, cursor, status, completed_at)
       values ($1, $2, $3, $4, $5, $6)
       on conflict (user_id, level, lesson_slug) do update set
         cursor = excluded.cursor,
         status = excluded.status,
         completed_at = excluded.completed_at`,
      [userId, level, lessonSlug, cursor, completed ? "completed" : "learning", completed ? new Date().toISOString() : null],
    );
    await db.query(`update public.profiles set current_level = $2, current_lesson_slug = $3 where id = $1`, [
      userId,
      level,
      lessonSlug,
    ]);
  });
}

export async function recordSession(
  userId: string,
  level: Level,
  mode: "lesson" | "review",
  lessonSlug: string | null,
  total: number,
  correct: number,
) {
  await asUser(userId, (db) =>
    db.query(
      `insert into public.study_sessions (user_id, level, mode, lesson_slug, total, correct)
       values ($1, $2, $3, $4, $5, $6)`,
      [userId, level, mode, lessonSlug, total, correct],
    ),
  );
}

export type DailyAnswerRow = {
  position: number;
  char: string;
  answer: string;
  chosen: string;
  correct: boolean;
};

export type DailyQuiz = {
  date: string;
  /** Characters first studied before this date — the pool the quiz draws on. */
  learned: number;
  /** The whole day's quiz in order, answered or not. Empty until enough are learned. */
  questions: KanjiQuizCard[];
  /** What has been answered so far, by position. */
  answers: DailyAnswerRow[];
  /** Reading stage per learned character, for the record. */
  stages: Map<string, number>;
};

/**
 * One learner's quiz for one day.
 *
 * Built rather than stored: the questions follow from the date and the
 * characters learned before it, so every reload shows the same five and the
 * answer route can rebuild them to grade an answer itself.
 *
 * A character is learned from the day the first of its words was studied or
 * marked known. "Before the date", not "by": today's characters join tomorrow.
 * That holds the pool still for the whole day, so a half-finished quiz cannot
 * change under the learner, and it keeps the quiz from asking about something
 * taught ten minutes ago — which would measure short-term recall rather than
 * whether it stuck.
 */
export async function getDailyQuiz(
  userId: string,
  date: string,
  timeZone: string,
  level: Level = "N5",
): Promise<DailyQuiz> {
  type Studied = { word_id: string; srs_stage: number; created_at: string };
  const [progress, answers] = await Promise.all([
    read("getDailyQuiz progress", userId, [] as Studied[], async (db) => {
      const { rows } = await db.query<Studied>(
        `select word_id, srs_stage, created_at from public.word_progress where user_id = $1 and level = $2`,
        [userId, level],
      );
      return rows;
    }),
    read("getDailyQuiz answers", userId, [] as DailyAnswerRow[], async (db) => {
      const { rows } = await db.query<DailyAnswerRow>(
        `select position, char, answer, chosen, correct from public.daily_quiz_answers
          where user_id = $1 and level = $2 and quiz_date = $3 order by position`,
        [userId, level, date],
      );
      return rows;
    }),
  ]);

  const rows = new Map(progress.map((r) => [r.word_id, r]));
  const learnedChars = new Set<string>();
  for (const w of getAllWords(level)) {
    const r = rows.get(w.id);
    // YYYY-MM-DD compares correctly as a string.
    if (r && localDate(timeZone, new Date(r.created_at)) < date) learnedChars.add(w.teaches);
  }

  const readings = getKanjiReadings(rows, level);
  const stages = new Map<string, number>();
  for (const c of learnedChars) stages.set(c, readings.get(c)?.stage ?? 0);

  // Curriculum order, so the shuffle has the same input on every rebuild.
  const all = getKanji(level);
  const learned = all.filter((k) => learnedChars.has(k.char));
  const questions =
    learned.length >= DAILY_QUIZ_SIZE
      ? buildDailyQuiz(learned, all, DAILY_QUIZ_SIZE, dailySeed(userId, date))
      : [];

  return { date, learned: learned.length, questions, answers, stages };
}

export type DailyAnswerResult =
  | { status: "recorded"; correct: boolean }
  /** The position already had an answer. The first one stands. */
  | { status: "already-answered" }
  | { status: "invalid"; reason: string };

/**
 * Grades one daily quiz answer and stores it.
 *
 * The browser sends only which option was picked. The question is rebuilt
 * here and graded against the rebuild, so the stored verdict — and the
 * character, and the options — are the server's, not the client's.
 */
export async function recordDailyAnswer(
  userId: string,
  date: string,
  timeZone: string,
  position: number,
  choiceId: string,
  level: Level = "N5",
): Promise<DailyAnswerResult> {
  const quiz = await getDailyQuiz(userId, date, timeZone, level);
  const card = quiz.questions[position - 1];
  if (!card) return { status: "invalid", reason: "No such question" };

  const chosen = card.choices.find((c) => c.id === choiceId);
  if (!chosen) return { status: "invalid", reason: "Not one of the options" };

  const answer = card.choices.find((c) => c.id === card.answerId)!;
  const correct = chosen.id === card.answerId;

  try {
    // A plain insert, not an upsert: there is deliberately no update policy,
    // and a second answer to the same question must not replace the first.
    await asUser(userId, (db) =>
      db.query(
        `insert into public.daily_quiz_answers
           (user_id, level, quiz_date, position, kind, char, answer, chosen, options, correct, srs_stage, time_zone)
         values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)`,
        [
          userId,
          level,
          date,
          position,
          card.kind,
          card.kanji.char,
          answer.label,
          chosen.label,
          card.choices.map((c) => c.label),
          correct,
          quiz.stages.get(card.kanji.char) ?? 0,
          timeZone,
        ],
      ),
    );
  } catch (e) {
    if ((e as { code?: string }).code === "23505") return { status: "already-answered" };
    throw e;
  }
  return { status: "recorded", correct };
}

/** Correct answers per day from `since` (inclusive), for the history strip. */
export async function getDailyHistory(
  userId: string,
  since: string,
  level: Level = "N5",
): Promise<Map<string, { answered: number; correct: number }>> {
  const rows = await read("getDailyHistory", userId, [] as { quiz_date: string; correct: boolean }[], async (db) => {
    const { rows } = await db.query<{ quiz_date: string; correct: boolean }>(
      `select quiz_date, correct from public.daily_quiz_answers
        where user_id = $1 and level = $2 and quiz_date >= $3`,
      [userId, level, since],
    );
    return rows;
  });

  const out = new Map<string, { answered: number; correct: number }>();
  for (const r of rows) {
    const day = out.get(r.quiz_date) ?? { answered: 0, correct: 0 };
    day.answered++;
    if (r.correct) day.correct++;
    out.set(r.quiz_date, day);
  }
  return out;
}

/**
 * What is waiting in Review right now, for the nav badge and the lesson
 * warning. Writing is counted whether or not the learner studies it; the
 * caller decides with {@link reviewsDue}.
 */
export async function getDueCounts(userId: string, level: Level = "N5"): Promise<{ words: number; writing: number }> {
  return read("getDueCounts", userId, { words: 0, writing: 0 }, async (db) => {
    const { rows } = await db.query<{ words: number; writing: number }>(
      `select
         (select count(*)::int from public.word_progress
           where user_id = $1 and level = $2 and due_at <= now()) as words,
         (select count(*)::int from public.kanji_progress
           where user_id = $1 and level = $2 and writing_stage > 0 and writing_due_at <= now()) as writing`,
      [userId, level],
    );
    return rows[0] ?? { words: 0, writing: 0 };
  });
}

/** The reviews that count for this learner: writing only if they study it. */
export function reviewsDue(counts: { words: number; writing: number }, profile: Pick<Profile, "study_writing">) {
  return counts.words + (studiesWriting(profile) ? counts.writing : 0);
}
