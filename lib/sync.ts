import "server-only";
import { asUser, type Db } from "@/lib/db";
import {
  getKanjiChar,
  getLesson,
  getWord,
  getWordsTeaching,
  type Kanji,
  type Level,
  type Word,
} from "@/lib/content";
import {
  markWordsKnownIn,
  markWritingKnownIn,
  recordAnswerIn,
  recordSessionIn,
  recordWritingAnswerIn,
  saveCheckpointIn,
} from "@/lib/progress";
import type { SyncEvent } from "@/lib/sync-events";

/**
 * What a mark covers, resolved against the content files so a forged id cannot
 * write a row for something outside the curriculum.
 *
 * Reading a kanji or a lesson means reading the words that teach it, since
 * that is where reading mastery lives. Null for a scope that is not one.
 */
export function resolveMark(scope: unknown, id: string): { words: Word[]; kanji: Kanji[] } | null {
  if (scope === "word") {
    const w = getWord(id);
    return { words: w ? [w] : [], kanji: [] };
  }
  if (scope === "kanji") {
    const k = getKanjiChar(id);
    return k ? { words: getWordsTeaching(k.char), kanji: [k] } : { words: [], kanji: [] };
  }
  if (scope === "lesson") {
    const lesson = getLesson(id);
    return lesson ? { words: lesson.words, kanji: lesson.kanji } : { words: [], kanji: [] };
  }
  return null;
}

/** How long a receipt is kept: far longer than any event waits in a queue. */
const RECEIPT_DAYS = 30;

/**
 * Applies one event from the browser's queue, as it happened at `at`, and
 * records its receipt in the same transaction. An event whose receipt already
 * exists was applied by an earlier send whose reply never arrived, and is
 * skipped; one that fails rolls back with its receipt, so a retry applies it.
 *
 * An event naming a word, character or lesson the content does not have is
 * dropped: resending it could never succeed.
 */
export async function applyEvent(userId: string, event: SyncEvent, at: Date): Promise<void> {
  await asUser(userId, async (db) => {
    const receipt = await db.query(
      `insert into public.sync_receipts (user_id, event_id) values ($1, $2) on conflict do nothing`,
      [userId, event.id],
    );
    if (receipt.rowCount === 0) return;
    await apply(db, userId, event, at);
  });
}

async function apply(db: Db, userId: string, e: SyncEvent, at: Date): Promise<void> {
  switch (e.type) {
    case "answer": {
      const word = getWord(e.wordId);
      if (word) await recordAnswerIn(db, userId, word, e.correct, at);
      else unknown(e, e.wordId);
      return;
    }
    case "writing": {
      const kanji = getKanjiChar(e.char);
      if (kanji) await recordWritingAnswerIn(db, userId, kanji, e.correct, at);
      else unknown(e, e.char);
      return;
    }
    case "mark": {
      const { words, kanji } = resolveMark(e.scope, e.target) ?? { words: [], kanji: [] };
      if (e.skill === "reading") await markWordsKnownIn(db, userId, words, at);
      else await markWritingKnownIn(db, userId, kanji, at);
      return;
    }
    case "checkpoint": {
      const lesson = getLesson(e.lessonSlug);
      if (!lesson) return unknown(e, e.lessonSlug);
      await saveCheckpointIn(db, userId, lesson.level, lesson.slug, e.cursor, e.completed, {
        at,
        merge: e.merged,
      });
      return;
    }
    case "session": {
      // A lesson belongs to one level. A review can mix levels, so it is
      // logged against the one the learner is working through.
      const lesson = e.lessonSlug ? getLesson(e.lessonSlug) : undefined;
      let level: Level = lesson?.level ?? "N5";
      if (!lesson) {
        const { rows } = await db.query<{ current_level: Level }>(
          `select current_level from public.profiles where id = $1`,
          [userId],
        );
        level = rows[0]?.current_level ?? level;
      }
      await recordSessionIn(db, userId, level, e.mode, lesson?.slug ?? null, e.total, e.correct, at);
      return;
    }
  }
}

function unknown(e: SyncEvent, what: string) {
  console.error(`[kanjikan] sync: dropped ${e.type} event ${e.id} for unknown ${what}`);
}

/** Drops receipts old enough that no retry can still be coming for them. */
export async function pruneReceipts(userId: string): Promise<void> {
  await asUser(userId, (db) =>
    db.query(
      `delete from public.sync_receipts
        where user_id = $1 and applied_at < now() - make_interval(days => $2)`,
      [userId, RECEIPT_DAYS],
    ),
  );
}
