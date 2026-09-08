import { getAllWords, getKanji } from "@/lib/content";
import { getWordProgress } from "@/lib/progress";
import { KNOWN_STAGE } from "@/lib/srs";
import { KanjiExplorer, type KanjiEntry } from "@/components/app/KanjiExplorer";

export const metadata = { title: "Kanji — Kanjikan" };
export const dynamic = "force-dynamic";

export default async function KanjiPage() {
  const kanji = getKanji();
  const words = getAllWords();
  const progress = await getWordProgress();

  const entries: KanjiEntry[] = kanji.map((k) => {
    const using = words.filter((w) => w.kanji.includes(k.char));
    return {
      ...k,
      words: using.map((w) => ({
        id: w.id,
        word: w.word,
        reading: w.reading,
        meanings: w.meanings,
        lessonSlug: w.lessonSlug,
      })),
      known: using.filter((w) => (progress.get(w.id)?.srs_stage ?? 0) >= KNOWN_STAGE).length,
    };
  });

  return (
    <div className="stack" style={{ gap: 32 }}>
      <header className="stack" style={{ gap: 16 }}>
        <p className="eyebrow">Reference</p>
        <h1
          style={{
            margin: 0,
            fontSize: "var(--text-display-3)",
            letterSpacing: "var(--tracking-display)",
            lineHeight: "var(--leading-display)",
            maxWidth: 720,
          }}
        >
          All 80 N5 kanji, and the words that use them.
        </h1>
        <p style={{ margin: 0, maxWidth: 560 }}>
          Nothing here is drilled on its own. Characters are learned through the words in your
          lessons; this page is for looking one up and seeing where else it appears.
        </p>
      </header>

      <KanjiExplorer entries={entries} />
    </div>
  );
}
