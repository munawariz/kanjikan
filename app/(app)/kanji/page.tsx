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
import { getLocale, getT } from "@/lib/i18n/server";
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

  const [t, locale] = await Promise.all([getT(), getLocale()]);
  const kanji = getKanji(undefined, locale);
  const [progress, profile] = await Promise.all([getProgress(user), getProfile(user.id)]);
  const writing = studiesWriting(profile);
  const readings = getKanjiReadings(progress.words);
  const lessonTitles = new Map(getLessons(undefined, locale).map((l) => [l.slug, l.title]));

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
      words: getWordsUsingKanji(k.char, locale).map((w) => ({
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
          {t.kanji.page.eyebrow(kanji.length, availableLevels())}
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
          {t.kanji.page.heading(known, kanji.length)}
        </h1>
        <p style={{ margin: 0, maxWidth: 560 }}>
          {writing ? t.kanji.page.introWriting : t.kanji.page.intro}
        </p>
      </header>

      <KanjiExplorer entries={entries} viewBox={strokeViewBox()} />
    </div>
  );
}
