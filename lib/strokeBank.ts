import type { Level } from "./content";

/** Every kanji of a level, by character, as its ordered KanjiVG stroke paths. */
export type StrokeBank = Record<string, string[]>;

type StrokeFile = { kanji: Record<string, { strokes: string[] }> };

/**
 * The writing check asks which kanji of the level a drawing looks most like,
 * which needs every kanji's strokes, not just the one on the card. Each level's
 * file is its own chunk, fetched the first time a writing card needs it and
 * never by any other screen.
 *
 * A new level needs a line here as well as in LEVELS in lib/content.ts: a
 * dynamic import has to name its file for the bundler to find it.
 */
const LOADERS: Partial<Record<Level, () => Promise<StrokeFile>>> = {
  N5: () => import("@/data/jlpt/n5/strokes.json").then((m) => m.default as StrokeFile),
};

const cache = new Map<Level, Promise<StrokeBank | null>>();

/**
 * Resolves to null rather than rejecting when the file cannot be had. The
 * check still runs without it, only without the lookalike test.
 */
export function loadStrokeBank(level: Level): Promise<StrokeBank | null> {
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
