import "server-only";
import { asUser, type Db } from "@/lib/db";
import {
  availableLevels,
  getAllWords,
  getKanji,
  getKanjiChar,
  getLessons,
  getWord,
  type Kanji,
  type Level,
  type Word,
} from "@/lib/content";
import {
  grade,
  isKnown,
  kanjiReading,
  KNOWN_STABILITY,
  markKnown,
  streakFromDates,
  type KanjiReading,
  type MarkState,
  type MasteryBand,
  type Memory,
  type Progress,
  type Rating,
} from "@/lib/srs";
import { buildDailyQuiz, type WordQuizCard } from "@/lib/study";
import { DAILY_QUIZ_SIZE, dailySeed, localDate } from "@/lib/daily";
import { DEFAULT_LOCALE, isLocaleCode, type Locale } from "@/lib/i18n/config";
import { intlTag } from "@/lib/i18n/format";

export type WordProgressRow = Progress & {
  word_id: string;
  lesson_slug: string;
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
 * from before that, and nothing reads them; nor does anything read the stage
 * columns FSRS replaced.
 */
export type KanjiProgressRow = {
  char: string;
  writing_stability: number;
  /** 0 for a character that has never been written. See State in lib/srs.ts. */
  writing_state: number;
  /** Null for a character that has never been written. */
  writing_due_at: string | null;
  writing_marked_at: string | null;
};

/*
 * Where each table keeps a Memory. Words use the field names as they are.
 * Writing's are prefixed, except last_reviewed_at, which only writing has set
 * since a character's reading stopped being reviewed on its own. Every query
 * that reads, writes or restores a memory is built from these, so the two
 * tables cannot drift apart.
 */
type MemoryColumns = Record<keyof Memory, string>;

const MEMORY_TYPES: Record<keyof Memory, string> = {
  stability: "real",
  difficulty: "real",
  elapsed_days: "real",
  scheduled_days: "real",
  reps: "integer",
  lapses: "integer",
  state: "integer",
  due_at: "timestamptz",
  last_reviewed_at: "timestamptz",
};

const MEMORY_FIELDS = Object.keys(MEMORY_TYPES) as (keyof Memory)[];

const WORD_MEMORY: MemoryColumns = Object.fromEntries(MEMORY_FIELDS.map((f) => [f, f])) as MemoryColumns;

const WRITING_MEMORY: MemoryColumns = {
  ...(Object.fromEntries(MEMORY_FIELDS.map((f) => [f, `writing_${f}`])) as MemoryColumns),
  last_reviewed_at: "last_reviewed_at",
};

/** A select list that reads a table's memory under the Memory field names. */
function selectMemory(cols: MemoryColumns): string {
  return MEMORY_FIELDS.map((f) => (cols[f] === f ? f : `${cols[f]} as ${f}`)).join(", ");
}

/** A SET list that puts a memory back from a jsonb snapshot of it. */
function restoreMemory(cols: MemoryColumns, snapshot: string): string {
  return MEMORY_FIELDS.map((f) => `${cols[f]} = (${snapshot} ->> '${f}')::${MEMORY_TYPES[f]}`).join(", ");
}

/** Just the Memory fields of a row, for a snapshot. */
function memoryOf(row: Memory): Memory {
  return Object.fromEntries(MEMORY_FIELDS.map((f) => [f, row[f]])) as Memory;
}

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
  /** Null until the learner has chosen. See getLocale in lib/i18n/server. */
  locale: Locale | null;
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
    locale: null,
  };
  return read("getProfile", userId, fallback, async (db) => {
    const { rows } = await db.query<Profile>(
      `select id, display_name, current_level, current_lesson_slug, daily_goal, study_writing, review_warning, locale
         from public.profiles where id = $1`,
      [userId],
    );
    const row = rows[0];
    return row ? { ...row, locale: isLocaleCode(row.locale) ? row.locale : null } : fallback;
  });
}

/*
 * Progress is read for every level at once. Word ids carry their level,
 * characters and lesson slugs are unique across levels, and a learner's rows
 * number in the hundreds, so filtering by level in the query would save
 * nothing — and would hide N5 reviews from a learner who has moved on to N4.
 * Whatever needs one level narrows the content it matches the rows against.
 */

export async function getWordProgress(userId: string): Promise<Map<string, WordProgressRow>> {
  return read("getWordProgress", userId, new Map(), async (db) => {
    const { rows } = await db.query<WordProgressRow>(
      `select word_id, lesson_slug, ${selectMemory(WORD_MEMORY)}, correct_count, incorrect_count, streak,
              marked_at, created_at
         from public.word_progress where user_id = $1`,
      [userId],
    );
    return new Map(rows.map((r) => [r.word_id, r]));
  });
}

export async function getKanjiProgress(userId: string): Promise<Map<string, KanjiProgressRow>> {
  return read("getKanjiProgress", userId, new Map(), async (db) => {
    const { rows } = await db.query<KanjiProgressRow>(
      `select char, writing_stability, writing_state, writing_due_at, writing_marked_at
         from public.kanji_progress where user_id = $1`,
      [userId],
    );
    return new Map(rows.map((r) => [r.char, r]));
  });
}

export async function getLessonProgress(userId: string): Promise<Map<string, LessonProgressRow>> {
  return read("getLessonProgress", userId, new Map(), async (db) => {
    const { rows } = await db.query<LessonProgressRow>(
      `select lesson_slug, status, cursor, completed_at
         from public.lesson_progress where user_id = $1`,
      [userId],
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
export async function getProgress(user: { id: string } | null): Promise<ProgressMaps> {
  if (!user) return { words: new Map(), kanji: new Map(), lessons: new Map() };
  const [words, kanji, lessons] = await Promise.all([
    getWordProgress(user.id),
    getKanjiProgress(user.id),
    getLessonProgress(user.id),
  ]);
  return { words, kanji, lessons };
}

/**
 * Every kanji's reading mastery, worked out from the words that teach it.
 * See kanjiReading in lib/srs.ts for the rule. Every level's, unless one is
 * named.
 */
export function getKanjiReadings(
  words: Map<string, Pick<WordProgressRow, "stability">>,
  level?: Level,
): Map<string, KanjiReading> {
  const stability = new Map<string, number[]>();
  for (const w of getAllWords(level)) {
    const list = stability.get(w.teaches) ?? [];
    list.push(words.get(w.id)?.stability ?? 0);
    stability.set(w.teaches, list);
  }
  return new Map(getKanji(level).map((k) => [k.char, kanjiReading(stability.get(k.char) ?? [])]));
}

/** What "I already know this" can do for a set of words. */
export function wordMarkState(words: Word[], rows: Map<string, WordProgressRow>): MarkState {
  let markable = 0;
  let marked = 0;
  for (const w of words) {
    const r = rows.get(w.id);
    if (r?.marked_at) marked++;
    else if (!isKnown(r?.stability)) markable++;
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
    else if (!isKnown(r?.writing_stability)) markable++;
  }
  return { markable, marked };
}

export type LessonSummary = {
  slug: string;
  title: string;
  summary: string;
  level: Level;
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
 *
 * Every level's lessons in curriculum order, unless one is named.
 */
export function getLessonSummaries(
  progress: ProgressMaps,
  level?: Level,
  locale: Locale = DEFAULT_LOCALE,
): LessonSummary[] {
  const now = Date.now();
  const readings = getKanjiReadings(progress.words, level);

  return getLessons(level, locale).map((lesson) => {
    const bands = lesson.kanji.map((k) => readings.get(k.char)?.band ?? "new");
    const kanjiKnown = bands.filter((b) => b === "known" || b === "mastered").length;

    let kanjiWritten = 0;
    let started = 0;
    for (const k of lesson.kanji) {
      const p = progress.kanji.get(k.char);
      if (!p) continue;
      started++;
      if (isKnown(p.writing_stability)) kanjiWritten++;
    }

    let wordsKnown = 0;
    let due = 0;
    for (const w of lesson.words) {
      const p = progress.words.get(w.id);
      if (!p) continue;
      started++;
      if (isKnown(p.stability)) wordsKnown++;
      if (new Date(p.due_at).getTime() <= now) due++;
    }

    const row = progress.lessons.get(lesson.slug);
    const status: LessonSummary["status"] =
      row?.status === "completed" ? "completed" : started > 0 || row ? "learning" : "not_started";

    return {
      slug: lesson.slug,
      title: lesson.title,
      summary: lesson.summary,
      level: lesson.level,
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

/** How far through one level a learner is, in kanji. */
export type LevelProgress = {
  level: Level;
  totalKanji: number;
  kanjiKnown: number;
};

export type DashboardData = {
  profile: Profile;
  studyWriting: boolean;
  /** The rows everything below is computed from, for pages that need more. */
  progress: ProgressMaps;
  /** Every level's lessons, in curriculum order. */
  lessons: LessonSummary[];
  /**
   * The level being worked through: that of the lesson Home suggests next, or
   * the last level once every lesson is done.
   */
  currentLevel: Level;
  /** One entry per built level, in study order. */
  levels: LevelProgress[];
  /** The figures below cover every level together. */
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

export async function getDashboard(userId: string, locale: Locale = DEFAULT_LOCALE): Promise<DashboardData> {
  const now = Date.now();
  const since = new Date(now - 29 * 86_400_000).toISOString();

  const [profile, progress, sessions] = await Promise.all([
    getProfile(userId),
    getProgress({ id: userId }),
    read("getDashboard sessions", userId, [] as { created_at: string; total: number }[], async (db) => {
      const { rows } = await db.query<{ created_at: string; total: number }>(
        `select created_at, total from public.study_sessions
          where user_id = $1 and created_at >= $2 order by created_at`,
        [userId, since],
      );
      return rows;
    }),
  ]);
  const lessons = getLessonSummaries(progress, undefined, locale);
  const studyWriting = studiesWriting(profile);

  const allKanji = getKanji();
  const allWords = getAllWords();
  const readings = getKanjiReadings(progress.words);

  // Mastery bands describe reading, the headline metric.
  const bands: Record<MasteryBand, number> = { new: 0, learning: 0, known: 0, mastered: 0 };
  const byLevel = new Map<Level, LevelProgress>(
    availableLevels().map((level) => [level, { level, totalKanji: 0, kanjiKnown: 0 }]),
  );
  let kanjiWritten = 0;
  let writingDue = 0;
  for (const k of allKanji) {
    const band = readings.get(k.char)?.band ?? "new";
    bands[band]++;
    const level = byLevel.get(k.level)!;
    level.totalKanji++;
    if (band === "known" || band === "mastered") level.kanjiKnown++;
    const p = progress.kanji.get(k.char);
    if (isKnown(p?.writing_stability)) kanjiWritten++;
    if (p && p.writing_state > 0 && p.writing_due_at && new Date(p.writing_due_at).getTime() <= now) writingDue++;
  }

  let wordsKnown = 0;
  let wordsDue = 0;
  for (const w of allWords) {
    const p = progress.words.get(w.id);
    if (!p) continue;
    if (isKnown(p.stability)) wordsKnown++;
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
      label: d.toLocaleDateString(intlTag(locale), { weekday: "narrow" }),
      value: byDay.get(d.toDateString()) ?? 0,
    });
  }

  const resumeLesson =
    lessons.find((l) => l.slug === profile.current_lesson_slug && l.status !== "completed") ??
    lessons.find((l) => l.status === "learning") ??
    null;
  const nextLesson = lessons.find((l) => l.status === "not_started") ?? null;
  const levels = [...byLevel.values()];

  return {
    profile,
    studyWriting,
    progress,
    lessons,
    currentLevel: (resumeLesson ?? nextLesson)?.level ?? levels[levels.length - 1].level,
    levels,
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
    nextLesson,
    resumeLesson,
  };
}

/** Words due for review, most overdue first, from every level. */
export async function getReviewQueue(userId: string, limit = 30, locale: Locale = DEFAULT_LOCALE): Promise<Word[]> {
  const due = await read("getReviewQueue", userId, [] as { word_id: string }[], async (db) => {
    const { rows } = await db.query<{ word_id: string }>(
      `select word_id from public.word_progress
        where user_id = $1 and due_at <= now()
        order by due_at limit $2`,
      [userId, limit],
    );
    return rows;
  });
  return due.map((r) => getWord(r.word_id, locale)).filter((w): w is Word => w !== undefined);
}

/** Characters whose writing is due, most overdue first, from every level. */
export async function getWritingReviewQueue(
  userId: string,
  limit = 10,
  locale: Locale = DEFAULT_LOCALE,
): Promise<Kanji[]> {
  const due = await read("getWritingReviewQueue", userId, [] as { char: string }[], async (db) => {
    const { rows } = await db.query<{ char: string }>(
      `select char from public.kanji_progress
        where user_id = $1 and writing_state > 0 and writing_due_at <= now()
        order by writing_due_at limit $2`,
      [userId, limit],
    );
    return rows;
  });
  return due.map((r) => getKanjiChar(r.char, locale)).filter((k): k is Kanji => k !== undefined);
}

/** Where one kind of mark lives: a word's reading, or a character's writing. */
type MarkTarget = {
  table: "word_progress" | "kanji_progress";
  key: "word_id" | "char";
  memory: MemoryColumns;
  markedAt: string;
  /** The memory before the mark, as jsonb. Null on a marked row: there was no row. */
  snapshot: string;
  /** The stage-era undo columns, cleared with the rest so nothing stale is left. */
  legacy: [string, string];
};

const READING_MARK: MarkTarget = {
  table: "word_progress",
  key: "word_id",
  memory: WORD_MEMORY,
  markedAt: "marked_at",
  snapshot: "pre_mark_memory",
  legacy: ["pre_mark_stage", "pre_mark_due_at"],
};

const WRITING_MARK: MarkTarget = {
  table: "kanji_progress",
  key: "char",
  memory: WRITING_MEMORY,
  markedAt: "writing_marked_at",
  snapshot: "pre_mark_writing_memory",
  legacy: ["pre_mark_writing_stage", "pre_mark_writing_due_at"],
};

/** A SET list that settles or drops a mark. */
function clearMark(t: MarkTarget): string {
  return [t.markedAt, t.snapshot, ...t.legacy].map((c) => `${c} = null`).join(", ");
}

/**
 * Applies one graded answer to a word. Upserts because the first has no row;
 * the row is locked while it is read so two quick answers cannot both grade
 * the same starting state.
 *
 * `answer` is an FSRS rating, 1 (Again) to 4 (Easy), or right and wrong from a
 * screen that only knows those, which count as Good and Again.
 *
 * An answer settles a mark: from here on the word is where its answers put it,
 * and there is nothing left to undo.
 */
export async function recordAnswer(userId: string, word: Word, answer: boolean | Rating): Promise<Progress> {
  // Given no time, the answer is now, which no stored review can be later than.
  return (await asUser(userId, (db) => recordAnswerIn(db, userId, word, answer)))!;
}

/**
 * {@link recordAnswer} inside a transaction already open, for an answer given
 * at `at` rather than now: one synced from the browser's queue, which can be
 * long after it was given (see lib/sync.ts).
 *
 * Returns null, and writes nothing, for an answer no later than the word's
 * last review. The queue sends answers in the order they were given, so this
 * only happens when guest progress is merged into an account that has studied
 * the word since: the account's own later answer stands, and grading an older
 * one on top of it would schedule from the wrong moment.
 */
export async function recordAnswerIn(
  db: Db,
  userId: string,
  word: Word,
  answer: boolean | Rating,
  at?: Date,
): Promise<Progress | null> {
  const { rows } = await db.query<Progress>(
    `select ${selectMemory(WORD_MEMORY)}, correct_count, incorrect_count, streak
       from public.word_progress where user_id = $1 and word_id = $2 for update`,
    [userId, word.id],
  );
  if (at && reviewedSince(rows[0], at)) return null;
  const next = grade(rows[0] ?? null, answer, at);

  const cols = [...MEMORY_FIELDS.map((f) => WORD_MEMORY[f]), "correct_count", "incorrect_count", "streak"];
  await db.query(
    `insert into public.word_progress (user_id, word_id, level, lesson_slug, ${cols.join(", ")})
     values ($1, $2, $3, $4, ${cols.map((_, i) => `$${i + 5}`).join(", ")})
     on conflict (user_id, word_id) do update set
       level = excluded.level,
       lesson_slug = excluded.lesson_slug,
       ${cols.map((c) => `${c} = excluded.${c}`).join(", ")},
       ${clearMark(READING_MARK)}`,
    [
      userId,
      word.id,
      word.level,
      word.lessonSlug,
      ...MEMORY_FIELDS.map((f) => next[f]),
      next.correct_count,
      next.incorrect_count,
      next.streak,
    ],
  );
  return next;
}

/** Whether a memory was last reviewed at or after `at`. */
function reviewedSince(row: Pick<Memory, "last_reviewed_at"> | undefined, at: Date): boolean {
  return Boolean(row?.last_reviewed_at && new Date(row.last_reviewed_at).getTime() >= at.getTime());
}

/**
 * Applies one graded answer to a character's writing.
 *
 * Writing keeps its own memory and its own due date, apart from reading: being
 * able to read 語 says nothing about being able to write it, and a learner who
 * does not study writing should never have it come due. Like a word's answer,
 * it settles any mark.
 */
export async function recordWritingAnswer(userId: string, kanji: Kanji, answer: boolean | Rating): Promise<Progress> {
  return (await asUser(userId, (db) => recordWritingAnswerIn(db, userId, kanji, answer)))!;
}

/** {@link recordWritingAnswer} as {@link recordAnswerIn} is to recordAnswer. */
export async function recordWritingAnswerIn(
  db: Db,
  userId: string,
  kanji: Kanji,
  answer: boolean | Rating,
  at?: Date,
): Promise<Progress | null> {
  const { rows } = await db.query<Memory & { correct_count: number; incorrect_count: number }>(
    `select ${selectMemory(WRITING_MEMORY)}, correct_count, incorrect_count
       from public.kanji_progress where user_id = $1 and char = $2 for update`,
    [userId, kanji.char],
  );
  const existing = rows[0];
  if (at && reviewedSince(existing, at)) return null;
  // Writing keeps no streak.
  const next = grade(existing ? { ...existing, streak: 0 } : null, answer, at);

  const cols = [...MEMORY_FIELDS.map((f) => WRITING_MEMORY[f]), "correct_count", "incorrect_count"];
  await db.query(
    `insert into public.kanji_progress (user_id, char, level, ${cols.join(", ")})
     values ($1, $2, $3, ${cols.map((_, i) => `$${i + 4}`).join(", ")})
     on conflict (user_id, char) do update set
       level = excluded.level,
       ${cols.map((c) => `${c} = excluded.${c}`).join(", ")},
       ${clearMark(WRITING_MARK)}`,
    [userId, kanji.char, kanji.level, ...MEMORY_FIELDS.map((f) => next[f]), next.correct_count, next.incorrect_count],
  );
  return next;
}

/**
 * Marks each item known (see markKnown in lib/srs.ts): due in about a week for
 * one check. Items already known, and items already marked, are left as they
 * are.
 *
 * The memory before the mark is kept beside it so the mark can be undone
 * exactly; an item with no row until now keeps nothing, and undoing deletes
 * it. The rows are locked while they are read, so the snapshot is exactly the
 * state the mark replaces. `fixed` is the content-derived columns a new row
 * needs, the same for every item.
 */
async function markIn(
  db: Db,
  userId: string,
  t: MarkTarget,
  items: { id: string; fixed: Record<string, string> }[],
  now = new Date(),
) {
  const { rows } = await db.query<Memory & { id: string; marked: string | null }>(
    `select ${t.key} as id, ${selectMemory(t.memory)}, ${t.markedAt} as marked
       from public.${t.table} where user_id = $1 and ${t.key} = any($2) for update`,
    [userId, items.map((i) => i.id)],
  );
  const existing = new Map(rows.map((r) => [r.id, r]));
  const marks = items.flatMap(({ id, fixed }) => {
    const prev = existing.get(id);
    if (prev && (prev.marked || isKnown(prev.stability))) return [];
    return [{ ...fixed, id, ...markKnown(prev ?? null, now), snapshot: prev ? memoryOf(prev) : null }];
  });
  if (marks.length === 0) return;

  const fixedCols = Object.keys(items[0].fixed);
  const memoryCols = MEMORY_FIELDS.map((f) => t.memory[f]);
  const recordType = [
    "id text",
    ...fixedCols.map((c) => `${c} text`),
    ...MEMORY_FIELDS.map((f) => `${f} ${MEMORY_TYPES[f]}`),
    "snapshot jsonb",
  ].join(", ");
  // The guard repeats the check above for a row another request inserted
  // between the read and the write.
  await db.query(
    `insert into public.${t.table} as p
       (user_id, ${t.key}, ${[...fixedCols, ...memoryCols].join(", ")}, ${t.markedAt}, ${t.snapshot})
     select $1, m.id, ${[...fixedCols, ...MEMORY_FIELDS].map((c) => `m.${c}`).join(", ")}, now(), m.snapshot
       from jsonb_to_recordset($2::jsonb) as m(${recordType})
     on conflict (user_id, ${t.key}) do update set
       ${[...memoryCols, t.markedAt, t.snapshot].map((c) => `${c} = excluded.${c}`).join(", ")}
     where p.${t.markedAt} is null and p.${t.memory.stability} < $3`,
    [userId, JSON.stringify(marks), KNOWN_STABILITY],
  );
}

/**
 * Undoes {@link markIn} for whichever of these are still marked. In an update's
 * SET list every column reads the row as it was, so the memory is restored
 * from the snapshot in the same statement that clears it.
 */
async function unmarkIn(db: Db, userId: string, t: MarkTarget, ids: string[]) {
  await db.query(
    `delete from public.${t.table}
      where user_id = $1 and ${t.key} = any($2) and ${t.markedAt} is not null and ${t.snapshot} is null`,
    [userId, ids],
  );
  await db.query(
    `update public.${t.table}
        set ${restoreMemory(t.memory, t.snapshot)}, ${clearMark(t)}
      where user_id = $1 and ${t.key} = any($2) and ${t.markedAt} is not null`,
    [userId, ids],
  );
}

/** "I already know these", for the reading of words. */
export async function markWordsKnown(userId: string, words: Word[]) {
  if (words.length === 0) return;
  await asUser(userId, (db) => markWordsKnownIn(db, userId, words));
}

/** {@link markWordsKnown} inside a transaction already open, as made at `at`. */
export async function markWordsKnownIn(db: Db, userId: string, words: Word[], at?: Date) {
  if (words.length === 0) return;
  await markIn(
    db,
    userId,
    READING_MARK,
    words.map((w) => ({ id: w.id, fixed: { level: w.level, lesson_slug: w.lessonSlug } })),
    at,
  );
}

/** Undoes {@link markWordsKnown} for whichever of these words are still marked. */
export async function unmarkWords(userId: string, words: Word[]) {
  if (words.length === 0) return;
  await asUser(userId, (db) => unmarkIn(db, userId, READING_MARK, words.map((w) => w.id)));
}

/** "I can already write these": the same as {@link markWordsKnown}, for writing. */
export async function markWritingKnown(userId: string, kanji: Kanji[]) {
  if (kanji.length === 0) return;
  await asUser(userId, (db) => markWritingKnownIn(db, userId, kanji));
}

/** {@link markWritingKnown} inside a transaction already open, as made at `at`. */
export async function markWritingKnownIn(db: Db, userId: string, kanji: Kanji[], at?: Date) {
  if (kanji.length === 0) return;
  await markIn(db, userId, WRITING_MARK, kanji.map((k) => ({ id: k.char, fixed: { level: k.level } })), at);
}

/** Undoes {@link markWritingKnown} for whichever of these characters are still marked. */
export async function unmarkWriting(userId: string, kanji: Kanji[]) {
  if (kanji.length === 0) return;
  await asUser(userId, (db) => unmarkIn(db, userId, WRITING_MARK, kanji.map((k) => k.char)));
}

export async function saveSettings(
  userId: string,
  settings: { studyWriting?: boolean; reviewWarning?: number | null; locale?: Locale },
) {
  await asUser(userId, async (db) => {
    if (settings.studyWriting !== undefined) {
      await db.query(`update public.profiles set study_writing = $2 where id = $1`, [userId, settings.studyWriting]);
    }
    if (settings.reviewWarning !== undefined) {
      await db.query(`update public.profiles set review_warning = $2 where id = $1`, [userId, settings.reviewWarning]);
    }
    if (settings.locale !== undefined) {
      await db.query(`update public.profiles set locale = $2 where id = $1`, [userId, settings.locale]);
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
  await asUser(userId, (db) => saveCheckpointIn(db, userId, level, lessonSlug, cursor, completed));
}

/**
 * {@link saveCheckpoint} inside a transaction already open, as saved at `at`.
 *
 * `merge` is for a checkpoint made as a guest and merged into an account that
 * may already be further on: it only moves the lesson forward, so a lesson the
 * account has finished is never set back to learning.
 */
export async function saveCheckpointIn(
  db: Db,
  userId: string,
  level: Level,
  lessonSlug: string,
  cursor: number,
  completed: boolean,
  { at = new Date(), merge = false }: { at?: Date; merge?: boolean } = {},
) {
  const update = merge
    ? `cursor = greatest(p.cursor, excluded.cursor),
       status = case when p.status = 'completed' then p.status else excluded.status end,
       completed_at = coalesce(p.completed_at, excluded.completed_at)`
    : `cursor = excluded.cursor,
       status = excluded.status,
       completed_at = excluded.completed_at`;
  await db.query(
    `insert into public.lesson_progress as p (user_id, level, lesson_slug, cursor, status, completed_at)
     values ($1, $2, $3, $4, $5, $6)
     on conflict (user_id, level, lesson_slug) do update set
       ${update}`,
    [userId, level, lessonSlug, cursor, completed ? "completed" : "learning", completed ? at.toISOString() : null],
  );
  await db.query(`update public.profiles set current_level = $2, current_lesson_slug = $3 where id = $1`, [
    userId,
    level,
    lessonSlug,
  ]);
}

export async function recordSession(
  userId: string,
  level: Level,
  mode: "lesson" | "review",
  lessonSlug: string | null,
  total: number,
  correct: number,
) {
  await asUser(userId, (db) => recordSessionIn(db, userId, level, mode, lessonSlug, total, correct));
}

/**
 * {@link recordSession} inside a transaction already open, for a run finished
 * at `at`: the streak and the activity chart count it on the day it was
 * studied, not the day it reached the server.
 */
export async function recordSessionIn(
  db: Db,
  userId: string,
  level: Level,
  mode: "lesson" | "review",
  lessonSlug: string | null,
  total: number,
  correct: number,
  at = new Date(),
) {
  await db.query(
    `insert into public.study_sessions (user_id, level, mode, lesson_slug, total, correct, created_at)
     values ($1, $2, $3, $4, $5, $6, $7)`,
    [userId, level, mode, lessonSlug, total, correct, at.toISOString()],
  );
}

export type DailyAnswerRow = {
  position: number;
  /** What was asked: a word card's kind, or kanji-meaning on rows from before words. */
  kind: string;
  /** The word as written, or on older rows the character asked about. */
  char: string;
  answer: string;
  chosen: string;
  correct: boolean;
};

export type DailyQuiz = {
  date: string;
  /** Words first studied before this date — the pool the quiz draws on. */
  learned: number;
  /** The whole day's quiz in order, answered or not. Empty until enough are learned. */
  questions: WordQuizCard[];
  /** What has been answered so far, by position. */
  answers: DailyAnswerRow[];
  /** Stability per learned word, for the record. */
  stability: Map<string, number>;
};

/**
 * One learner's quiz for one day.
 *
 * Built rather than stored: the questions follow from the date and the words
 * learned before it, so every reload shows the same five and the answer route
 * can rebuild them to grade an answer itself.
 *
 * A word is learned from the day it was first studied or marked known.
 * "Before the date", not "by": today's words join tomorrow.
 * That holds the pool still for the whole day, so a half-finished quiz cannot
 * change under the learner, and it keeps the quiz from asking about something
 * taught ten minutes ago — which would measure short-term recall rather than
 * whether it stuck.
 *
 * It draws on every level. Distractors come from the levels the learner has
 * learned something in, so an N5 learner is never offered N4 words they could
 * rule out just for being unfamiliar.
 */
export async function getDailyQuiz(
  userId: string,
  date: string,
  timeZone: string,
  locale: Locale = DEFAULT_LOCALE,
): Promise<DailyQuiz> {
  type Studied = { word_id: string; stability: number; created_at: string };
  const [progress, answers] = await Promise.all([
    read("getDailyQuiz progress", userId, [] as Studied[], async (db) => {
      const { rows } = await db.query<Studied>(
        `select word_id, stability, created_at from public.word_progress where user_id = $1`,
        [userId],
      );
      return rows;
    }),
    read("getDailyQuiz answers", userId, [] as DailyAnswerRow[], async (db) => {
      const { rows } = await db.query<DailyAnswerRow>(
        `select position, kind, char, answer, chosen, correct from public.daily_quiz_answers
          where user_id = $1 and quiz_date = $2 order by position`,
        [userId, date],
      );
      return rows;
    }),
  ]);

  const rows = new Map(progress.map((r) => [r.word_id, r]));
  // Curriculum order, so the shuffle has the same input on every rebuild.
  // YYYY-MM-DD compares correctly as a string.
  const learned = getAllWords().filter((w) => {
    const r = rows.get(w.id);
    return r && localDate(timeZone, new Date(r.created_at)) < date;
  });
  const stability = new Map(learned.map((w) => [w.id, rows.get(w.id)?.stability ?? 0]));

  const levels = new Set(learned.map((w) => w.level));
  const pool = getAllWords().filter((w) => levels.has(w.level));
  // Built from the English, which is what the choices are picked by, so the
  // same day's quiz asks the same thing in any language — switching language
  // halfway cannot change a question under an answer. Then shown in the
  // learner's. A choice's id is its word, so grading never reads a label.
  const questions = (
    learned.length >= DAILY_QUIZ_SIZE ? buildDailyQuiz(learned, pool, DAILY_QUIZ_SIZE, dailySeed(userId, date)) : []
  ).map((card) =>
    locale === DEFAULT_LOCALE
      ? card
      : {
          ...card,
          word: getWord(card.word.id, locale) ?? card.word,
          // Only meanings are in a language; readings and words are Japanese.
          choices:
            card.kind === "word-meaning"
              ? card.choices.map((c) => ({ ...c, label: getWord(c.id, locale)?.meanings[0] ?? c.label }))
              : card.choices,
        },
  );

  return { date, learned: learned.length, questions, answers, stability };
}

export type DailyAnswerResult =
  | { status: "recorded"; correct: boolean }
  /** The position already had an answer. The first one stands. */
  | { status: "already-answered" }
  | { status: "invalid"; reason: "no-question" | "not-an-option" };

/**
 * Grades one daily quiz answer and stores it.
 *
 * The browser sends only which option was picked. The question is rebuilt
 * here and graded against the rebuild, so the stored verdict — and the word,
 * and the options — are the server's, not the client's.
 */
export async function recordDailyAnswer(
  userId: string,
  date: string,
  timeZone: string,
  position: number,
  choiceId: string,
  locale: Locale = DEFAULT_LOCALE,
): Promise<DailyAnswerResult> {
  // In the learner's language, so the labels stored are the ones they saw.
  const quiz = await getDailyQuiz(userId, date, timeZone, locale);
  const card = quiz.questions[position - 1];
  if (!card) return { status: "invalid", reason: "no-question" };

  const chosen = card.choices.find((c) => c.id === choiceId);
  if (!chosen) return { status: "invalid", reason: "not-an-option" };

  const answer = card.choices.find((c) => c.id === card.answerId)!;
  const correct = chosen.id === card.answerId;

  try {
    // A plain insert, not an upsert: there is deliberately no update policy,
    // and a second answer to the same question must not replace the first.
    await asUser(userId, (db) =>
      db.query(
        `insert into public.daily_quiz_answers
           (user_id, level, quiz_date, position, kind, char, word_id, answer, chosen, options, correct, stability, time_zone)
         values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)`,
        [
          userId,
          // A quiz can mix levels; each answer records its own word's.
          card.word.level,
          date,
          position,
          card.kind,
          card.word.word,
          card.word.id,
          answer.label,
          chosen.label,
          card.choices.map((c) => c.label),
          correct,
          quiz.stability.get(card.word.id) ?? 0,
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
): Promise<Map<string, { answered: number; correct: number }>> {
  const rows = await read("getDailyHistory", userId, [] as { quiz_date: string; correct: boolean }[], async (db) => {
    const { rows } = await db.query<{ quiz_date: string; correct: boolean }>(
      `select quiz_date, correct from public.daily_quiz_answers
        where user_id = $1 and quiz_date >= $2`,
      [userId, since],
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
export async function getDueCounts(userId: string): Promise<{ words: number; writing: number }> {
  return read("getDueCounts", userId, { words: 0, writing: 0 }, async (db) => {
    const { rows } = await db.query<{ words: number; writing: number }>(
      `select
         (select count(*)::int from public.word_progress
           where user_id = $1 and due_at <= now()) as words,
         (select count(*)::int from public.kanji_progress
           where user_id = $1 and writing_state > 0 and writing_due_at <= now()) as writing`,
      [userId],
    );
    return rows[0] ?? { words: 0, writing: 0 };
  });
}

/** The reviews that count for this learner: writing only if they study it. */
export function reviewsDue(counts: { words: number; writing: number }, profile: Pick<Profile, "study_writing">) {
  return counts.words + (studiesWriting(profile) ? counts.writing : 0);
}
