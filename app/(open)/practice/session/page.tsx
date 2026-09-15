import { redirect } from "next/navigation";
import { getAllWords, getKanji, getWordsTeaching, type Level } from "@/lib/content";
import { getUser } from "@/lib/auth";
import { getWordProgress } from "@/lib/progress";
import { PRACTICE_TYPES } from "@/lib/study";
import { StudySession } from "@/components/app/StudySession";

export const dynamic = "force-dynamic";

/**
 * A practice run, built from the choices made on /practice.
 *
 * ?levels=N5 takes a whole level, ?kanji=日月木 single characters, and the two
 * combine; ?types=reading,writing says what to drill. Anything that is not a
 * character or a type the app has is dropped, and a run left with nothing to
 * do goes back to the practice page rather than showing an empty session.
 */
export default async function PracticeSessionPage({
  searchParams,
}: {
  searchParams: { kanji?: string; levels?: string; types?: string };
}) {
  const wholeLevels = new Set((searchParams.levels ?? "").split(","));
  const singles = new Set(searchParams.kanji ?? "");
  const kanji = getKanji().filter((k) => wholeLevels.has(k.level) || singles.has(k.char));
  const requested = (searchParams.types ?? "").split(",");
  const types = PRACTICE_TYPES.filter((t) => requested.includes(t));

  if (kanji.length === 0 || types.length === 0) {
    const back = new URLSearchParams();
    for (const key of ["kanji", "levels", "types"] as const) {
      const value = searchParams[key];
      if (value) back.set(key, value);
    }
    redirect(`/practice${back.size ? `?${back}` : ""}`);
  }

  const user = await getUser();
  const words = types.includes("reading") ? kanji.flatMap((k) => getWordsTeaching(k.char)) : [];

  // Read only to choose how each word is asked, as a review would: a word
  // already well known is asked for its reading or recalled from English
  // rather than only translated. Nothing is written back.
  const wordStages: Record<string, number> = {};
  if (user && words.length) {
    const progress = await getWordProgress(user.id);
    for (const w of words) {
      const p = progress.get(w.id);
      if (p) wordStages[w.id] = p.srs_stage;
    }
  }

  // Wrong answers come from every level the run touches, so a pick of one or
  // two characters still has enough of them, and none give the game away.
  const touched = [...new Set(kanji.map((k) => k.level))] as Level[];

  return (
    <div className="stack" style={{ gap: 16, maxWidth: 620, margin: "0 auto" }}>
      <p className="body-sm muted" style={{ margin: 0 }}>
        Practising{" "}
        {kanji.length <= 12 ? <span className="jp">{kanji.map((k) => k.char).join(" ")}</span> : `${kanji.length} kanji`}.
        Nothing you answer here is saved.
      </p>
      <StudySession
        mode="practice"
        practiceTypes={types}
        guest={!user}
        lessonSlug={null}
        lessonTitle="Practice"
        kanji={kanji}
        words={words}
        pool={touched.flatMap((l) => getAllWords(l))}
        kanjiPool={touched.flatMap((l) => getKanji(l)).map(({ char, meanings }) => ({ char, meanings }))}
        wordStages={wordStages}
        seed={Date.now() % 2147483647}
      />
    </div>
  );
}
