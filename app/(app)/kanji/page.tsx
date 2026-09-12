import { getKanji, getLessons, getWordsUsingKanji, strokeViewBox } from "@/lib/content";
import { getKanjiProgress } from "@/lib/progress";
import { KNOWN_STAGE } from "@/lib/srs";
import { KanjiExplorer, type KanjiEntry } from "@/components/app/KanjiExplorer";

export const dynamic = "force-dynamic";

export default async function KanjiPage() {
  const kanji = getKanji();
  const progress = await getKanjiProgress();
  const lessonTitles = new Map(getLessons().map((l) => [l.slug, l.title]));

  const entries: KanjiEntry[] = kanji.map((k) => {
    const p = progress.get(k.char);
    return {
      char: k.char,
      strokes: k.strokes,
      meanings: k.meanings,
      onyomi: k.onyomi,
      kunyomi: k.kunyomi,
      radical: k.radical,
      radicalPart: k.radicalPart,
      parts: k.parts,
      mnemonic: k.mnemonic,
      usedIn: k.usedIn,
      strokePaths: k.strokePaths,
      order: k.order,
      lessonSlug: k.lessonSlug,
      lessonTitle: lessonTitles.get(k.lessonSlug) ?? k.lessonSlug,
      known: (p?.recognition_stage ?? 0) >= KNOWN_STAGE,
      canWrite: (p?.writing_stage ?? 0) >= KNOWN_STAGE,
      words: getWordsUsingKanji(k.char).map((w) => ({
        id: w.id,
        word: w.word,
        reading: w.reading,
        meanings: w.meanings,
      })),
    };
  });

  const known = entries.filter((e) => e.known).length;

  return (
    <div className="stack" style={{ gap: 32 }}>
      <header className="stack" style={{ gap: 16 }}>
        <p className="eyebrow">All {kanji.length} N5 kanji</p>
        <h1
          style={{
            margin: 0,
            fontSize: "var(--text-display-3)",
            letterSpacing: "var(--tracking-display)",
            lineHeight: "var(--leading-display)",
            maxWidth: 720,
          }}
        >
          {known} of {kanji.length} characters known.
        </h1>
        <p style={{ margin: 0, maxWidth: 560 }}>
          In curriculum order. A tinted tile is a character you know; the dot marks one you can also
          write from memory. Select any character for its stroke order, readings and vocabulary.
        </p>
      </header>

      <KanjiExplorer entries={entries} viewBox={strokeViewBox()} />
    </div>
  );
}
