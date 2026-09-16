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

export type KanjiQuizCard = Extract<StudyCard, { kind: "kanji-meaning" }>;

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
 * Carry no meaning on their own, so sharing one says nothing about two words.
 * Glosses are in whichever language the learner reads, so both are listed.
 */
const GLOSS_STOPWORDS = new Set([
  "a", "an", "the", "of", "to", "in", "on", "at", "for", "and", "or", "with",
  "it", "is", "be", "this", "that", "from", "by", "as", "up",
  "yang", "di", "ke", "dari", "dan", "atau", "untuk", "dengan", "pada", "oleh",
  "dalam", "sebagai", "ini", "itu",
]);

function glossTokens(word: Word): Set<string> {
  const out = new Set<string>();
  for (const m of word.meanings) {
    for (const t of m.toLowerCase().split(/[^a-z0-9]+/)) {
      if (t && !GLOSS_STOPWORDS.has(t)) out.add(t);
    }
  }
  return out;
}

/**
 * How hard a candidate would be to rule out without knowing the answer.
 *
 * The point of a distractor is to be eliminable only by knowledge. Ask what
 * 三つ means beside "four things" and "five people" and the question answers
 * itself: three is the one word of the prompt the learner can already read, so
 * every option that does not say "three" is free. Ask it beside "three people"
 * and "three o'clock" and the shortcut is gone — what is being tested is which
 * counter 三 is paired with, which is the thing worth knowing.
 *
 * Sharing a character is what generalises that beyond numbers, and it is the
 * dominant term for every question type. It works in both directions: the
 * English options all inherit the character's meaning, and when the options are
 * Japanese the answer can no longer be spotted as the only one containing the
 * character from the prompt.
 */
function confusability(word: Word, kanji: Set<string>, gloss: Set<string>) {
  return (candidate: Word) => {
    let score = 0;
    // The character the card is built around is held constant, so what varies
    // between the options is what it is paired with. Sharing some other
    // character still helps, and a candidate that shares both is better still.
    //
    // Ten, deliberately: more than every other term added together, so a word
    // containing the character always outranks one that does not, and the rest
    // of the score only orders words within those two groups.
    if (candidate.kanji.includes(word.teaches)) score += 10;
    if (candidate.kanji.some((c) => c !== word.teaches && kanji.has(c))) score += 4;
    for (const t of glossTokens(candidate)) {
      if (gloss.has(t)) {
        score += 2;
        break;
      }
    }
    if (candidate.pos === word.pos) score += 2;
    return score;
  };
}

/**
 * Three wrong answers for one card, most confusable first.
 *
 * De-duplicates by rendered label, so two identical options can never both
 * appear, and drops any word that shares a meaning with the answer — 万 and
 * 一万 are both "ten thousand", and offered together on a recall card they
 * would be two correct answers.
 */
function wordDistractors(
  word: Word,
  pool: Word[],
  kind: (typeof WORD_QUIZ_KINDS)[number],
  rand: () => number,
): Choice[] {
  const render = wordLabel[kind];
  const taken = new Set([render(word)]);
  const synonym = new Set(word.meanings.map((m) => m.trim().toLowerCase()));
  const score = confusability(word, new Set(word.kanji), glossTokens(word));

  const candidates = pool.filter(
    (w) => w.id !== word.id && !w.meanings.some((m) => synonym.has(m.trim().toLowerCase())),
  );

  // Shuffle first, then sort: Array.sort is stable, so equally confusable
  // candidates stay in random — but seeded, and so reproducible — order.
  const ranked = shuffle(candidates, rand).sort((a, b) => score(b) - score(a));

  const out: Choice[] = [];
  for (const c of ranked) {
    if (out.length === 3) break;
    const text = render(c);
    if (!text || taken.has(text)) continue;
    taken.add(text);
    out.push({ id: c.id, label: text });
  }
  return out;
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

/** All a distractor needs of another character: what it is, and what it means. */
export type KanjiGloss = Pick<Kanji, "char" | "meanings">;

/** Meaning quiz for a character, with other characters as distractors. */
function kanjiQuiz(kanji: Kanji, pool: KanjiGloss[], rand: () => number): KanjiQuizCard {
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

/** The character a card is about: its own, or the one its word teaches. */
export function cardChar(card: StudyCard): string {
  return "kanji" in card ? card.kanji.char : card.word.teaches;
}

export type LessonOptions = {
  /** Characters met before, which skip their introduction. */
  seen: ReadonlySet<string>;
  wordStages: Record<string, number>;
  /** Words marked as already known: nothing about them is taught or asked. */
  skipWords: ReadonlySet<string>;
  /** Whether each character ends by being written from memory. */
  writing: boolean;
  /** Characters whose writing is marked as already known. */
  skipWriting: ReadonlySet<string>;
};

/**
 * A lesson run, one character at a time.
 *
 * Each character gets a complete cycle — meet it, meet its words, be tested on
 * those words, then, for a learner who studies writing, write it from memory —
 * before the next one starts. Teaching all five up front and quizzing at the
 * end means the first character is long gone by the time it comes back.
 *
 * What the learner has marked as known is left out: its words entirely, and
 * its writing card. A character with every word marked has nothing left to
 * read, so it is not introduced either; if its writing is still to learn, the
 * cycle is just that card.
 */
export function buildLessonQueue(
  kanji: Kanji[],
  words: Word[],
  { seen, wordStages, skipWords, writing, skipWriting }: LessonOptions,
  seed: number,
): StudyCard[] {
  const rand = rng(seed);
  const queue: StudyCard[] = [];

  for (const k of kanji) {
    const its = words.filter((w) => w.teaches === k.char && !skipWords.has(w.id));

    if (its.length > 0) {
      if (!seen.has(k.char)) queue.push({ kind: "kanji-teach", kanji: k });

      for (const w of its) {
        if (!wordStages[w.id]) queue.push({ kind: "word-teach", word: w });
      }

      queue.push(kanjiQuiz(k, kanji, rand));

      for (const w of shuffle(its, rand)) {
        queue.push(wordQuiz(w, words, wordKind(w, wordStages[w.id] ?? 0, rand), rand));
      }
    }

    if (writing && !skipWriting.has(k.char)) queue.push({ kind: "kanji-write", kanji: k });
  }

  return queue;
}

/**
 * A review run: no teaching, one question per due word.
 *
 * Due writing comes first, for the same reason as in practice: every word card
 * shows the characters it is written with, so writing one afterwards would be
 * copying what was just on screen rather than recalling it.
 */
export function buildReviewQueue(
  words: Word[],
  wordStages: Record<string, number>,
  pool: Word[],
  seed: number,
  writing: Kanji[] = [],
): StudyCard[] {
  const rand = rng(seed);
  return [
    ...writing.map((k): StudyCard => ({ kind: "kanji-write", kanji: k })),
    ...words.map((w) =>
      wordQuiz(w, pool.length >= 8 ? pool : words, wordKind(w, wordStages[w.id] ?? 0, rand), rand),
    ),
  ];
}

/**
 * A day's quiz: the meaning of a few characters already learned.
 *
 * Drawn uniformly, not weakest-first. Reviews already chase the weak
 * characters; this is a sample of what has stuck, and the answers are recorded
 * to measure exactly that — a sample biased towards failures would make the
 * record worthless as a measure. Distractors come from the whole level, so
 * knowing only the learned characters is no help in eliminating options.
 */
export function buildDailyQuiz(
  learned: Kanji[],
  pool: Kanji[],
  size: number,
  seed: number,
): KanjiQuizCard[] {
  const rand = rng(seed);
  return shuffle(learned, rand)
    .slice(0, size)
    .map((k) => kanjiQuiz(k, pool, rand));
}

/**
 * What a practice run can drill. Reading is the multiple-choice cards: what
 * each character means, and what the words it teaches mean and how they are
 * read. Writing is the pad. Hearing is planned and not built.
 */
export const PRACTICE_TYPES = ["reading", "writing"] as const;
export type PracticeType = (typeof PRACTICE_TYPES)[number];

export function isPracticeType(value: string): value is PracticeType {
  return (PRACTICE_TYPES as readonly string[]).includes(value);
}

/**
 * A practice run over characters the learner picked for themselves.
 *
 * Nothing here is due, so there is no order to respect and the cards are
 * shuffled: reading cards grouped by character would let each meaning card
 * give away the words that follow it, and writing in curriculum order lets the
 * learner know what is coming. Distractors come from the whole level, since a
 * pick of two characters has too few of its own to offer three wrong answers.
 *
 * With both kinds chosen, all the writing comes first. Every reading card
 * shows a character, so writing one after its meaning card would be copying
 * something just seen rather than recalling it.
 */
export function buildPracticeQueue(
  types: readonly PracticeType[],
  kanji: Kanji[],
  words: Word[],
  kanjiPool: KanjiGloss[],
  wordPool: Word[],
  wordStages: Record<string, number>,
  seed: number,
): StudyCard[] {
  const rand = rng(seed);
  const writing: StudyCard[] = types.includes("writing")
    ? shuffle(kanji, rand).map((k) => ({ kind: "kanji-write", kanji: k }))
    : [];

  const reading: StudyCard[] = [];
  if (types.includes("reading")) {
    for (const k of kanji) {
      reading.push(kanjiQuiz(k, kanjiPool, rand));
      for (const w of words.filter((w) => w.teaches === k.char)) {
        reading.push(wordQuiz(w, wordPool, wordKind(w, wordStages[w.id] ?? 0, rand), rand));
      }
    }
  }

  return [...writing, ...shuffle(reading, rand)];
}
