import type { Level } from "./content";

/** Kanji by character, as their ordered KanjiVG stroke paths. */
export type StrokeBank = Record<string, string[]>;

type StrokeFile = { kanji: Record<string, { strokes: string[] }> };

/**
 * The writing check asks which kanji a drawing looks most like, which needs
 * every candidate's strokes, not just the one on the card. Each level's file
 * is its own chunk, fetched the first time a writing card needs it and never
 * by any other screen.
 *
 * A new level needs a line here as well as in LEVELS in lib/content.ts: a
 * dynamic import has to name its file for the bundler to find it.
 */
const LOADERS: Partial<Record<Level, () => Promise<StrokeFile>>> = {
  N5: () => import("@/data/jlpt/n5/strokes.json").then((m) => m.default as StrokeFile),
  N4: () => import("@/data/jlpt/n4/strokes.json").then((m) => m.default as StrokeFile),
};

/** Study order. Not imported from lib/content.ts, which reads files and cannot ship to the browser. */
const ORDER: Level[] = ["N5", "N4", "N3", "N2", "N1"];

const cache = new Map<Level, Promise<StrokeBank | null>>();

/** One level's file. Resolves to null rather than rejecting when it cannot be had. */
function loadLevel(level: Level): Promise<StrokeBank | null> {
  let pending = cache.get(level);
  if (!pending) {
    const load = LOADERS[level];
    pending = load
      ? load()
          .then((file) => Object.fromEntries(Object.entries(file.kanji).map(([char, k]) => [char, k.strokes])))
          .catch((e) => {
            console.error(`[kanjikan] could not load stroke data for ${level}`, e);
            // Not cached, so the next card tries again.
            cache.delete(level);
            return null;
          })
      : Promise.resolve(null);
    cache.set(level, pending);
  }
  return pending;
}

/**
 * The kanji a drawing for this level is compared against: the level's own and
 * every earlier level's. A learner writing N4's 体 knows N5's 休, and drawing
 * one for the other is exactly the slip the check exists to catch.
 *
 * Resolves to null only when none of the files can be had. The check still
 * runs without it, only without the lookalike test.
 */
export function loadStrokeBank(level: Level): Promise<StrokeBank | null> {
  const levels = ORDER.slice(0, ORDER.indexOf(level) + 1);
  return Promise.all(levels.map(loadLevel)).then((banks) => {
    const found = banks.filter((b): b is StrokeBank => b !== null);
    return found.length ? Object.assign({}, ...found) : null;
  });
}
