import fs from "node:fs";
import path from "node:path";

export type Level = "N5" | "N4" | "N3" | "N2" | "N1";

/**
 * A vocabulary entry as authored in data/jlpt/<level>/lessons/*.json.
 *
 * `teaches` is the point of the whole file: the curriculum is spined on kanji,
 * and a word exists to demonstrate one specific character. The validator
 * enforces that the word actually contains it.
 */
export type RawWord = {
  word: string;
  reading: string;
  meanings: string[];
  pos: string;
  teaches: string;
};

export type Word = RawWord & {
  /** Stable, content-derived id. See {@link wordId}. */
  id: string;
  level: Level;
  lessonSlug: string;
  /** Every Han character in `word`, in order of first appearance. */
  kanji: string[];
  /** The subset of `kanji` that this level studies and has data for. */
  levelKanji: string[];
};

export type RawKanji = {
  char: string;
  strokes: number;
  meanings: string[];
  onyomi: string[];
  kunyomi: string[];
};

export type Kanji = RawKanji & {
  level: Level;
  /** Slug of the lesson that introduces this character. */
  lessonSlug: string;
  /** 1-based position in the level's kanji curriculum. */
  order: number;
  /** Ordered SVG path data, one entry per stroke. Empty if not vendored. */
  strokePaths: string[];
  /** The character's radical, from KanjiVG. */
  radical: string | null;
};

export type RawLesson = {
  slug: string;
  title: string;
  summary: string;
  kanji: string[];
  words: RawWord[];
};

export type Lesson = {
  slug: string;
  title: string;
  summary: string;
  level: Level;
  /** 1-based position in the level's curriculum. */
  order: number;
  /** The characters this lesson introduces, in teaching order. */
  kanji: Kanji[];
  words: Word[];
};

/**
 * Derives a word's permanent id from its content.
 *
 * Progress rows key off this string, so it must be reproducible from the JSON
 * alone and must not depend on array order — inserting a word into the middle
 * of a lesson has to leave every other id untouched. A word that moves to a
 * different lesson is deliberately treated as a new word.
 *
 * FNV-1a over the level, lesson and surface form. 64 bits via two independent
 * 32-bit passes, which is ample here and, unlike a crypto hash, is identical in
 * Node and in the browser with no imports.
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
  return `${level.toLowerCase()}_${h1.toString(16).padStart(8, "0")}${h2.toString(16).padStart(8, "0")}`;
}

const DATA_ROOT = path.join(process.cwd(), "data", "jlpt");

/** Han script, i.e. kanji. Excludes the kana a word is otherwise written in. */
const HAN = /\p{Script=Han}/u;

function readJson<T>(file: string): T {
  return JSON.parse(fs.readFileSync(file, "utf8")) as T;
}

type StrokeFile = {
  viewBox: string;
  kanji: Record<string, { strokes: string[]; radical: string | null }>;
};

/**
 * Lesson files are numbered so the filesystem order is the curriculum order.
 * A file holds several lessons; they keep their in-file order.
 */
function loadLevel(level: Level) {
  const levelDir = path.join(DATA_ROOT, level.toLowerCase());
  const lessonDir = path.join(levelDir, "lessons");

  const rawKanji = readJson<RawKanji[]>(path.join(levelDir, "kanji.json"));
  const byChar = new Map(rawKanji.map((k) => [k.char, k]));
  const kanjiSet = new Set(byChar.keys());

  // Stroke data is optional: without it the app still teaches, it just cannot
  // animate stroke order. See data/jlpt/STROKES-LICENSE.md.
  const strokeFile = path.join(levelDir, "strokes.json");
  const strokeData: StrokeFile = fs.existsSync(strokeFile)
    ? readJson<StrokeFile>(strokeFile)
    : { viewBox: "0 0 109 109", kanji: {} };

  const files = fs.readdirSync(lessonDir).filter((f) => f.endsWith(".json")).sort();

  const lessons: Lesson[] = [];
  const kanji: Kanji[] = [];

  for (const file of files) {
    for (const raw of readJson<RawLesson[]>(path.join(lessonDir, file))) {
      const lessonKanji: Kanji[] = raw.kanji.map((char) => {
        const base = byChar.get(char)!;
        const entry: Kanji = {
          ...base,
          level,
          lessonSlug: raw.slug,
          order: kanji.length + 1,
          strokePaths: strokeData.kanji[char]?.strokes ?? [],
          radical: strokeData.kanji[char]?.radical ?? null,
        };
        kanji.push(entry);
        return entry;
      });

      lessons.push({
        slug: raw.slug,
        title: raw.title,
        summary: raw.summary,
        level,
        order: lessons.length + 1,
        kanji: lessonKanji,
        words: raw.words.map((w) => {
          const chars = [...new Set([...w.word].filter((ch) => HAN.test(ch)))];
          return {
            ...w,
            id: wordId(level, raw.slug, w.word, w.reading),
            level,
            lessonSlug: raw.slug,
            kanji: chars,
            levelKanji: chars.filter((ch) => kanjiSet.has(ch)),
          };
        }),
      });
    }
  }

  return { lessons, kanji, strokeViewBox: strokeData.viewBox };
}

/**
 * Content is static and read-only, so it is parsed once per server process.
 * Adding N4-N1 means dropping a directory beside n5 and extending this list.
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

export function isLevelAvailable(l: string): l is Level {
  return (LEVELS as string[]).includes(l);
}

export type LevelPathEntry = {
  level: Level;
  title: string;
  blurb: string;
  canDo: string;
  /** Community estimate of new characters at this level. Not an official figure. */
  kanjiTarget: number;
  /** Estimated running total once this level is finished. */
  cumulativeKanji: number;
  available: boolean;
  /** Real counts, from the level's own files. Zero for a level not yet built. */
  lessons: number;
  kanji: number;
  words: number;
};

type LevelsFile = {
  note: string;
  levels: Omit<LevelPathEntry, "available" | "lessons" | "kanji" | "words">[];
};

let levelsFile: LevelsFile | null = null;

/**
 * The N5-to-N1 progression.
 *
 * Descriptions and the estimated character counts come from
 * data/jlpt/levels.json; the counts that are actually shown as facts — lessons,
 * kanji, words — are read from each level's own content, so an unbuilt level
 * reports zero rather than borrowing a number from the roadmap file. A level
 * becomes available purely by existing in LEVELS with a data directory, so
 * nothing here needs editing to ship N4.
 */
export function getLevelPath(): LevelPathEntry[] {
  levelsFile ??= readJson<LevelsFile>(path.join(DATA_ROOT, "levels.json"));

  return levelsFile.levels.map((entry) => {
    const available = isLevelAvailable(entry.level);
    if (!available) {
      return { ...entry, available, lessons: 0, kanji: 0, words: 0 };
    }
    const stats = levelStats(entry.level);
    return {
      ...entry,
      available,
      lessons: stats.lessons,
      kanji: stats.kanji,
      words: stats.words,
    };
  });
}

export function getLessons(l: Level = "N5"): Lesson[] {
  return level(l).lessons;
}

export function getLesson(slug: string, l: Level = "N5"): Lesson | undefined {
  return level(l).lessons.find((x) => x.slug === slug);
}

/** Every kanji in curriculum order. */
export function getKanji(l: Level = "N5"): Kanji[] {
  return level(l).kanji;
}

export function getKanjiChar(char: string, l: Level = "N5"): Kanji | undefined {
  return level(l).kanji.find((k) => k.char === char);
}

export function strokeViewBox(l: Level = "N5"): string {
  return level(l).strokeViewBox;
}

export function getAllWords(l: Level = "N5"): Word[] {
  return level(l).lessons.flatMap((x) => x.words);
}

/** The words chosen to demonstrate one character. */
export function getWordsTeaching(char: string, l: Level = "N5"): Word[] {
  return getAllWords(l).filter((w) => w.teaches === char);
}

/** Every word whose written form contains the character, wherever it is taught. */
export function getWordsUsingKanji(char: string, l: Level = "N5"): Word[] {
  return getAllWords(l).filter((w) => w.kanji.includes(char));
}

export function levelStats(l: Level = "N5") {
  const lessons = getLessons(l);
  return {
    level: l,
    lessons: lessons.length,
    kanji: getKanji(l).length,
    words: lessons.reduce((n, x) => n + x.words.length, 0),
  };
}
