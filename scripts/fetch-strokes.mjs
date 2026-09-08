#!/usr/bin/env node
/**
 * Vendors stroke-order data for this level's kanji from KanjiVG.
 *
 * KanjiVG (c) Ulrich Apel, CC BY-SA 3.0 — https://kanjivg.tagaini.net
 * The extracted data in data/jlpt/<level>/strokes.json is a derivative work and
 * stays under that licence; see data/jlpt/STROKES-LICENSE.md.
 *
 * Only the ordered path geometry and the radical element are kept, so the file
 * is a fraction of the size of 80 full SVGs and needs no XML parsing at runtime.
 *
 * Run: npm run fetch:strokes
 */
import fs from "node:fs";
import path from "node:path";

const LEVEL = process.argv[2] ?? "n5";
const DIR = path.join(process.cwd(), "data", "jlpt", LEVEL);
const BASE = "https://raw.githubusercontent.com/KanjiVG/kanjivg/master/kanji";

/** KanjiVG filenames are the codepoint in lowercase hex, padded to 5. */
function fileFor(char) {
  return `${char.codePointAt(0).toString(16).padStart(5, "0")}.svg`;
}

const kanji = JSON.parse(fs.readFileSync(path.join(DIR, "kanji.json"), "utf8"));
console.log(`Fetching stroke data for ${kanji.length} kanji...\n`);

const out = {};
const failures = [];

for (const [i, k] of kanji.entries()) {
  const url = `${BASE}/${fileFor(k.char)}`;
  try {
    const res = await fetch(url);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const svg = await res.text();

    // Stroke paths carry an id of the form kvg:<code>-s<n> and appear in
    // writing order. The StrokeNumbers group holds only <text>, so matching on
    // <path d> cannot pick those up.
    const strokes = [...svg.matchAll(/<path[^>]*\sd="([^"]+)"/g)].map((m) => m[1]);
    if (strokes.length === 0) throw new Error("no stroke paths found");

    // The outermost group tagged as a radical names the character's radical.
    const radical = /kvg:element="([^"]+)"[^>]*kvg:radical="(?:general|nelson)"/.exec(svg)?.[1] ?? null;

    if (strokes.length !== k.strokes) {
      console.log(`  ${k.char}  note: kanji.json says ${k.strokes} strokes, KanjiVG has ${strokes.length}`);
    }

    out[k.char] = { strokes, radical };
    process.stdout.write(`\r  ${i + 1}/${kanji.length}  ${k.char}   `);
  } catch (e) {
    failures.push(`${k.char}: ${e.message}`);
  }
}

console.log("\n");

// viewBox is identical across the whole KanjiVG set; store it once.
const payload = {
  source: "KanjiVG, (c) Ulrich Apel, CC BY-SA 3.0, https://kanjivg.tagaini.net",
  viewBox: "0 0 109 109",
  kanji: out,
};

const file = path.join(DIR, "strokes.json");
fs.writeFileSync(file, JSON.stringify(payload, null, 0) + "\n");

const kb = Math.round(fs.statSync(file).size / 1024);
console.log(`Wrote ${Object.keys(out).length}/${kanji.length} kanji to ${path.relative(process.cwd(), file)} (${kb}KB)`);
if (failures.length) {
  console.error(`\n${failures.length} failed:`);
  for (const f of failures) console.error(`  ${f}`);
  process.exit(1);
}
