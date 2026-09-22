/**
 * Spaced repetition schedule: FSRS v4, the Free Spaced Repetition Scheduler.
 *
 * Each word, and each character's writing, carries a small model of memory
 * rather than a stage:
 *
 *   stability   S, in days: how long until the chance of recalling it falls to
 *               the target retention. With a 90% target the next interval is S
 *               itself, so S reads directly as "days it can go unreviewed".
 *   difficulty  D, 1 to 10: how hard it is to raise S. Misses push it up,
 *               easy answers pull it down, and it drifts back towards the
 *               middle so one bad day is not held against a word forever.
 *   state       New, then Learning (minute steps within a session), then
 *               Review (day intervals). A miss in Review is a lapse: S falls
 *               and the word goes through Relearning before Review again.
 *
 * The parameters are FSRS v4's published defaults. They are not fitted per
 * learner: the deck is small and fixed, and at N5 a learner has too few
 * reviews for fitting to beat the defaults.
 *
 * Everything here is pure: state in, state out, time passed in.
 */

/** FSRS v4 default weights, w0 to w16. */
const W = [0.4, 0.6, 2.4, 5.8, 4.93, 0.94, 0.86, 0.01, 1.49, 0.14, 0.94, 2.18, 0.05, 0.34, 1.26, 0.29, 2.61] as const;

/** The recall probability every interval is chosen to land on. */
export const TARGET_RETENTION = 0.9;

/** No interval is longer than a year, however stable the memory. */
export const MAX_INTERVAL_DAYS = 365;

/** Stability at which a word stops being "in progress" and counts as known. */
export const KNOWN_STABILITY = 7;

/** Stability at which a word counts as mastered. */
export const MASTERED_STABILITY = 90;

export const Rating = { Again: 1, Hard: 2, Good: 3, Easy: 4 } as const;
export type Rating = (typeof Rating)[keyof typeof Rating];

export const State = { New: 0, Learning: 1, Review: 2, Relearning: 3 } as const;
export type State = (typeof State)[keyof typeof State];

/** One item's memory, as stored. Column names match the word_progress table. */
export type Memory = {
  stability: number;
  difficulty: number;
  /** Days between the previous review and the latest one. */
  elapsed_days: number;
  /** Days from the latest review to the next; 0 for a step within a session. */
  scheduled_days: number;
  reps: number;
  lapses: number;
  state: State;
  due_at: string;
  last_reviewed_at: string | null;
};

export type Progress = Memory & {
  correct_count: number;
  incorrect_count: number;
  streak: number;
};

export type ProgressUpdate = Progress;

export function isRating(x: unknown): x is Rating {
  return x === 1 || x === 2 || x === 3 || x === 4;
}

/**
 * The rating for an answer. The study screens only know right or wrong, which
 * are Good and Again; "I already know this" is Easy (see {@link markKnown}).
 */
export function ratingFor(answer: boolean | Rating): Rating {
  if (typeof answer === "number") return answer;
  return answer ? Rating.Good : Rating.Again;
}

const MINUTE_MS = 60_000;
const DAY_MS = 86_400_000;

/** Minutes until a new item comes back, by rating. Easy skips straight to days. */
const NEW_STEPS: Record<Exclude<Rating, 4>, number> = { 1: 1, 2: 5, 3: 10 };

/** Minutes until an item in Learning or Relearning comes back on Again and Hard. */
const RELEARN_STEPS = { again: 5, hard: 10 } as const;

function clamp(x: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, x));
}

/** The chance of recalling something of stability `stability` after `elapsedDays`. */
export function retrievability(elapsedDays: number, stability: number): number {
  if (stability <= 0) return 0;
  return 1 / (1 + elapsedDays / (9 * stability));
}

/** Whole days until recall falls to the target retention, at least one. */
export function nextInterval(stability: number): number {
  const days = 9 * stability * (1 / TARGET_RETENTION - 1);
  return clamp(Math.round(days), 1, MAX_INTERVAL_DAYS);
}

function initStability(rating: Rating): number {
  return Math.max(W[rating - 1], 0.1);
}

function initDifficulty(rating: Rating): number {
  return clamp(W[4] - W[5] * (rating - 3), 1, 10);
}

/** Moves difficulty by the rating, then a little way back to its starting point. */
function nextDifficulty(difficulty: number, rating: Rating): number {
  const moved = difficulty - W[6] * (rating - 3);
  return clamp(W[7] * W[4] + (1 - W[7]) * moved, 1, 10);
}

/**
 * Stability after a successful recall. It grows more for an easier item, for a
 * weaker memory, and for one recalled when it was closer to being forgotten.
 */
function recallStability(difficulty: number, stability: number, r: number, rating: Rating): number {
  const hard = rating === Rating.Hard ? W[15] : 1;
  const easy = rating === Rating.Easy ? W[16] : 1;
  return (
    stability *
    (1 + Math.exp(W[8]) * (11 - difficulty) * Math.pow(stability, -W[9]) * (Math.exp(W[10] * (1 - r)) - 1) * hard * easy)
  );
}

/** Stability after a lapse. */
function forgetStability(difficulty: number, stability: number, r: number): number {
  return W[11] * Math.pow(difficulty, -W[12]) * (Math.pow(stability + 1, W[13]) - 1) * Math.exp(W[14] * (1 - r));
}

/**
 * Applies one rating to an item's memory and returns the new memory.
 *
 * `prev` is null the first time an item is answered. Learning and Relearning
 * keep stability as it is and step in minutes until a Good sends the item out
 * to a day interval, as FSRS v4's reference scheduler does. In Review the
 * intervals are kept in order, Hard before Good before Easy, so a better
 * answer never schedules a word sooner.
 */
export function schedule(prev: Memory | null, rating: Rating, now = new Date()): Memory {
  const state = prev?.state ?? State.New;
  const last = prev?.last_reviewed_at ? new Date(prev.last_reviewed_at).getTime() : null;
  const elapsed = state === State.New || last === null ? 0 : Math.max(0, (now.getTime() - last) / DAY_MS);

  const base = {
    elapsed_days: elapsed,
    reps: (prev?.reps ?? 0) + 1,
    lapses: prev?.lapses ?? 0,
    last_reviewed_at: now.toISOString(),
  };
  const inMinutes = (minutes: number, stability: number, difficulty: number, next: State): Memory => ({
    ...base,
    stability,
    difficulty,
    state: next,
    scheduled_days: 0,
    due_at: new Date(now.getTime() + minutes * MINUTE_MS).toISOString(),
  });
  const inDays = (days: number, stability: number, difficulty: number): Memory => ({
    ...base,
    stability,
    difficulty,
    state: State.Review,
    scheduled_days: days,
    due_at: new Date(now.getTime() + days * DAY_MS).toISOString(),
  });

  if (!prev || state === State.New) {
    const s = initStability(rating);
    const d = initDifficulty(rating);
    if (rating === Rating.Easy) return inDays(nextInterval(s), s, d);
    return inMinutes(NEW_STEPS[rating], s, d, State.Learning);
  }

  const { stability: s, difficulty: d } = prev;

  if (state === State.Learning || state === State.Relearning) {
    if (rating === Rating.Again) return inMinutes(RELEARN_STEPS.again, s, d, state);
    if (rating === Rating.Hard) return inMinutes(RELEARN_STEPS.hard, s, d, state);
    const good = nextInterval(s);
    return inDays(rating === Rating.Good ? good : Math.min(good + 1, MAX_INTERVAL_DAYS), s, d);
  }

  // Review.
  const r = retrievability(elapsed, s);
  const nd = nextDifficulty(d, rating);
  if (rating === Rating.Again) {
    return { ...inMinutes(RELEARN_STEPS.again, forgetStability(d, s, r), nd, State.Relearning), lapses: base.lapses + 1 };
  }

  const sHard = recallStability(d, s, r, Rating.Hard);
  const sGood = recallStability(d, s, r, Rating.Good);
  const sEasy = recallStability(d, s, r, Rating.Easy);
  const hard = Math.min(nextInterval(sHard), nextInterval(sGood));
  const good = Math.min(Math.max(nextInterval(sGood), hard + 1), MAX_INTERVAL_DAYS);
  const easy = Math.min(Math.max(nextInterval(sEasy), good + 1), MAX_INTERVAL_DAYS);
  if (rating === Rating.Hard) return inDays(hard, sHard, nd);
  if (rating === Rating.Good) return inDays(good, sGood, nd);
  return inDays(easy, sEasy, nd);
}

/**
 * Applies one answer to an item's record and returns the new state. `answer`
 * is a rating, or right and wrong from a screen that only knows those.
 */
export function grade(prev: Progress | null, answer: boolean | Rating, now = new Date()): ProgressUpdate {
  const rating = ratingFor(answer);
  const correct = rating > Rating.Again;
  return {
    ...schedule(prev, rating, now),
    correct_count: (prev?.correct_count ?? 0) + (correct ? 1 : 0),
    incorrect_count: (prev?.incorrect_count ?? 0) + (correct ? 0 : 1),
    streak: correct ? (prev?.streak ?? 0) + 1 : 0,
  };
}

/**
 * "I already know this": an Easy rating, lifted to known if Easy alone falls
 * short of it. A new item rated Easy reaches FSRS's w3, under a week, and a
 * mark that left the item still "learning" would not do what it says. Lifted,
 * it is due in a week for one check.
 */
export function markKnown(prev: Memory | null, now = new Date()): Memory {
  const next = schedule(prev, Rating.Easy, now);
  if (next.stability >= KNOWN_STABILITY) return next;
  const days = nextInterval(KNOWN_STABILITY);
  return {
    ...next,
    stability: KNOWN_STABILITY,
    state: State.Review,
    scheduled_days: days,
    due_at: new Date(now.getTime() + days * DAY_MS).toISOString(),
  };
}

export function isKnown(stability: number | undefined): boolean {
  return (stability ?? 0) >= KNOWN_STABILITY;
}

export type MasteryBand = "new" | "learning" | "known" | "mastered";

export function bandFor(stability: number | undefined): MasteryBand {
  if (!stability) return "new";
  if (stability >= MASTERED_STABILITY) return "mastered";
  if (stability >= KNOWN_STABILITY) return "known";
  return "learning";
}

export type KanjiReading = {
  /** The stability most of its words have reached. */
  stability: number;
  band: MasteryBand;
  /** Its words at known stability or past it. */
  known: number;
  /** The words that teach it. */
  total: number;
};

/**
 * How well a kanji can be read, worked out from the words that teach it.
 *
 * A kanji has no reading score of its own: words are what get reviewed, so a
 * character is as readable as the words it lives in. It takes the stability
 * that most of them have reached — the majority-th highest — so it is known
 * once more than half its words are known, and one weak word cannot hold back
 * the rest.
 *
 * Started but short of a majority is still learning, not new: the learner has
 * met it, and saying otherwise would read as progress lost.
 */
export function kanjiReading(wordStability: number[]): KanjiReading {
  const sorted = [...wordStability].sort((a, b) => b - a);
  const majority = Math.floor(sorted.length / 2) + 1;
  const stability = sorted[majority - 1] ?? 0;
  const started = sorted.some((s) => s > 0);
  return {
    stability,
    band: stability > 0 ? bandFor(stability) : started ? "learning" : "new",
    known: sorted.filter(isKnown).length,
    total: sorted.length,
  };
}

/**
 * What "I already know this" can do for a set of words or characters: how many
 * it would mark, and how many are marked now and could be unmarked.
 */
export type MarkState = { markable: number; marked: number };

/** Percentage of a set of words that is known. */
export function masteryPercent(stabilities: number[], total: number): number {
  if (total === 0) return 0;
  const known = stabilities.filter(isKnown).length;
  return Math.round((known / total) * 100);
}

/**
 * Consecutive days ending today (or yesterday, so a streak survives until the
 * end of the following day) on which at least one session was recorded.
 */
export function streakFromDates(isoDates: string[], now = new Date()): number {
  const days = new Set(isoDates.map((d) => new Date(d).toDateString()));
  if (days.size === 0) return 0;

  const cursor = new Date(now);
  if (!days.has(cursor.toDateString())) {
    cursor.setDate(cursor.getDate() - 1);
    if (!days.has(cursor.toDateString())) return 0;
  }

  let streak = 0;
  while (days.has(cursor.toDateString())) {
    streak++;
    cursor.setDate(cursor.getDate() - 1);
  }
  return streak;
}
