import "server-only";
import { asUser, type Db } from "@/lib/db";
import { getAllWords, getKanji, getLessons, type Kanji, type Level, type Word } from "@/lib/content";
import { bandFor, grade, KNOWN_STAGE, streakFromDates, type MasteryBand, type Progress } from "@/lib/srs";
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
 * Every query runs through asUser, as the account it belongs to, so row level
 * security scopes the data: a query cannot return another learner's rows even
 * if it forgets to ask for this one's. The explicit user_id filters are for
 * the indexes, which are keyed on it, not for safety.
 */

function report(where: string, e: unknown) {
  const err = e as { message?: string; code?: string };
  console.error(`[kanjikan] ${where} failed: ${err.message}${err.code ? ` (${err.code})` : ""}`);
  if (err.code === "42P01") {
    console.error("[kanjikan] A table is missing. Run `npm run migrate`, or `npm run doctor` to check.");
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
  };
  return read("getProfile", userId, fallback, async (db) => {
    const { rows } = await db.query<Profile>(
      `select id, display_name, current_level, current_lesson_slug, daily_goal
         from public.profiles where id = $1`,
      [userId],
    );
    return rows[0] ?? fallback;
  });
}

export async function getWordProgress(userId: string, level: Level = "N5"): Promise<Map<string, WordProgressRow>> {
  return read("getWordProgress", userId, new Map(), async (db) => {
    const { rows } = await db.query<WordProgressRow>(
      `select word_id, lesson_slug, srs_stage, correct_count, incorrect_count, streak, due_at, last_reviewed_at
         from public.word_progress where user_id = $1 and level = $2`,
      [userId, level],
    );
    return new Map(rows.map((r) => [r.word_id, r]));
  });
}

export async function getKanjiProgress(userId: string, level: Level = "N5"): Promise<Map<string, KanjiProgressRow>> {
  return read("getKanjiProgress", userId, new Map(), async (db) => {
    const { rows } = await db.query<KanjiProgressRow>(
      `select char, recognition_stage, writing_stage, correct_count, incorrect_count, due_at, last_reviewed_at
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
 * One row per lesson, merging file content with a learner's stored progress.
 *
 * Percentage is measured in kanji, not words: the curriculum is spined on
 * characters, so "half done" should mean half the characters are known, not
 * half the vocabulary answered.
 */
export function getLessonSummaries(progress: ProgressMaps, level: Level = "N5"): LessonSummary[] {
  const now = Date.now();

  return getLessons(level).map((lesson) => {
    let kanjiKnown = 0;
    let kanjiWritten = 0;
    let started = 0;

    for (const k of lesson.kanji) {
      const p = progress.kanji.get(k.char);
      if (!p) continue;
      started++;
      if (p.recognition_stage >= KNOWN_STAGE) kanjiKnown++;
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
  /** The rows everything below is computed from, for pages that need more. */
  progress: ProgressMaps;
  lessons: LessonSummary[];
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

  const allKanji = getKanji(level);
  const allWords = getAllWords(level);

  // Mastery bands describe kanji recognition — the headline metric.
  const bands: Record<MasteryBand, number> = { new: 0, learning: 0, known: 0, mastered: 0 };
  let kanjiKnown = 0;
  let kanjiWritten = 0;
  let writingDue = 0;
  for (const k of allKanji) {
    const p = progress.kanji.get(k.char);
    bands[bandFor(p?.recognition_stage)]++;
    if ((p?.recognition_stage ?? 0) >= KNOWN_STAGE) kanjiKnown++;
    if ((p?.writing_stage ?? 0) >= KNOWN_STAGE) kanjiWritten++;
    if (p && p.writing_stage > 0 && new Date(p.due_at).getTime() <= now) writingDue++;
  }

  let wordsKnown = 0;
  let dueNow = 0;
  for (const w of allWords) {
    const p = progress.words.get(w.id);
    if (!p) continue;
    if (p.srs_stage >= KNOWN_STAGE) wordsKnown++;
    if (new Date(p.due_at).getTime() <= now) dueNow++;
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
    progress,
    lessons,
    totalKanji: allKanji.length,
    kanjiStarted: bands.learning + bands.known + bands.mastered,
    kanjiKnown,
    kanjiWritten,
    totalWords: allWords.length,
    wordsKnown,
    dueNow,
    writingDue,
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

/** Characters due for writing practice, most overdue first. */
export async function getWritingQueue(userId: string, level: Level = "N5", limit = 12): Promise<Kanji[]> {
  const due = await read("getWritingQueue", userId, [] as { char: string }[], async (db) => {
    const { rows } = await db.query<{ char: string }>(
      `select char from public.kanji_progress
        where user_id = $1 and level = $2 and writing_stage > 0 and due_at <= now()
        order by due_at limit $3`,
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
         last_reviewed_at = excluded.last_reviewed_at`,
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
  return asUser(userId, async (db) => {
    const { rows } = await db.query<Omit<KanjiProgressRow, "char">>(
      `select recognition_stage, writing_stage, correct_count, incorrect_count, due_at, last_reviewed_at
         from public.kanji_progress where user_id = $1 and char = $2 for update`,
      [userId, kanji.char],
    );
    const existing = rows[0];

    const currentStage = (skill === "writing" ? existing?.writing_stage : existing?.recognition_stage) ?? 0;
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

    await db.query(
      `insert into public.kanji_progress
         (user_id, char, level, recognition_stage, writing_stage, correct_count, incorrect_count, due_at, last_reviewed_at)
       values ($1, $2, $3, $4, $5, $6, $7, $8, $9)
       on conflict (user_id, char) do update set
         level = excluded.level,
         recognition_stage = excluded.recognition_stage,
         writing_stage = excluded.writing_stage,
         correct_count = excluded.correct_count,
         incorrect_count = excluded.incorrect_count,
         due_at = excluded.due_at,
         last_reviewed_at = excluded.last_reviewed_at`,
      [
        userId,
        kanji.char,
        kanji.level,
        skill === "recognition" ? next.srs_stage : (existing?.recognition_stage ?? 0),
        skill === "writing" ? next.srs_stage : (existing?.writing_stage ?? 0),
        next.correct_count,
        next.incorrect_count,
        // The sooner of the two skills decides when the character resurfaces.
        existing?.due_at && new Date(existing.due_at) < new Date(next.due_at) ? existing.due_at : next.due_at,
        next.last_reviewed_at,
      ],
    );
    return next;
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
  mode: "lesson" | "review" | "writing",
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
  /** Recognition stage per learned character, for the record. */
  stages: Map<string, number>;
};

/**
 * One learner's quiz for one day.
 *
 * Built rather than stored: the questions follow from the date and the
 * characters learned before it, so every reload shows the same five and the
 * answer route can rebuild them to grade an answer itself.
 *
 * "Learned before the date", not "learned": today's characters join tomorrow.
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
  type Learned = { char: string; recognition_stage: number; created_at: string };
  const [progress, answers] = await Promise.all([
    read("getDailyQuiz progress", userId, [] as Learned[], async (db) => {
      const { rows } = await db.query<Learned>(
        `select char, recognition_stage, created_at from public.kanji_progress where user_id = $1 and level = $2`,
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

  const stages = new Map<string, number>();
  for (const r of progress) {
    // YYYY-MM-DD compares correctly as a string.
    if (localDate(timeZone, new Date(r.created_at)) < date) {
      stages.set(r.char, Number(r.recognition_stage ?? 0));
    }
  }

  // Curriculum order, so the shuffle has the same input on every rebuild.
  const all = getKanji(level);
  const learned = all.filter((k) => stages.has(k.char));
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

/** Number of words currently due, for the nav badge. */
export async function getDueCount(userId: string, level: Level = "N5"): Promise<number> {
  return read("getDueCount", userId, 0, async (db) => {
    const { rows } = await db.query<{ n: number }>(
      `select count(*)::int as n from public.word_progress
        where user_id = $1 and level = $2 and due_at <= now()`,
      [userId, level],
    );
    return rows[0]?.n ?? 0;
  });
}
