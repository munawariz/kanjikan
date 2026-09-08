/**
 * Spaced repetition schedule.
 *
 * A deliberately small SM-2 variant: one integer of state per word. Stage 0 is
 * unseen; each correct answer promotes one stage, each wrong answer demotes by
 * two and puts the word back in the short queue. Ease factors are omitted on
 * purpose — at N5 the deck is small and fixed, and per-word ease mostly adds
 * tuning surface without changing what a learner actually sees.
 */

/** Hours until the next review, indexed by the stage the word has just reached. */
const INTERVALS_HOURS = [
  0, // 0 unseen
  0.17, // 1 ten minutes, same session
  8, // 2 later today
  24, // 3 tomorrow
  72, // 4 three days
  168, // 5 one week
  336, // 6 two weeks
  720, // 7 one month
  2160, // 8 three months
] as const;

export const MAX_STAGE = INTERVALS_HOURS.length - 1;

/** Stage at which a word stops being "in progress" and counts as known. */
export const KNOWN_STAGE = 5;

export type Progress = {
  srs_stage: number;
  correct_count: number;
  incorrect_count: number;
  streak: number;
  due_at: string;
  last_reviewed_at: string | null;
};

export type ProgressUpdate = Pick<
  Progress,
  "srs_stage" | "correct_count" | "incorrect_count" | "streak" | "due_at" | "last_reviewed_at"
>;

function addHours(from: Date, hours: number): Date {
  return new Date(from.getTime() + hours * 3600_000);
}

/**
 * Applies one answer to a word's record and returns the new state.
 *
 * `prev` is null the first time a word is answered. A wrong answer never drops
 * below stage 1, so a word that has been introduced is never treated as unseen
 * again — it just comes back within minutes.
 */
export function grade(prev: Progress | null, correct: boolean, now = new Date()): ProgressUpdate {
  const stage = prev?.srs_stage ?? 0;
  const next = correct ? Math.min(stage + 1, MAX_STAGE) : Math.max(1, stage - 2);

  return {
    srs_stage: next,
    correct_count: (prev?.correct_count ?? 0) + (correct ? 1 : 0),
    incorrect_count: (prev?.incorrect_count ?? 0) + (correct ? 0 : 1),
    streak: correct ? (prev?.streak ?? 0) + 1 : 0,
    due_at: addHours(now, INTERVALS_HOURS[next]).toISOString(),
    last_reviewed_at: now.toISOString(),
  };
}

export type MasteryBand = "new" | "learning" | "known" | "mastered";

export function bandFor(stage: number | undefined): MasteryBand {
  if (!stage) return "new";
  if (stage >= MAX_STAGE) return "mastered";
  if (stage >= KNOWN_STAGE) return "known";
  return "learning";
}

export const BAND_LABEL: Record<MasteryBand, string> = {
  new: "Not started",
  learning: "Learning",
  known: "Known",
  mastered: "Mastered",
};

/** Percentage of a set of words that has reached at least the known stage. */
export function masteryPercent(stages: number[], total: number): number {
  if (total === 0) return 0;
  const known = stages.filter((s) => s >= KNOWN_STAGE).length;
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
