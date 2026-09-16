/** Strings shared by several areas. See ./index.ts for the conventions. */
import type { MasteryBand } from "@/lib/srs";

const en = {
  metaDescription:
    "Learn the JLPT N5 and N4 kanji about five at a time, with stroke order, the words that fix their readings, and optional writing practice from memory.",
  /** How well a word or kanji is read. */
  band: {
    new: "Not started",
    learning: "Learning",
    known: "Known",
    mastered: "Mastered",
  } satisfies Record<MasteryBand, string>,
  /**
   * Parts of speech, by the value written in the lesson files. One missing
   * here shows as written; validate-content.mjs lists the ones allowed.
   */
  pos: {
    noun: "noun",
    pronoun: "pronoun",
    number: "number",
    counter: "counter",
    "verb (godan)": "verb (godan)",
    "verb (ichidan)": "verb (ichidan)",
    "verb (irregular)": "verb (irregular)",
    "i-adjective": "i-adjective",
    "na-adjective": "na-adjective",
    adverb: "adverb",
    particle: "particle",
    conjunction: "conjunction",
    interjection: "interjection",
    expression: "expression",
    prefix: "prefix",
    suffix: "suffix",
  } as Record<string, string>,
};

const id: typeof en = {
  metaDescription:
    "Pelajari kanji JLPT N5 dan N4 sekitar lima sekaligus, lengkap dengan urutan goresan, kata-kata yang memantapkan cara bacanya, dan latihan menulis dari ingatan (opsional).",
  band: {
    new: "Belum dimulai",
    learning: "Sedang dipelajari",
    known: "Sudah tahu",
    mastered: "Dikuasai",
  },
  pos: {
    noun: "nomina",
    pronoun: "pronomina",
    number: "numeralia",
    counter: "kata bantu bilangan",
    "verb (godan)": "verba (godan)",
    "verb (ichidan)": "verba (ichidan)",
    "verb (irregular)": "verba (tak beraturan)",
    "i-adjective": "adjektiva-i",
    "na-adjective": "adjektiva-na",
    adverb: "adverbia",
    particle: "partikel",
    conjunction: "konjungsi",
    interjection: "interjeksi",
    expression: "ungkapan",
    prefix: "prefiks",
    suffix: "sufiks",
  },
};

export const common = { en, id };
