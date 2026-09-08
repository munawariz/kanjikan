import type { Kanji, Word } from "@/lib/content";

/**
 * Queue construction for a study or review run.
 *
 * Pure and deterministic given a seed. The seed comes from the server and is
 * passed down, so the server render and the client hydration build an identical
 * queue — shuffling with Math.random here produces a hydration mismatch on
 * every session.
 */

export type Choice = { id: string; label: string };

export type StudyCard =
  /** Introduce a character: glyph, readings, radical, stroke order. */
  | { kind: "kanji-teach"; kanji: Kanji }
  /** Reproduce a character from memory on the writing pad. */
  | { kind: "kanji-write"; kanji: Kanji }
  /** Show a word that demonstrates the character just taught. */
  | { kind: "word-teach"; word: Word }
  | { kind: "kanji-meaning"; kanji: Kanji; choices: Choice[]; answerId: string }
  | {
      kind: "word-meaning" | "word-reading" | "word-recall";
      word: Word;
      choices: Choice[];
      answerId: string;
    };

export type CardKind = StudyCard["kind"];

/** Cards that grade a word rather than a character. */
export const WORD_QUIZ_KINDS = ["word-meaning", "word-reading", "word-recall"] as const;

/** mulberry32 — small, fast, and good enough for shuffling a study deck. */
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

const wordLabel = {
  "word-meaning": (w: Word) => w.meanings[0],
  "word-recall": (w: Word) => w.word,
  "word-reading": (w: Word) => w.reading,
} as const;

/**
 * Three wrong answers for one card.
 *
 * Same part of speech is preferred: a question whose only plausible option is
 * the right one can be answered without knowing the word. Falls back to the
 * wider pool, and de-duplicates by rendered label so two identical options can
 * never both appear.
 */
function wordDistractors(
  word: Word,
  pool: Word[],
  kind: (typeof WORD_QUIZ_KINDS)[number],
  rand: () => number,
): Choice[] {
  const render = wordLabel[kind];
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
  const chosen = pick(others.filter((w) => w.pos === word.pos));
  if (chosen.length < 3) {
    for (const extra of pick(others)) {
      if (chosen.length === 3) break;
      chosen.push(extra);
    }
  }
  return chosen;
}

function wordQuiz(
  word: Word,
  pool: Word[],
  kind: (typeof WORD_QUIZ_KINDS)[number],
  rand: () => number,
): StudyCard {
  const options = [
    { id: word.id, label: wordLabel[kind](word) },
    ...wordDistractors(word, pool, kind, rand),
  ];
  return { kind, word, choices: shuffle(options, rand), answerId: word.id };
}

/** Meaning quiz for a character, with other characters as distractors. */
function kanjiQuiz(kanji: Kanji, pool: Kanji[], rand: () => number): StudyCard {
  const taken = new Set([kanji.meanings[0]]);
  const distractors: Choice[] = [];
  for (const k of shuffle(pool.filter((k) => k.char !== kanji.char), rand)) {
    if (distractors.length === 3) break;
    const label = k.meanings[0];
    if (!label || taken.has(label)) continue;
    taken.add(label);
    distractors.push({ id: k.char, label });
  }
  const options = [{ id: kanji.char, label: kanji.meanings[0] }, ...distractors];
  return { kind: "kanji-meaning", kanji, choices: shuffle(options, rand), answerId: kanji.char };
}

/**
 * Chooses how to test a word.
 *
 * Meaning first, because a word you cannot translate is not learned. Readings
 * come next, since fixing the reading of the character is the whole point of
 * the exercise. Production — English to Japanese — is saved for later stages,
 * where it is a fair ask.
 */
function wordKind(word: Word, stage: number, rand: () => number): (typeof WORD_QUIZ_KINDS)[number] {
  const canAskReading = word.word !== word.reading;
  if (stage <= 1) return "word-meaning";
  if (stage <= 3) return canAskReading && rand() < 0.6 ? "word-reading" : "word-meaning";
  const roll = rand();
  if (canAskReading && roll < 0.4) return "word-reading";
  return roll < 0.75 ? "word-recall" : "word-meaning";
}

/**
 * A lesson run, one character at a time.
 *
 * Each character gets a complete cycle — meet it, meet its words, be tested on
 * those words, then write it from memory — before the next one starts.
 * Teaching all five up front and quizzing at the end means the first character
 * is long gone by the time it comes back.
 */
export function buildLessonQueue(
  kanji: Kanji[],
  words: Word[],
  kanjiStages: Record<string, number>,
  wordStages: Record<string, number>,
  seed: number,
): StudyCard[] {
  const rand = rng(seed);
  const queue: StudyCard[] = [];

  for (const k of kanji) {
    const isNew = !kanjiStages[k.char];
    if (isNew) queue.push({ kind: "kanji-teach", kanji: k });

    const its = words.filter((w) => w.teaches === k.char);

    for (const w of its) {
      if (!wordStages[w.id]) queue.push({ kind: "word-teach", word: w });
    }

    queue.push(kanjiQuiz(k, kanji, rand));

    for (const w of shuffle(its, rand)) {
      queue.push(wordQuiz(w, words, wordKind(w, wordStages[w.id] ?? 0, rand), rand));
    }

    queue.push({ kind: "kanji-write", kanji: k });
  }

  return queue;
}

/** A review run: no teaching, one question per due word, hardest first. */
export function buildReviewQueue(
  words: Word[],
  wordStages: Record<string, number>,
  pool: Word[],
  seed: number,
): StudyCard[] {
  const rand = rng(seed);
  return words.map((w) =>
    wordQuiz(w, pool.length >= 8 ? pool : words, wordKind(w, wordStages[w.id] ?? 0, rand), rand),
  );
}

/** A writing run: reproduce each due character from memory. */
export function buildWritingQueue(kanji: Kanji[]): StudyCard[] {
  return kanji.map((k) => ({ kind: "kanji-write", kanji: k }));
}

export const PROMPT: Record<Exclude<CardKind, "kanji-teach" | "kanji-write" | "word-teach">, string> = {
  "kanji-meaning": "What does this character mean?",
  "word-meaning": "What does this word mean?",
  "word-reading": "How is this read?",
  "word-recall": "Which word is this?",
};
