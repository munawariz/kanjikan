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

/**
 * Cards that grade a word rather than a character: pick its meaning, pick its
 * reading, or pick the word from its meaning.
 */
export const WORD_QUIZ_KINDS = ["word-meaning", "word-reading", "word-recall"] as const;
export type WordQuizKind = (typeof WORD_QUIZ_KINDS)[number];
export type WordQuizCard = Extract<StudyCard, { kind: WordQuizKind }>;

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

const sameGloss = (a: string, b: string) => a.trim().toLowerCase() === b.trim().toLowerCase();

/**
 * Whether another word in the pool means the same thing.
 *
 * 父, お父さん and 父親 are all "father": knowing that is knowing the
 * character, which its own card already asks. What tells them apart is how
 * each is written and read, so that is what they are tested on.
 */
function hasSynonym(word: Word, pool: Word[]): boolean {
  const gloss = word.meanings[0];
  if (!gloss) return false;
  return pool.some((w) => w.id !== word.id && !!w.meanings[0] && sameGloss(w.meanings[0], gloss));
}

/**
 * Three wrong answers for one card, most confusable first.
 *
 * De-duplicates by rendered label, so two identical options can never both
 * appear. When the options are meanings, or the prompt is one, it also drops
 * any word that shares a meaning with the answer — 万 and 一万 are both "ten
 * thousand", and offered together on a recall card they would be two correct
 * answers. A reading card keeps them: ちち beside おとうさん is exactly the
 * question worth asking about 父.
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
    (w) =>
      w.id !== word.id &&
      (kind === "word-reading" || !w.meanings.some((m) => synonym.has(m.trim().toLowerCase()))),
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

function wordQuiz(word: Word, pool: Word[], rand: () => number): WordQuizCard {
  const kind = wordKind(word, pool, rand);
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
 * Chooses how to test a word, at random: its meaning, its reading, or the word
 * itself from its meaning. Any of the three can come up at any point, so no
 * question becomes one the learner can expect.
 *
 * A word that means the same as another in the pool is always asked for its
 * reading, since its meaning cannot tell it apart (see {@link hasSynonym}). A
 * word written only in kana has no reading to ask.
 */
function wordKind(word: Word, pool: Word[], rand: () => number): WordQuizKind {
  if (word.word === word.reading) return rand() < 0.5 ? "word-meaning" : "word-recall";
  if (hasSynonym(word, pool)) return "word-reading";
  return WORD_QUIZ_KINDS[Math.floor(rand() * WORD_QUIZ_KINDS.length)];
}

/** The character a card is about: its own, or the one its word teaches. */
export function cardChar(card: StudyCard): string {
  return "kanji" in card ? card.kanji.char : card.word.teaches;
}

export type LessonOptions = {
  /** Characters met before, which skip their introduction. */
  seen: ReadonlySet<string>;
  wordStability: Record<string, number>;
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
  { seen, wordStability, skipWords, writing, skipWriting }: LessonOptions,
  seed: number,
): StudyCard[] {
  const rand = rng(seed);
  const queue: StudyCard[] = [];

  for (const k of kanji) {
    const its = words.filter((w) => w.teaches === k.char && !skipWords.has(w.id));

    if (its.length > 0) {
      if (!seen.has(k.char)) queue.push({ kind: "kanji-teach", kanji: k });

      for (const w of its) {
        if (!wordStability[w.id]) queue.push({ kind: "word-teach", word: w });
      }

      queue.push(kanjiQuiz(k, kanji, rand));

      for (const w of shuffle(its, rand)) {
        queue.push(wordQuiz(w, words, rand));
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
  pool: Word[],
  seed: number,
  writing: Kanji[] = [],
): StudyCard[] {
  const rand = rng(seed);
  const from = pool.length >= 8 ? pool : words;
  return [
    ...writing.map((k): StudyCard => ({ kind: "kanji-write", kanji: k })),
    ...words.map((w) => wordQuiz(w, from, rand)),
  ];
}

/**
 * A day's quiz: a few words already learned, each asked one of the three ways.
 *
 * Drawn uniformly, not weakest-first. Reviews already chase the weak words;
 * this is a sample of what has stuck, and the answers are recorded to measure
 * exactly that — a sample biased towards failures would make the record
 * worthless as a measure. Distractors come from the whole level, so knowing
 * only the learned words is no help in eliminating options.
 */
export function buildDailyQuiz(learned: Word[], pool: Word[], size: number, seed: number): WordQuizCard[] {
  const rand = rng(seed);
  return shuffle(learned, rand)
    .slice(0, size)
    .map((w) => wordQuiz(w, pool, rand));
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
        reading.push(wordQuiz(w, wordPool, rand));
      }
    }
  }

  return [...writing, ...shuffle(reading, rand)];
}
