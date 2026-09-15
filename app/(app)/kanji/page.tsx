import { redirect } from "next/navigation";
import {
  availableLevels,
  getKanji,
  getLessons,
  getWordsTeaching,
  getWordsUsingKanji,
  strokeViewBox,
} from "@/lib/content";
import { getUser } from "@/lib/auth";
import {
  getKanjiReadings,
  getProfile,
  getProgress,
  studiesWriting,
  wordMarkState,
  writingMarkState,
} from "@/lib/progress";
import { KNOWN_STAGE, kanjiReading } from "@/lib/srs";
import { KanjiExplorer, type KanjiEntry } from "@/components/app/KanjiExplorer";

export const dynamic = "force-dynamic";

export default async function KanjiPage() {
  const user = await getUser();
  if (!user) redirect("/login");

  const kanji = getKanji();
  const [progress, profile] = await Promise.all([getProgress(user), getProfile(user.id)]);
  const writing = studiesWriting(profile);
  const readings = getKanjiReadings(progress.words);
  const lessonTitles = new Map(getLessons().map((l) => [l.slug, l.title]));

  const entries: KanjiEntry[] = kanji.map((k) => {
    const p = progress.kanji.get(k.char);
    const reading = readings.get(k.char) ?? kanjiReading([]);
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
      level: k.level,
      lessonOrder: k.lessonOrder,
      lessonSlug: k.lessonSlug,
      lessonTitle: lessonTitles.get(k.lessonSlug) ?? k.lessonSlug,
      reading,
      readingMarks: wordMarkState(getWordsTeaching(k.char), progress.words),
      canWrite: writing && (p?.writing_stage ?? 0) >= KNOWN_STAGE,
      writingMarks: writing ? writingMarkState([k.char], progress.kanji) : null,
      words: getWordsUsingKanji(k.char).map((w) => ({
        id: w.id,
        word: w.word,
        reading: w.reading,
        meanings: w.meanings,
      })),
    };
  });

  const known = entries.filter((e) => e.reading.band === "known" || e.reading.band === "mastered").length;

  return (
    <div className="stack" style={{ gap: 32 }}>
      <header className="stack" style={{ gap: 16 }}>
        <p className="eyebrow">
          All {kanji.length} kanji, {availableLevels().join(" and ")}
        </p>
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
          {writing
            ? "In curriculum order. A tinted tile is a character you know — most of its words are known; the dot marks one you can also write from memory. Select any character for its stroke order, readings and vocabulary."
            : "In curriculum order. A tinted tile is a character you know — most of its words are known. Select any character for its stroke order, readings and vocabulary."}
        </p>
      </header>

      <KanjiExplorer entries={entries} viewBox={strokeViewBox()} />
    </div>
  );
}
