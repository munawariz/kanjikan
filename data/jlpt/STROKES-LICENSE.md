# Stroke data licence

`data/jlpt/*/strokes.json` is derived from **KanjiVG**.

> KanjiVG is copyright (c) 2009-2011 Ulrich Apel and released under the
> Creative Commons Attribution-Share Alike 3.0 licence.
> <https://kanjivg.tagaini.net>

## What this means for this project

- **Attribution is required.** KanjiVG is credited in the app (the writing
  practice screen), in the README, and in the header of `strokes.json` itself.
- **Share Alike applies to the stroke data.** `strokes.json` is a derivative
  work, so that file must stay under CC BY-SA 3.0. Redistributing it — or any
  file built from it — carries the same obligation.
- **It does not relicense the rest of the app.** The stroke data is aggregated
  alongside the application, not merged into it. The vocabulary JSON, the
  application code and the design system are unaffected.

If that obligation is unwanted, delete `strokes.json` and remove the
`fetch:strokes` script. The writing practice screen degrades to a plain grid
with no stroke-order playback; nothing else in the app depends on it.

## Regenerating

    npm run fetch:strokes

Pulls the current data for whichever kanji are listed in that level's
`kanji.json`. Only the ordered stroke geometry and the radical are kept.
