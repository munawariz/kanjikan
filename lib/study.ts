import type { Word } from "@/lib/content";

/**
 * Queue construction for a study or review run.
 *
 * Pure and deterministic given a seed. The seed is generated on the server and
 * passed down, so the server render and the client hydration build an identical
 * queue — shuffling with Math.random here would produce a hydration mismatch on
 * every session.
 */

export type Choice = { id: string; label: string };

export type StudyCard =
  | { kind: "teach"; word: Word }
  | { kind: "meaning" | "recall" | "reading"; word: Word; choices: Choice[]; answerId: string };

export type CardKind = StudyCard["kind"];

/** mulberry32 — small, fast, and good enough for shuffling a 20-word deck. */
export function rng(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function shuffle<T>(items: T[], rand: () => number): T[] {
  const out = [...items];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

const label = {
  meaning: (w: Word) => w.meanings[0],
  recall: (w: Word) => w.word,
  reading: (w: Word) => w.reading,
} as const;

/**
 * Three wrong answers for one card.
 *
 * Same part of speech is preferred, because a question whose only noun option
 * is the right one can be answered without knowing the word. Falls back to the
 * wider pool when a lesson does not hold enough of one type, and de-duplicates
 * by the rendered label so two identical options can never both appear.
 */
function distractors(word: Word, pool: Word[], kind: "meaning" | "recall" | "reading", rand: () => number): Choice[] {
  const render = label[kind];
  const taken = new Set([render(word)]);

  const pick = (candidates: Word[]) => {
    const out: Choice[] = [];
    for (const c of shuffle(candidates, rand)) {
      if (out.length === 3) break;
      const text = render(c);
      if (!text || taken.has(text)) continue;
      taken.add(text);
      out.push({ id: c.id, label: text });
    }
    return out;
  };

  const others = pool.filter((w) => w.id !== word.id);
  const sameKanjiUse = kind === "reading" ? others.filter((w) => w.kanji.length > 0) : others;

  const chosen = pick(others.filter((w) => w.pos === word.pos));
  if (chosen.length < 3) {
    for (const extra of pick(sameKanjiUse)) {
      if (chosen.length === 3) break;
      chosen.push(extra);
    }
  }
  return chosen;
}

function quizCard(
  word: Word,
  pool: Word[],
  kind: "meaning" | "recall" | "reading",
  rand: () => number,
): StudyCard {
  const options = [
    { id: word.id, label: label[kind](word) },
    ...distractors(word, pool, kind, rand),
  ];
  return { kind, word, choices: shuffle(options, rand), answerId: word.id };
}

/**
 * Chooses how to test a word.
 *
 * Meaning first, because a word you cannot translate is not learned yet.
 * Reading questions only appear for words written with kanji and only once the
 * meaning is established, and production (English to Japanese) is saved for
 * later stages where it is a fair ask.
 */
function kindFor(word: Word, stage: number, rand: () => number): "meaning" | "recall" | "reading" {
  // word.kanji is every Han character, not just the ones on the studied list.
  // Gating on the studied list instead would make a reading unaskable for the
  // hundreds of N5 words written with higher-level kanji — 大丈夫, 全然, 少し —
  // which are exactly the ones whose reading needs practice.
  const canAskReading = word.kanji.length > 0 && word.word !== word.reading;

  if (stage <= 1) return "meaning";
  if (stage <= 3) return canAskReading && rand() < 0.5 ? "reading" : "meaning";
  const roll = rand();
  if (canAskReading && roll < 0.35) return "reading";
  return roll < 0.7 ? "recall" : "meaning";
}

const CHUNK = 5;

/**
 * A lesson run: teach a handful of new words, quiz that same handful straight
 * away, then move on. Interleaving in small groups beats teaching all twenty
 * and quizzing at the end, where the first words are long gone by the time
 * they come back.
 */
export function buildLessonQueue(
  words: Word[],
  stages: Record<string, number>,
  seed: number,
): StudyCard[] {
  const rand = rng(seed);
  const queue: StudyCard[] = [];

  for (let i = 0; i < words.length; i += CHUNK) {
    const chunk = words.slice(i, i + CHUNK);

    for (const w of chunk) {
      if (!stages[w.id]) queue.push({ kind: "teach", word: w });
    }
    for (const w of shuffle(chunk, rand)) {
      queue.push(quizCard(w, words, kindFor(w, stages[w.id] ?? 0, rand), rand));
    }
  }

  return queue;
}

/** A review run: no teaching, one question per due word, hardest first. */
export function buildReviewQueue(
  words: Word[],
  stages: Record<string, number>,
  pool: Word[],
  seed: number,
): StudyCard[] {
  const rand = rng(seed);
  return words.map((w) =>
    quizCard(w, pool.length >= 8 ? pool : words, kindFor(w, stages[w.id] ?? 0, rand), rand),
  );
}

export const PROMPT: Record<Exclude<CardKind, "teach">, string> = {
  meaning: "What does this mean?",
  recall: "Which word is this?",
  reading: "How is this read?",
};
