import fs from "node:fs";
import path from "node:path";
import { DEFAULT_LOCALE, type Locale } from "@/lib/i18n/config";

export type Level = "N5" | "N4" | "N3" | "N2" | "N1";

/*
 * Content lives in two trees under data/jlpt (the README's "Contributing"
 * section describes both):
 *
 *   <level>/            What is true in every language: characters, readings,
 *                       stroke counts, parts, which words a lesson teaches.
 *   locales/<locale>/   What a learner reads, per language: meanings, lesson
 *                       titles and summaries, memory stories, part roles.
 *
 * English is the reference language. Every other one must translate all of
 * it, and validate-content.mjs refuses a built level that does not; the
 * loader still falls back to English for anything missing, so a gap shows
 * English rather than nothing. Word ids come from the first tree alone, so a
 * learner's progress is the same whatever language they read it in.
 */

/**
 * A vocabulary entry as authored in data/jlpt/<level>/lessons/*.json.
 *
 * `teaches` is the point of the whole file: the curriculum is spined on kanji,
 * and a word exists to demonstrate one specific character. The validator
 * enforces that the word actually contains it.
 */
type AuthoredWord = {
  word: string;
  reading: string;
  /** One of the parts of speech listed in validate-content.mjs. */
  pos: string;
  teaches: string;
};

export type RawWord = AuthoredWord & {
  /** From locales/<locale>/<level>/lessons/*.json. */
  meanings: string[];
};

export type Word = RawWord & {
  /** Stable, content-derived id. See {@link wordId}. */
  id: string;
  level: Level;
  lessonSlug: string;
  /** Every Han character in `word`, in order of first appearance. */
  kanji: string[];
};

/** A character as authored in data/jlpt/<level>/kanji.json. */
type AuthoredKanji = {
  char: string;
  strokes: number;
  onyomi: string[];
  kunyomi: string[];
};

export type RawKanji = AuthoredKanji & {
  /** From locales/<locale>/<level>/kanji.json. */
  meanings: string[];
};

/**
 * A building block of a kanji — a radical, a primitive, or a whole kanji
 * reused inside another. Learning these is what turns a new character from a
 * tangle of strokes into a few pieces already known.
 */
export type KanjiPart = {
  char: string;
  meaning: string;
  /**
   * What it stands for in this one kanji, where that differs from its usual
   * meaning: 人 is a person, but in 食 it is the lid. Null elsewhere.
   */
  role: string | null;
  /** Japanese name of the radical or radical form, e.g. にんべん. */
  name: string | null;
  /** How it looks or behaves inside other characters. */
  note: string | null;
  /**
   * The first kanji of the curriculum built from this part, or that is it —
   * in any level, so a part of an N4 kanji can have been met in N5.
   */
  firstSeen: string;
  /** Lesson number of {@link firstSeen}. See {@link Lesson.order}. */
  firstLesson: number;
};

export type Kanji = RawKanji & {
  level: Level;
  /** Slug of the lesson that introduces this character. */
  lessonSlug: string;
  /** 1-based position in the whole curriculum, across levels. */
  order: number;
  /** Number of the introducing lesson. See {@link Lesson.order}. */
  lessonOrder: number;
  /** Ordered SVG path data, one entry per stroke. Empty if not vendored. */
  strokePaths: string[];
  /** The dictionary radical, in the form it takes inside this character. */
  radical: string | null;
  radicalPart: KanjiPart | null;
  /** The visible pieces it is built from. Empty for a kanji that is itself a basic shape. */
  parts: KanjiPart[];
  /** A short story tying the parts to the meaning. */
  mnemonic: string | null;
  /** Later kanji built from this one, in curriculum order, in any level. */
  usedIn: RelatedKanji[];
};

/** Just enough of another kanji to say what it is without leaving the page. */
export type RelatedKanji = Pick<RawKanji, "char" | "meanings" | "onyomi" | "kunyomi"> & {
  lessonOrder: number;
};

/** A part as resolved: its character, or its character and the role it plays here. */
type RawPart = string | { char: string; as: string };

/** Structure and text of every kanji's parts, merged, for {@link attachParts}. */
type MnemonicFile = {
  primitives: Record<string, { meaning?: string; name?: string; note?: string }>;
  kanji: Record<string, { radical: string; parts: RawPart[]; mnemonic: string }>;
};

const partChar = (p: RawPart) => (typeof p === "string" ? p : p.char);

/**
 * data/jlpt/<level>/parts.json. A primitive is a piece that is not a kanji of
 * the curriculum, or that needs a Japanese name; `roles` lists the parts that
 * stand for something other than their usual meaning in that one kanji.
 */
type PartsFile = {
  primitives: Record<string, { name?: string }>;
  kanji: Record<string, { radical: string; parts: string[]; roles?: string[] }>;
};

/** data/jlpt/<level>/lessons/*.json. */
type AuthoredLesson = {
  slug: string;
  /** The characters it introduces, in teaching order. */
  kanji: string[];
  words: AuthoredWord[];
};

/** Everything a learner reads about one level, in one language. */
type LevelText = {
  /** kanji.json: character to meanings. */
  kanji: Record<string, string[]>;
  /** mnemonics.json. `roles` gives the role of each part parts.json lists under roles. */
  mnemonics: {
    primitives: Record<string, { meaning?: string; note?: string }>;
    kanji: Record<string, { mnemonic: string; roles?: Record<string, string> }>;
  };
  /** lessons/*.json: by slug, with words keyed "word|reading". */
  lessons: Record<string, { title: string; summary: string; words: Record<string, string[]> }>;
};

function readText(level: Level, locale: Locale): LevelText {
  const dir = path.join(LOCALE_ROOT, locale, level.toLowerCase());
  const optional = <T>(file: string, empty: T): T =>
    fs.existsSync(path.join(dir, file)) ? readJson<T>(path.join(dir, file)) : empty;

  const lessons: LevelText["lessons"] = {};
  const lessonDir = path.join(dir, "lessons");
  if (fs.existsSync(lessonDir)) {
    for (const file of fs.readdirSync(lessonDir).filter((f) => f.endsWith(".json"))) {
      Object.assign(lessons, readJson(path.join(lessonDir, file)));
    }
  }
  const mnemonics = optional<Partial<LevelText["mnemonics"]>>("mnemonics.json", {});
  return {
    kanji: optional("kanji.json", {}),
    mnemonics: { primitives: mnemonics.primitives ?? {}, kanji: mnemonics.kanji ?? {} },
    lessons,
  };
}

export type RawLesson = Omit<AuthoredLesson, "words"> & {
  title: string;
  summary: string;
  words: RawWord[];
};

export type Lesson = {
  slug: string;
  title: string;
  summary: string;
  level: Level;
  /**
   * 1-based position in the whole curriculum. Numbering runs on from one level
   * into the next — N5 is lessons 1 to 16 and N4 starts at 17 — so a lesson
   * number means the same thing on every page, and "seen in lesson 9" needs no
   * level beside it.
   */
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
const LOCALE_ROOT = path.join(DATA_ROOT, "locales");

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
 * The levels that are built, in the order they are studied. Content is static
 * and read-only, so it is parsed once per server process.
 *
 * Adding a level means dropping a directory beside n5 and n4, and one per
 * language under locales/, extending this list, LEVELS in
 * scripts/validate-content.mjs, and the loaders in lib/strokeBank.ts.
 */
const LEVELS: Level[] = ["N5", "N4"];

type Curriculum = {
  lessons: Lesson[];
  kanji: Kanji[];
  words: Word[];
  lessonBySlug: Map<string, Lesson>;
  kanjiByChar: Map<string, Kanji>;
  wordById: Map<string, Word>;
  strokeViewBox: string;
};

/**
 * Every built level, run together into one curriculum: N5's lessons, then
 * N4's, numbered straight through.
 *
 * Levels are loaded together rather than one at a time because they are not
 * independent. An N4 kanji is built from parts a learner met in N5, and N5's
 * 人 is reused inside N4's 体, so both what a part is and where it was first
 * seen can only be worked out over the whole sequence.
 */
function loadCurriculum(locale: Locale): Curriculum {
  const lessons: Lesson[] = [];
  const kanji: Kanji[] = [];
  // Primitives are shared: a level defines only the ones no earlier level
  // did, and validate-content.mjs refuses a second definition.
  const memo: MnemonicFile = { primitives: {}, kanji: {} };
  let strokeViewBox = "0 0 109 109";

  for (const level of LEVELS) {
    const viewBox = loadLevel(level, locale, lessons, kanji, memo);
    if (viewBox) strokeViewBox = viewBox;
  }

  attachParts(kanji, memo);

  const words = lessons.flatMap((l) => l.words);
  return {
    lessons,
    kanji,
    words,
    lessonBySlug: new Map(lessons.map((l) => [l.slug, l])),
    kanjiByChar: new Map(kanji.map((k) => [k.char, k])),
    wordById: new Map(words.map((w) => [w.id, w])),
    strokeViewBox,
  };
}

/**
 * Appends one level's lessons and kanji to the curriculum so far, and merges
 * its parts and memory stories into `memo`. Returns the stroke data's
 * viewBox, if it has any.
 *
 * Lesson files are numbered so the filesystem order is the curriculum order.
 * A file holds several lessons; they keep their in-file order.
 */
function loadLevel(
  level: Level,
  locale: Locale,
  lessons: Lesson[],
  kanji: Kanji[],
  memo: MnemonicFile,
): string | null {
  const levelDir = path.join(DATA_ROOT, level.toLowerCase());
  const lessonDir = path.join(levelDir, "lessons");

  // The learner's language, with English under it for anything it lacks.
  const en = readText(level, DEFAULT_LOCALE);
  const t = locale === DEFAULT_LOCALE ? en : readText(level, locale);

  const byChar = new Map(
    readJson<AuthoredKanji[]>(path.join(levelDir, "kanji.json")).map((k): [string, RawKanji] => [
      k.char,
      { ...k, meanings: t.kanji[k.char] ?? en.kanji[k.char] ?? [] },
    ]),
  );

  // Stroke data is optional: without it the app still teaches, it just cannot
  // animate stroke order. See data/jlpt/STROKES-LICENSE.md.
  const strokeFile = path.join(levelDir, "strokes.json");
  const strokeData: StrokeFile | null = fs.existsSync(strokeFile) ? readJson<StrokeFile>(strokeFile) : null;

  // Also optional: without it a new kanji is taught by its glyph and readings
  // alone, and the radical falls back to KanjiVG's.
  const partsFile = path.join(levelDir, "parts.json");
  if (fs.existsSync(partsFile)) {
    const own = readJson<PartsFile>(partsFile);
    for (const [char, def] of Object.entries(own.primitives)) {
      if (Object.hasOwn(memo.primitives, char)) continue;
      const text = t.mnemonics.primitives[char] ?? en.mnemonics.primitives[char];
      memo.primitives[char] = { ...def, ...text };
    }
    for (const [char, entry] of Object.entries(own.kanji)) {
      const text = t.mnemonics.kanji[char];
      const fallback = en.mnemonics.kanji[char];
      const roles = new Set(entry.roles);
      memo.kanji[char] = {
        radical: entry.radical,
        mnemonic: text?.mnemonic || fallback?.mnemonic || "",
        parts: entry.parts.map((p) =>
          roles.has(p) ? { char: p, as: text?.roles?.[p] ?? fallback?.roles?.[p] ?? p } : p,
        ),
      };
    }
  }

  const files = fs.readdirSync(lessonDir).filter((f) => f.endsWith(".json")).sort();

  for (const file of files) {
    for (const raw of readJson<AuthoredLesson[]>(path.join(lessonDir, file))) {
      const text = t.lessons[raw.slug];
      const fallback = en.lessons[raw.slug];
      const lessonKanji: Kanji[] = raw.kanji.map((char) => {
        const base = byChar.get(char)!;
        const entry: Kanji = {
          ...base,
          level,
          lessonSlug: raw.slug,
          order: kanji.length + 1,
          lessonOrder: lessons.length + 1,
          strokePaths: strokeData?.kanji[char]?.strokes ?? [],
          // KanjiVG sometimes records a stroke — 丿 for 年 — where a
          // dictionary files the character under 干, so the authored radical
          // wins wherever there is one.
          radical: memo.kanji[char]?.radical ?? strokeData?.kanji[char]?.radical ?? null,
          radicalPart: null,
          parts: [],
          mnemonic: memo.kanji[char]?.mnemonic || null,
          usedIn: [],
        };
        kanji.push(entry);
        return entry;
      });

      lessons.push({
        slug: raw.slug,
        title: text?.title ?? fallback?.title ?? raw.slug,
        summary: text?.summary ?? fallback?.summary ?? "",
        level,
        order: lessons.length + 1,
        kanji: lessonKanji,
        words: raw.words.map((w) => {
          const key = `${w.word}|${w.reading}`;
          return {
            ...w,
            meanings: text?.words[key] ?? fallback?.words[key] ?? [],
            id: wordId(level, raw.slug, w.word, w.reading),
            level,
            lessonSlug: raw.slug,
            kanji: [...new Set([...w.word].filter((ch) => HAN.test(ch)))],
          };
        }),
      });
    }
  }

  return strokeData?.viewBox ?? null;
}

/**
 * Resolves each kanji's parts once the whole curriculum is known, because
 * both things worth saying about a part depend on the order: where a learner
 * first meets it, and which later characters reuse it.
 */
function attachParts(kanji: Kanji[], memo: MnemonicFile) {
  const byChar = new Map(kanji.map((k) => [k.char, k]));

  // A part is first met either as a kanji in its own right or inside one,
  // whichever the curriculum reaches first.
  const firstSeen = new Map<string, Kanji>();
  for (const k of kanji) {
    for (const c of [k.char, ...(memo.kanji[k.char]?.parts ?? []).map(partChar)]) {
      if (!firstSeen.has(c)) firstSeen.set(c, k);
    }
  }

  function part(raw: RawPart): KanjiPart {
    const char = partChar(raw);
    const defined = memo.primitives[char];
    const asKanji = byChar.get(char);
    const first = firstSeen.get(char);
    return {
      char,
      // The first two meanings of a kanji: 日 is used as "sun" far more
      // often than as "day", and one alone would hide that.
      meaning: defined?.meaning ?? asKanji?.meanings.slice(0, 2).join("; ") ?? char,
      role: typeof raw === "string" ? null : raw.as,
      name: defined?.name ?? null,
      note: defined?.note ?? null,
      firstSeen: first?.char ?? char,
      firstLesson: first?.lessonOrder ?? 0,
    };
  }

  for (const k of kanji) {
    const entry = memo.kanji[k.char];
    k.parts = (entry?.parts ?? []).map(part);
    k.radicalPart = k.radical ? part(k.radical) : null;
    k.usedIn = kanji
      .filter((other) => other !== k && memo.kanji[other.char]?.parts.some((p) => partChar(p) === k.char))
      .map(({ char, meanings, onyomi, kunyomi, lessonOrder }) => ({
        char,
        meanings,
        onyomi,
        kunyomi,
        lessonOrder,
      }));
  }
}

const cache = new Map<Locale, Curriculum>();

function curriculum(locale: Locale): Curriculum {
  let c = cache.get(locale);
  if (!c) {
    c = loadCurriculum(locale);
    cache.set(locale, c);
  }
  return c;
}

/** The built levels, in study order. */
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

/** data/jlpt/levels.json: the numbers. The words are per language, in locales/<locale>/levels.json. */
type LevelsFile = {
  note: string;
  levels: Pick<LevelPathEntry, "level" | "kanjiTarget" | "cumulativeKanji">[];
};

type LevelsText = Record<string, Pick<LevelPathEntry, "title" | "blurb" | "canDo">>;

let levelsFile: LevelsFile | null = null;
const levelsText = new Map<Locale, LevelsText>();

function readLevelsText(locale: Locale): LevelsText {
  let text = levelsText.get(locale);
  if (!text) {
    const file = path.join(LOCALE_ROOT, locale, "levels.json");
    text = fs.existsSync(file) ? readJson<LevelsText>(file) : {};
    levelsText.set(locale, text);
  }
  return text;
}

/**
 * The N5-to-N1 progression.
 *
 * Estimated character counts come from data/jlpt/levels.json, and the words
 * describing each level from locales/<locale>/levels.json; the counts that are
 * actually shown as facts — lessons, kanji, words — are read from each level's
 * own content, so an unbuilt level reports zero rather than borrowing a number
 * from the roadmap file. A level becomes available purely by existing in
 * LEVELS with a data directory, so nothing here needs editing to ship another.
 */
export function getLevelPath(locale: Locale = DEFAULT_LOCALE): LevelPathEntry[] {
  levelsFile ??= readJson<LevelsFile>(path.join(DATA_ROOT, "levels.json"));
  const text = readLevelsText(locale);
  const en = readLevelsText(DEFAULT_LOCALE);

  return levelsFile.levels.map((source) => {
    const entry = {
      ...source,
      title: text[source.level]?.title ?? en[source.level]?.title ?? source.level,
      blurb: text[source.level]?.blurb ?? en[source.level]?.blurb ?? "",
      canDo: text[source.level]?.canDo ?? en[source.level]?.canDo ?? "",
    };
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

/*
 * The accessors below take an optional level. Without one they cover every
 * built level, which is what a learner's lessons, reviews and reference pages
 * want: a learner in N4 still has N5 words coming due.
 *
 * They also take the language to read the content in. English is the default
 * because it is also the canonical form: grading, progress and anything else
 * that only needs ids, characters or levels can leave it out. Anything whose
 * text reaches a learner must pass theirs — see getLocale in lib/i18n/server.
 */

export function getLessons(l?: Level, locale: Locale = DEFAULT_LOCALE): Lesson[] {
  const { lessons } = curriculum(locale);
  return l ? lessons.filter((x) => x.level === l) : lessons;
}

/** Slugs are unique across levels, so a slug alone names a lesson. */
export function getLesson(slug: string, locale: Locale = DEFAULT_LOCALE): Lesson | undefined {
  return curriculum(locale).lessonBySlug.get(slug);
}

/** Every kanji in curriculum order. */
export function getKanji(l?: Level, locale: Locale = DEFAULT_LOCALE): Kanji[] {
  const { kanji } = curriculum(locale);
  return l ? kanji.filter((k) => k.level === l) : kanji;
}

/** A character belongs to exactly one level, so it alone names a kanji. */
export function getKanjiChar(char: string, locale: Locale = DEFAULT_LOCALE): Kanji | undefined {
  return curriculum(locale).kanjiByChar.get(char);
}

/** KanjiVG draws every character on the same grid, whatever its level. */
export function strokeViewBox(): string {
  return curriculum(DEFAULT_LOCALE).strokeViewBox;
}

export function getAllWords(l?: Level, locale: Locale = DEFAULT_LOCALE): Word[] {
  const { words } = curriculum(locale);
  return l ? words.filter((w) => w.level === l) : words;
}

/** Word ids carry their level, so an id alone names a word. */
export function getWord(id: string, locale: Locale = DEFAULT_LOCALE): Word | undefined {
  return curriculum(locale).wordById.get(id);
}

/** The words chosen to demonstrate one character. */
export function getWordsTeaching(char: string, locale: Locale = DEFAULT_LOCALE): Word[] {
  return curriculum(locale).words.filter((w) => w.teaches === char);
}

/**
 * Every word whose written form contains the character, wherever it is
 * taught: N5's 自転車 uses N4's 転, and belongs on 転's list.
 */
export function getWordsUsingKanji(char: string, locale: Locale = DEFAULT_LOCALE): Word[] {
  return curriculum(locale).words.filter((w) => w.kanji.includes(char));
}

/** Counts for one level, or for every built level together. Language does not change them. */
export function levelStats(l?: Level) {
  const lessons = getLessons(l);
  return {
    level: l ?? null,
    lessons: lessons.length,
    kanji: getKanji(l).length,
    words: lessons.reduce((n, x) => n + x.words.length, 0),
  };
}
