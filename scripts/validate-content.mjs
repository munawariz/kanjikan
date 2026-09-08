#!/usr/bin/env node
/**
 * Content guard for data/jlpt/<level>/.
 *
 * Word ids are derived from (level, lesson slug, word, reading), so the one
 * invariant that really matters is that the triple is unique inside a level.
 * This script checks that directly rather than recomputing ids, so it cannot
 * drift out of step with lib/content.ts.
 *
 * Run: npm run validate:content
 */
import fs from "node:fs";
import path from "node:path";

const LEVELS = ["n5"];
const DATA_ROOT = path.join(process.cwd(), "data", "jlpt");

const POS = new Set([
  "noun",
  "pronoun",
  "number",
  "counter",
  "verb (godan)",
  "verb (ichidan)",
  "verb (irregular)",
  "i-adjective",
  "na-adjective",
  "adverb",
  "particle",
  "conjunction",
  "interjection",
  "expression",
  "prefix",
  "suffix",
]);

// Hiragana, katakana, the long vowel mark and the katakana middle dot.
const KANA_ONLY = /^[ぁ-ゟ゠-ヿー・]+$/;

const errors = [];
const warnings = [];
const notes = [];

for (const level of LEVELS) {
  const levelDir = path.join(DATA_ROOT, level);
  const lessonDir = path.join(levelDir, "lessons");

  const kanji = JSON.parse(fs.readFileSync(path.join(levelDir, "kanji.json"), "utf8"));
  const kanjiSet = new Set(kanji.map((k) => k.char));
  if (kanjiSet.size !== kanji.length) {
    errors.push(`${level}/kanji.json: duplicate characters`);
  }
  for (const k of kanji) {
    if (!k.char || !Number.isInteger(k.strokes) || !k.meanings?.length) {
      errors.push(`${level}/kanji.json: incomplete entry ${JSON.stringify(k.char)}`);
    }
  }

  const files = fs.readdirSync(lessonDir).filter((f) => f.endsWith(".json")).sort();
  const slugs = new Set();
  const triples = new Map(); // "slug|word|reading" -> file
  const surfaces = new Map(); // "word|reading" -> [slug]
  let wordCount = 0;
  let lessonCount = 0;
  const usedKanji = new Set();

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
      if (slugs.has(lesson.slug)) {
        errors.push(`${rel}: duplicate lesson slug ${lesson.slug}`);
      }
      slugs.add(lesson.slug);

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

        if (w.reading && !KANA_ONLY.test(w.reading)) {
          errors.push(`${where}: reading is not kana-only (${w.reading})`);
        }

        const triple = `${lesson.slug}|${w.word}|${w.reading}`;
        if (triples.has(triple)) {
          errors.push(`${where}: id collision, already defined in ${triples.get(triple)}`);
        }
        triples.set(triple, rel);

        const surface = `${w.word}|${w.reading}`;
        surfaces.set(surface, [...(surfaces.get(surface) ?? []), lesson.slug]);

        for (const ch of w.word ?? "") if (kanjiSet.has(ch)) usedKanji.add(ch);
      }
    }
  }

  for (const [surface, where] of surfaces) {
    if (where.length > 1) {
      warnings.push(`${level}: ${surface.split("|")[0]} appears in ${where.join(", ")}`);
    }
  }

  const unused = [...kanjiSet].filter((c) => !usedKanji.has(c));
  if (unused.length) {
    notes.push(`${level}: ${unused.length} kanji have no vocabulary yet - ${unused.join(" ")}`);
  }

  notes.push(
    `${level}: ${lessonCount} lessons, ${wordCount} words, ${kanji.length} kanji, ` +
      `${usedKanji.size}/${kanji.length} kanji covered by vocabulary`,
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
