import fs from "node:fs";
import path from "node:path";

export type Level = "N5" | "N4" | "N3" | "N2" | "N1";

/** A single vocabulary entry as authored in data/jlpt/<level>/lessons/*.json. */
export type RawWord = {
  word: string;
  reading: string;
  meanings: string[];
  pos: string;
};

export type Word = RawWord & {
  /** Stable, content-derived id. See {@link wordId}. */
  id: string;
  level: Level;
  lessonSlug: string;
  /**
   * Every Han character in `word`, in order of first appearance.
   *
   * This is the honest answer to "is this word written with kanji", which is
   * what the study engine needs in order to decide whether asking for a reading
   * is a fair question.
   */
  kanji: string[];
  /**
   * The subset of `kanji` that appears on this level's studied kanji list.
   *
   * Only these have readings, meanings and stroke counts in kanji.json, so only
   * these can be shown as reference cards or linked to the kanji screen. N5
   * vocabulary routinely contains characters from higher levels — 大丈夫 is on
   * every N5 list, but 丈 and 夫 are not N5 kanji.
   */
  levelKanji: string[];
};

export type RawLesson = {
  slug: string;
  title: string;
  summary: string;
  words: RawWord[];
};

export type Lesson = {
  slug: string;
  title: string;
  summary: string;
  level: Level;
  /** 1-based position in the level's curriculum. */
  order: number;
  words: Word[];
};

export type Kanji = {
  char: string;
  strokes: number;
  meanings: string[];
  onyomi: string[];
  kunyomi: string[];
};

/**
 * Derives a word's permanent id from its content.
 *
 * Progress rows in Postgres key off this string, so it must be reproducible
 * from the JSON alone and must never depend on array order — inserting a word
 * into the middle of a lesson has to leave every other id untouched. A word
 * that moves to a different lesson is deliberately treated as a new word.
 *
 * FNV-1a over the level, lesson and surface form. 64 bits via two independent
 * 32-bit passes, which is ample for a few thousand entries and, unlike a
 * crypto hash, is identical in Node and in the browser with no imports.
 */
export function wordId(level: Level, lessonSlug: string, word: string, reading: string): string {
  const key = `${level}|${lessonSlug}|${word}|${reading}`;
  let h1 = 0x811c9dc5;
  let h2 = 0x01000193;
  for (let i = 0; i < key.length; i++) {
    const c = key.charCodeAt(i);
    h1 = Math.imul(h1 ^ c, 0x01000193) >>> 0;
    h2 = Math.imul(h2 ^ c, 0x85ebca6b) >>> 0;
  }
  const hex = h1.toString(16).padStart(8, "0") + h2.toString(16).padStart(8, "0");
  return `${level.toLowerCase()}_${hex}`;
}

const DATA_ROOT = path.join(process.cwd(), "data", "jlpt");

/** Han script, i.e. kanji. Excludes the kana a word is otherwise written in. */
const HAN = /\p{Script=Han}/u;

function readJson<T>(file: string): T {
  return JSON.parse(fs.readFileSync(file, "utf8")) as T;
}

/**
 * Lesson files are numbered so the filesystem order is the curriculum order.
 * A file holds several lessons; they keep their in-file order.
 */
function loadLevel(level: Level): { lessons: Lesson[]; kanji: Kanji[] } {
  const levelDir = path.join(DATA_ROOT, level.toLowerCase());
  const lessonDir = path.join(levelDir, "lessons");

  const files = fs
    .readdirSync(lessonDir)
    .filter((f) => f.endsWith(".json"))
    .sort();

  const kanji = readJson<Kanji[]>(path.join(levelDir, "kanji.json"));
  const kanjiSet = new Set(kanji.map((k) => k.char));

  const lessons: Lesson[] = [];
  for (const file of files) {
    for (const raw of readJson<RawLesson[]>(path.join(lessonDir, file))) {
      lessons.push({
        slug: raw.slug,
        title: raw.title,
        summary: raw.summary,
        level,
        order: lessons.length + 1,
        words: raw.words.map((w) => {
          const kanji = [...new Set([...w.word].filter((ch) => HAN.test(ch)))];
          return {
            ...w,
            id: wordId(level, raw.slug, w.word, w.reading),
            level,
            lessonSlug: raw.slug,
            kanji,
            levelKanji: kanji.filter((ch) => kanjiSet.has(ch)),
          };
        }),
      });
    }
  }

  return { lessons, kanji };
}

/**
 * Content is static and read-only, so it is parsed once per server process.
 * Adding N4-N1 means dropping a directory beside n5 and extending this map.
 */
const LEVELS: Level[] = ["N5"];

const cache = new Map<Level, ReturnType<typeof loadLevel>>();

function level(l: Level) {
  let entry = cache.get(l);
  if (!entry) {
    entry = loadLevel(l);
    cache.set(l, entry);
  }
  return entry;
}

export function availableLevels(): Level[] {
  return LEVELS;
}

export function getLessons(l: Level = "N5"): Lesson[] {
  return level(l).lessons;
}

export function getLesson(slug: string, l: Level = "N5"): Lesson | undefined {
  return level(l).lessons.find((x) => x.slug === slug);
}

export function getKanji(l: Level = "N5"): Kanji[] {
  return level(l).kanji;
}

export function getAllWords(l: Level = "N5"): Word[] {
  return level(l).lessons.flatMap((x) => x.words);
}

export function getWordsById(ids: Iterable<string>, l: Level = "N5"): Map<string, Word> {
  const wanted = new Set(ids);
  const out = new Map<string, Word>();
  for (const w of getAllWords(l)) if (wanted.has(w.id)) out.set(w.id, w);
  return out;
}

/** Every word whose surface form contains the given kanji. */
export function getWordsUsingKanji(char: string, l: Level = "N5"): Word[] {
  return getAllWords(l).filter((w) => w.kanji.includes(char));
}

export function levelStats(l: Level = "N5") {
  const lessons = getLessons(l);
  return {
    level: l,
    lessons: lessons.length,
    words: lessons.reduce((n, x) => n + x.words.length, 0),
    kanji: getKanji(l).length,
  };
}
