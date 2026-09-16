#!/usr/bin/env node
/**
 * Content guard for data/jlpt/.
 *
 * Content lives in two trees, and both are checked:
 *
 *   data/jlpt/<level>/            The curriculum, the same in every language:
 *                                 kanji, readings, parts, lessons and words.
 *   data/jlpt/locales/<locale>/   What a learner reads, in one language:
 *                                 meanings, lesson text, memory stories.
 *
 * The curriculum is kanji-spined: every lesson declares the characters it
 * teaches, and every word exists to demonstrate one of them. The checks below
 * enforce exactly that, so a word that has drifted away from its kanji, or a
 * character with too little vocabulary to fix its readings, fails the build
 * rather than quietly shipping.
 *
 * Levels are checked in study order and against each other, because the app
 * runs them together as one curriculum (see lib/content.ts): a kanji, a lesson
 * slug or a word belongs to one level only, a part may be a kanji or primitive
 * from an earlier level, and a primitive is defined once, by the first level
 * that needs it.
 *
 * Every language the app ships (SHIPPED) must cover every built level
 * completely. A directory under locales/ that is not shipped yet is a
 * translation in progress: its gaps are reported as warnings, with how far it
 * has got, so it can be built up over many pull requests.
 *
 * Run: npm run validate:content
 *      npm run validate:content -- --locale fr    also list what fr still lacks
 */
import fs from "node:fs";
import path from "node:path";
import { titleCase } from "./title-case.mjs";

/** Study order. Keep in step with LEVELS in lib/content.ts. */
const LEVELS = ["n5", "n4"];
/** Languages the app offers. Keep in step with LOCALES in lib/i18n/config.ts. English comes first: it is the reference. */
const SHIPPED = ["en", "id"];
const DATA_ROOT = path.join(process.cwd(), "data", "jlpt");
const LOCALE_ROOT = path.join(DATA_ROOT, "locales");

const argv = process.argv.slice(2);
/** A language whose gaps to list even though it is not shipped. */
const focus = argv.includes("--locale") ? argv[argv.indexOf("--locale") + 1] : null;

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

const readJson = (file) => JSON.parse(fs.readFileSync(file, "utf8"));

/** Reads a file, or records why it could not be read. */
function load(file, rel, report = errors) {
  if (!fs.existsSync(file)) {
    report.push(`${rel}: missing`);
    return null;
  }
  try {
    return readJson(file);
  } catch (e) {
    report.push(`${rel}: invalid JSON - ${e.message}`);
    return null;
  }
}

const lessonFiles = (dir) =>
  fs.existsSync(dir) ? fs.readdirSync(dir).filter((f) => f.endsWith(".json")).sort() : [];

// ===========================================================================
// The curriculum
// ===========================================================================

// Every level's characters, first, so a part can name a kanji of any level.
const kanjiLevel = new Map();
const kanjiLists = new Map();
for (const level of LEVELS) {
  const kanjiList = load(path.join(DATA_ROOT, level, "kanji.json"), `${level}/kanji.json`) ?? [];
  kanjiLists.set(level, kanjiList);
  for (const k of kanjiList) {
    if (kanjiLevel.has(k.char)) errors.push(`${level}/kanji.json: ${k.char} is already a kanji of ${kanjiLevel.get(k.char)}`);
    else kanjiLevel.set(k.char, level);
  }
}

// Shared across levels, in study order.
const primitiveLevel = new Map(); // primitive -> level that defines it
const usedParts = new Set();
const slugs = new Map(); // lesson slug -> level
const surfaces = new Map(); // word|reading -> where it is taught

/** What each level's text must cover, gathered while its structure is checked. */
const expected = new Map();

for (const level of LEVELS) {
  const levelDir = path.join(DATA_ROOT, level);
  const lessonDir = path.join(levelDir, "lessons");
  const want = { kanji: [], primitives: [], parts: new Map(), roles: new Map(), lessons: new Map() };
  expected.set(level, want);

  const kanjiList = kanjiLists.get(level);
  const kanjiSet = new Set(kanjiList.map((k) => k.char));
  if (kanjiSet.size !== kanjiList.length) errors.push(`${level}/kanji.json: duplicate characters`);
  want.kanji = [...kanjiSet];

  for (const k of kanjiList) {
    if (!k.char || !Number.isInteger(k.strokes) || !Array.isArray(k.onyomi) || !Array.isArray(k.kunyomi)) {
      errors.push(`${level}/kanji.json: incomplete entry ${JSON.stringify(k.char)}`);
    }
    if ("meanings" in k) errors.push(`${level}/kanji.json: ${k.char} meanings belong in locales/<locale>/${level}/kanji.json`);
  }

  // Stroke data is optional, but if present it must cover every kanji.
  const strokeFile = path.join(levelDir, "strokes.json");
  if (fs.existsSync(strokeFile)) {
    const strokes = readJson(strokeFile);
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

  // Parts are optional too, but if present every kanji needs an entry, and
  // every part and radical must resolve to something the app can explain:
  // a kanji of any level, or a primitive defined here or by an earlier level.
  const partsFile = path.join(levelDir, "parts.json");
  if (fs.existsSync(partsFile)) {
    const rel = `${level}/parts.json`;
    const parts = load(partsFile, rel) ?? {};
    const primitives = parts.primitives ?? {};
    for (const c of Object.keys(primitives)) {
      if (primitiveLevel.has(c)) {
        errors.push(`${rel}: primitive ${c} is already defined by ${primitiveLevel.get(c)}/parts.json`);
        continue;
      }
      primitiveLevel.set(c, level);
      // A kanji takes its meaning from kanji.json; anything else needs one of
      // its own in every language.
      if (!kanjiLevel.has(c)) want.primitives.push(c);
    }
    const defined = (c) => kanjiLevel.has(c) || primitiveLevel.has(c);

    for (const k of kanjiList) {
      const m = parts.kanji?.[k.char];
      if (!m) {
        errors.push(`${rel}: no entry for ${k.char}`);
        continue;
      }
      if (!m.radical) {
        errors.push(`${rel}: ${k.char} has no radical`);
      } else {
        usedParts.add(m.radical);
        if (!defined(m.radical)) errors.push(`${rel}: ${k.char} radical ${m.radical} is not defined in primitives`);
      }
      if (!Array.isArray(m.parts) || m.parts.some((p) => typeof p !== "string")) {
        errors.push(`${rel}: ${k.char} parts must be a list of characters`);
        continue;
      }
      want.parts.set(k.char, m.parts);
      for (const p of m.parts) {
        usedParts.add(p);
        if (p === k.char) errors.push(`${rel}: ${k.char} lists itself as a part`);
        if (!defined(p)) errors.push(`${rel}: ${k.char} part ${p} is neither a kanji nor in primitives`);
        // Outside the Basic Multilingual Plane most Japanese fonts have no
        // glyph, and the part renders as a box.
        if (p.codePointAt(0) > 0xffff) warnings.push(`${rel}: ${k.char} part ${p} may not render`);
      }
      const roles = m.roles ?? [];
      for (const r of roles) {
        if (!m.parts.includes(r)) errors.push(`${rel}: ${k.char} role ${r} is not one of its parts`);
      }
      want.roles.set(k.char, roles);
    }

    for (const c of Object.keys(parts.kanji ?? {})) {
      if (!kanjiSet.has(c)) errors.push(`${rel}: entry for ${c}, which is not in kanji.json`);
    }

    notes.push(`${level}: parts for ${Object.keys(parts.kanji ?? {}).length} kanji, ${Object.keys(primitives).length} primitives defined`);
  } else {
    warnings.push(`${level}: no parts.json - new kanji are taught without parts or stories`);
  }

  const triples = new Map();
  const taughtBy = new Map(); // kanji -> lesson slug
  const wordsPerKanji = new Map();
  let wordCount = 0;
  let lessonCount = 0;

  for (const file of lessonFiles(lessonDir)) {
    const rel = `${level}/lessons/${file}`;
    const lessons = load(path.join(lessonDir, file), rel);
    if (!lessons) continue;
    if (!Array.isArray(lessons)) {
      errors.push(`${rel}: expected an array of lessons`);
      continue;
    }
    const fileLessons = [];
    want.lessons.set(file, fileLessons);

    for (const lesson of lessons) {
      lessonCount++;
      if (!lesson.slug) {
        errors.push(`${rel}: lesson missing slug`);
        continue;
      }
      if ("title" in lesson || "summary" in lesson) {
        errors.push(`${rel} ${lesson.slug}: title and summary belong in locales/<locale>/${level}/lessons/${file}`);
      }
      // A lesson's address is /lessons/<slug>, with no level in it.
      if (slugs.has(lesson.slug)) errors.push(`${rel}: lesson slug ${lesson.slug} is already used in ${slugs.get(lesson.slug)}`);
      slugs.set(lesson.slug, level);
      const keys = [];
      fileLessons.push({ slug: lesson.slug, words: keys });

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
        if ("meanings" in w) errors.push(`${where}: meanings belong in locales/<locale>/${level}/lessons/${file}`);
        if (!POS.has(w.pos)) errors.push(`${where}: unknown pos ${JSON.stringify(w.pos)}`);
        keys.push(`${w.word}|${w.reading}`);

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
        // That holds across levels too — N4 must not teach N5's 自転車 again.
        const surface = `${w.word}|${w.reading}`;
        if (surfaces.has(surface)) {
          errors.push(`${where}: also taught in ${surfaces.get(surface)} - assign it to one kanji`);
        }
        surfaces.set(surface, `${level} ${lesson.slug} (${w.teaches})`);
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

// Only now: an N5 primitive may be used by nothing until N4.
for (const [c, level] of primitiveLevel) {
  if (!usedParts.has(c) && !kanjiLevel.has(c)) warnings.push(`${level}/parts.json: primitive ${c} is never used`);
}

// ===========================================================================
// The text, per language
// ===========================================================================

const onDisk = fs.existsSync(LOCALE_ROOT)
  ? fs.readdirSync(LOCALE_ROOT, { withFileTypes: true }).filter((d) => d.isDirectory()).map((d) => d.name)
  : [];
for (const locale of SHIPPED) {
  if (!onDisk.includes(locale)) errors.push(`locales/${locale}: missing - the app offers this language`);
}
const roadmap = load(path.join(DATA_ROOT, "levels.json"), "levels.json")?.levels ?? [];

// English first, so a draft can be measured against it.
const reference = {};
let referenceTotal = 0;

for (const locale of [...SHIPPED.filter((l) => onDisk.includes(l)), ...onDisk.filter((l) => !SHIPPED.includes(l)).sort()]) {
  const shipped = SHIPPED.includes(locale);
  // A language still being written reports problems without failing the
  // build, and lists what it has not translated yet only when asked to.
  const report = shipped ? errors : warnings;
  const gaps = shipped || locale === focus ? report : [];
  const root = path.join(LOCALE_ROOT, locale);
  let done = 0;
  let total = 0;
  const need = (ok, message) => {
    total++;
    if (ok) done++;
    else gaps.push(message);
    return ok;
  };
  const extras = (where, keys, known) => {
    for (const k of keys) if (!known.has(k)) report.push(`${where}: ${k} is not in the curriculum`);
  };
  const cased = (where, text) => {
    const want = titleCase(text, locale);
    if (text !== want) report.push(`${where}: write ${JSON.stringify(text)} as ${JSON.stringify(want)}`);
  };
  const meanings = (where, list) => {
    const ok = Array.isArray(list) && list.length > 0 && list.every((m) => typeof m === "string" && m.trim());
    if (need(ok, `${where}: needs a list of meanings`)) for (const m of list) cased(where, m);
  };
  const text = (value) => typeof value === "string" && value.trim() !== "";

  // levels.json: { "N5": { title, blurb, canDo } } for every level on the roadmap
  const levels = load(path.join(root, "levels.json"), `locales/${locale}/levels.json`, gaps) ?? {};
  for (const { level } of roadmap) {
    for (const field of ["title", "blurb", "canDo"]) {
      need(text(levels[level]?.[field]), `locales/${locale}/levels.json: ${level} has no ${field}`);
    }
  }

  for (const level of LEVELS) {
    const want = expected.get(level);
    const rel = `locales/${locale}/${level}`;
    const dir = path.join(root, level);
    if (!fs.existsSync(dir)) {
      gaps.push(`${rel}: missing - every built level needs its ${locale} text`);
      continue;
    }

    // kanji.json: { char: [meanings] }
    const kanji = load(path.join(dir, "kanji.json"), `${rel}/kanji.json`, gaps) ?? {};
    for (const c of want.kanji) meanings(`${rel}/kanji.json ${c}`, kanji[c]);
    extras(`${rel}/kanji.json`, Object.keys(kanji), new Set(want.kanji));

    // mnemonics.json: { primitives: { char: { meaning, note? } }, kanji: { char: { mnemonic, roles? } } }
    if (want.parts.size) {
      const where = `${rel}/mnemonics.json`;
      const memo = load(path.join(dir, "mnemonics.json"), where, gaps) ?? {};
      const prims = memo.primitives ?? {};
      const en = reference[level]?.primitives ?? {};
      for (const c of want.primitives) {
        if (need(text(prims[c]?.meaning), `${where}: primitive ${c} has no meaning`)) cased(`${where} primitive ${c}`, prims[c].meaning);
      }
      for (const [c, def] of Object.entries(en)) {
        // Notes are optional in English; a translation carries the ones it has.
        if (def.note && !text(prims[c]?.note)) gaps.push(`${where}: primitive ${c} has no note`);
      }
      extras(`${where} primitives`, Object.keys(prims), new Set(primitiveLevel.keys()));

      for (const [c, parts] of want.parts) {
        const entry = memo.kanji?.[c];
        if (!need(text(entry?.mnemonic), `${where}: ${c} has no mnemonic`)) continue;
        // A part the story never names is a label with no reason to remember it.
        for (const p of parts) {
          if (!entry.mnemonic.includes(p)) report.push(`${where}: ${c} part ${p} is not mentioned in its mnemonic`);
        }
        const roles = want.roles.get(c) ?? [];
        for (const r of roles) {
          if (need(text(entry.roles?.[r]), `${where}: ${c} part ${r} has no role`)) cased(`${where} ${c} part ${r}`, entry.roles[r]);
        }
        extras(`${where} ${c} roles`, Object.keys(entry.roles ?? {}), new Set(roles));
      }
      extras(`${where} kanji`, Object.keys(memo.kanji ?? {}), new Set(want.parts.keys()));
      if (locale === "en") reference[level] = { primitives: prims };
    }

    // lessons/<file>: { slug: { title, summary, words: { "word|reading": [meanings] } } }
    for (const [file, lessons] of want.lessons) {
      const where = `${rel}/lessons/${file}`;
      const overlay = load(path.join(dir, "lessons", file), where, gaps) ?? {};
      for (const { slug, words } of lessons) {
        const t = overlay[slug];
        need(text(t?.title), `${where} ${slug}: no title`);
        need(text(t?.summary), `${where} ${slug}: no summary`);
        for (const key of words) meanings(`${where} ${slug} ${key}`, t?.words?.[key]);
        extras(`${where} ${slug} words`, Object.keys(t?.words ?? {}), new Set(words));
      }
      extras(where, Object.keys(overlay), new Set(lessons.map((l) => l.slug)));
    }
    for (const file of lessonFiles(path.join(dir, "lessons"))) {
      if (!want.lessons.has(file)) report.push(`${rel}/lessons/${file}: no such lesson file in ${level}/lessons`);
    }
  }

  // Whatever a draft has not started still counts against it.
  if (locale === "en") referenceTotal = total;
  total = Math.max(total, referenceTotal);
  const percent = total ? Math.floor((done / total) * 1000) / 10 : 0;
  notes.push(
    `${locale}: ${done}/${total} texts (${percent}%)` +
      (shipped || locale === focus ? "" : ` - in progress; --locale ${locale} lists what is left`),
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
