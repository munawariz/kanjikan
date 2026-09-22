/**
 * The progress events a study session produces, as the browser queues them
 * and /api/progress/batch applies them. Shared by both sides: lib/client-sync.ts
 * writes them, lib/sync.ts reads them.
 *
 * Every event carries an id, made by the browser when the event happens, and
 * the time it happened. The id makes a resend harmless (see the sync_receipts
 * migration); the time lets an answer queued offline be scheduled from when it
 * was given rather than from when it finally reached the server.
 */

type Base = {
  /** A UUID, unique per event. */
  id: string;
  /** When it happened, on the browser's clock, in ISO 8601. */
  at: string;
  /**
   * Made as a guest and merged into an account at sign-in. A merged
   * checkpoint only moves a lesson forward; see saveCheckpointIn.
   */
  merged?: boolean;
};

export type SyncEvent = Base &
  (
    | { type: "answer"; wordId: string; correct: boolean }
    | { type: "writing"; char: string; correct: boolean }
    | { type: "mark"; scope: "word" | "kanji"; target: string; skill: "reading" | "writing" }
    | { type: "checkpoint"; lessonSlug: string; cursor: number; completed: boolean }
    | { type: "session"; mode: "lesson" | "review"; lessonSlug: string | null; total: number; correct: number }
  );

/** What the browser supplies; the id and time are filled in as it is queued. */
export type SyncEventInput = SyncEvent extends infer E
  ? E extends SyncEvent
    ? Omit<E, "id" | "at" | "merged">
    : never
  : never;

/** The body of a POST to /api/progress/batch. */
export type SyncBatch = {
  /** The account the events were made under. The server refuses any other. */
  owner: string | null;
  /** The browser's clock as it sent the batch, to correct `at` for its skew. */
  sentAt: string;
  events: SyncEvent[];
};

/**
 * The reply. `done` counts events from the front of the batch that are
 * finished with — applied, already applied, or refused as malformed — and so
 * can leave the queue. Fewer than were sent means the rest hit an error worth
 * retrying.
 */
export type SyncResult = { done: number; error?: string };

/** The most events one batch may carry. */
export const SYNC_BATCH_SIZE = 50;

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function isObject(x: unknown): x is Record<string, unknown> {
  return typeof x === "object" && x !== null;
}

/**
 * An event as received, or null if it is not one. Only its shape is checked
 * here; whether the word, character or lesson it names exists is for the
 * server to decide against the content files.
 */
export function parseSyncEvent(x: unknown): SyncEvent | null {
  if (!isObject(x)) return null;
  const { id, at, type } = x;
  if (typeof id !== "string" || !UUID.test(id)) return null;
  if (typeof at !== "string" || Number.isNaN(Date.parse(at))) return null;
  const base = { id, at, merged: x.merged === true };

  switch (type) {
    case "answer":
      return typeof x.wordId === "string" && typeof x.correct === "boolean"
        ? { ...base, type, wordId: x.wordId, correct: x.correct }
        : null;
    case "writing":
      return typeof x.char === "string" && typeof x.correct === "boolean"
        ? { ...base, type, char: x.char, correct: x.correct }
        : null;
    case "mark":
      return (x.scope === "word" || x.scope === "kanji") &&
        typeof x.target === "string" &&
        (x.skill === "reading" || x.skill === "writing")
        ? { ...base, type, scope: x.scope, target: x.target, skill: x.skill }
        : null;
    case "checkpoint":
      return typeof x.lessonSlug === "string" &&
        Number.isInteger(x.cursor) &&
        (x.cursor as number) >= 0 &&
        typeof x.completed === "boolean"
        ? { ...base, type, lessonSlug: x.lessonSlug, cursor: x.cursor as number, completed: x.completed }
        : null;
    case "session":
      return (x.mode === "lesson" || x.mode === "review") &&
        (x.lessonSlug === null || typeof x.lessonSlug === "string") &&
        Number.isInteger(x.total) &&
        (x.total as number) > 0 &&
        Number.isInteger(x.correct) &&
        (x.correct as number) >= 0
        ? {
            ...base,
            type,
            mode: x.mode,
            lessonSlug: x.lessonSlug as string | null,
            total: x.total as number,
            correct: Math.min(x.correct as number, x.total as number),
          }
        : null;
    default:
      return null;
  }
}
