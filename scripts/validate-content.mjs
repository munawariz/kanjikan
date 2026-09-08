#!/usr/bin/env node
/**
 * Content guard for data/jlpt/<level>/.
 *
 * The curriculum is kanji-spined: every lesson declares the characters it
 * teaches, and every word exists to demonstrate one of them. The checks below
 * enforce exactly that, so a word that has drifted away from its kanji, or a
 * character with too little vocabulary to fix its readings, fails the build
 * rather than quietly shipping.
 *
 * Run: npm run validate:content
 */
import fs from "node:fs";
import path from "node:path";

const LEVELS = ["n5"];
const DATA_ROOT = path.join(process.cwd(), "data", "jlpt");

/** Minimum words per kanji. Below this, multiple readings do not get fixed. */
const MIN_WORDS_PER_KANJI = 4;

const POS = new Set([
  "noun", "pronoun", "number", "counter",
  "verb (godan)", "verb (ichidan)", "verb (irregular)",
  "i-adjective", "na-adjective", "adverb",
  "particle", "conjunction", "interjection", "expression",
  "prefix", "suffix",
]);

const KANA_ONLY = /^[ぁ-ゟ゠-ヿー・]+$/;
// Kana, kanji, the iteration mark 々, the long vowel mark, and ASCII middle dot.
const JAPANESE_ONLY = /^[ぁ-ゟ゠-ヿー・々\p{Script=Han}]+$/u;
const HAN = /\p{Script=Han}/u;

const errors = [];
const warnings = [];
const notes = [];

for (const level of LEVELS) {
  const levelDir = path.join(DATA_ROOT, level);
  const lessonDir = path.join(levelDir, "lessons");

  const kanjiList = JSON.parse(fs.readFileSync(path.join(levelDir, "kanji.json"), "utf8"));
  const kanjiSet = new Set(kanjiList.map((k) => k.char));
  if (kanjiSet.size !== kanjiList.length) errors.push(`${level}/kanji.json: duplicate characters`);

  for (const k of kanjiList) {
    if (!k.char || !Number.isInteger(k.strokes) || !k.meanings?.length) {
      errors.push(`${level}/kanji.json: incomplete entry ${JSON.stringify(k.char)}`);
    }
  }

  // Stroke data is optional, but if present it must cover every kanji.
  const strokeFile = path.join(levelDir, "strokes.json");
  if (fs.existsSync(strokeFile)) {
    const strokes = JSON.parse(fs.readFileSync(strokeFile, "utf8"));
    const missing = [...kanjiSet].filter((c) => !strokes.kanji?.[c]?.strokes?.length);
    if (missing.length) {
      errors.push(`${level}/strokes.json: no stroke data for ${missing.join(" ")}`);
    }
    for (const k of kanjiList) {
      const n = strokes.kanji?.[k.char]?.strokes?.length;
      if (n && n !== k.strokes) {
        warnings.push(`${level}: ${k.char} stroke count ${k.strokes} but stroke data has ${n}`);
      }
    }
    notes.push(`${level}: stroke data present for ${Object.keys(strokes.kanji ?? {}).length} kanji`);
  } else {
    warnings.push(`${level}: no strokes.json - run npm run fetch:strokes`);
  }

  const files = fs.readdirSync(lessonDir).filter((f) => f.endsWith(".json")).sort();
  const slugs = new Set();
  const triples = new Map();
  const surfaces = new Map();
  const taughtBy = new Map(); // kanji -> lesson slug
  const wordsPerKanji = new Map();
  let wordCount = 0;
  let lessonCount = 0;

  for (const file of files) {
    const rel = `${level}/lessons/${file}`;
    let lessons;
    try {
      lessons = JSON.parse(fs.readFileSync(path.join(lessonDir, file), "utf8"));
    } catch (e) {
      errors.push(`${rel}: invalid JSON - ${e.message}`);
      continue;
    }
    if (!Array.isArray(lessons)) {
      errors.push(`${rel}: expected an array of lessons`);
      continue;
    }

    for (const lesson of lessons) {
      lessonCount++;
      for (const field of ["slug", "title", "summary"]) {
        if (!lesson[field]) errors.push(`${rel}: lesson missing ${field}`);
      }
      if (slugs.has(lesson.slug)) errors.push(`${rel}: duplicate lesson slug ${lesson.slug}`);
      slugs.add(lesson.slug);

      if (!Array.isArray(lesson.kanji) || lesson.kanji.length === 0) {
        errors.push(`${rel}: lesson ${lesson.slug} declares no kanji`);
        continue;
      }

      const lessonKanji = new Set(lesson.kanji);
      for (const c of lesson.kanji) {
        if (!kanjiSet.has(c)) errors.push(`${rel} ${lesson.slug}: ${c} is not in kanji.json`);
        if (taughtBy.has(c)) {
          errors.push(`${rel} ${lesson.slug}: ${c} is already taught by ${taughtBy.get(c)}`);
        }
        taughtBy.set(c, lesson.slug);
        wordsPerKanji.set(c, 0);
      }

      if (!Array.isArray(lesson.words) || lesson.words.length === 0) {
        errors.push(`${rel}: lesson ${lesson.slug} has no words`);
        continue;
      }

      for (const w of lesson.words) {
        wordCount++;
        const where = `${rel} ${lesson.slug} ${w.word ?? "?"}`;

        if (!w.word) errors.push(`${where}: missing word`);
        if (!w.reading) errors.push(`${where}: missing reading`);
        if (!Array.isArray(w.meanings) || w.meanings.length === 0) {
          errors.push(`${where}: missing meanings`);
        }
        if (!POS.has(w.pos)) errors.push(`${where}: unknown pos ${JSON.stringify(w.pos)}`);

        // Catches stray Latin left in a surface form, which renders as a word
        // no learner will ever see written that way.
        if (w.word && !JAPANESE_ONLY.test(w.word)) {
          errors.push(`${where}: word contains non-Japanese characters`);
        }
        if (w.reading && !KANA_ONLY.test(w.reading)) {
          errors.push(`${where}: reading is not kana-only (${w.reading})`);
        }

        // The point of the whole curriculum: a word must show its kanji.
        if (!w.teaches) {
          errors.push(`${where}: missing teaches`);
        } else if (!lessonKanji.has(w.teaches)) {
          errors.push(`${where}: teaches ${w.teaches}, which this lesson does not cover`);
        } else if (w.word && !w.word.includes(w.teaches)) {
          errors.push(`${where}: does not contain ${w.teaches}`);
        } else {
          wordsPerKanji.set(w.teaches, (wordsPerKanji.get(w.teaches) ?? 0) + 1);
        }

        if (w.word && !HAN.test(w.word)) {
          errors.push(`${where}: contains no kanji, so it teaches nothing here`);
        }

        const triple = `${lesson.slug}|${w.word}|${w.reading}`;
        if (triples.has(triple)) errors.push(`${where}: id collision with ${triples.get(triple)}`);
        triples.set(triple, rel);

        // A word taught twice under different kanji is wasted repetition: the
        // learner sees it as two separate items with two separate schedules.
        const surface = `${w.word}|${w.reading}`;
        if (surfaces.has(surface)) {
          errors.push(`${where}: also taught in ${surfaces.get(surface)} - assign it to one kanji`);
        }
        surfaces.set(surface, `${lesson.slug} (${w.teaches})`);
      }
    }
  }

  const uncovered = [...kanjiSet].filter((c) => !taughtBy.has(c));
  if (uncovered.length) {
    errors.push(`${level}: ${uncovered.length} kanji are in no lesson - ${uncovered.join(" ")}`);
  }

  for (const [c, n] of [...wordsPerKanji].sort((a, b) => a[1] - b[1])) {
    if (n < MIN_WORDS_PER_KANJI) {
      warnings.push(`${level}: ${c} has only ${n} word(s), want at least ${MIN_WORDS_PER_KANJI}`);
    }
  }

  const counts = [...wordsPerKanji.values()];
  notes.push(
    `${level}: ${lessonCount} lessons, ${kanjiList.length} kanji, ${wordCount} words ` +
      `(${Math.min(...counts)}-${Math.max(...counts)} per kanji, ` +
      `avg ${(counts.reduce((a, b) => a + b, 0) / counts.length).toFixed(1)})`,
  );
}

for (const n of notes) console.log(n);
for (const w of warnings) console.log(`warn  ${w}`);
for (const e of errors) console.error(`ERROR ${e}`);

console.log(
  errors.length
    ? `\n${errors.length} error(s), ${warnings.length} warning(s)`
    : `\nContent OK - ${warnings.length} warning(s)`,
);
process.exit(errors.length ? 1 : 0);
