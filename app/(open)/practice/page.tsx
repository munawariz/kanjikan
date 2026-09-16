import { getKanji, getLevelPath, isLevelAvailable } from "@/lib/content";
import { PracticeSetup, type PracticeLevel } from "@/components/app/PracticeSetup";
import { getLocale, getT } from "@/lib/i18n/server";

/**
 * Practice: drill any kanji, signed in or not.
 *
 * Open to guests, and never saved for anyone — see StudySession's practice
 * mode. The query string carries choices back from a finished run's "Change
 * Practice", in the same shape the session page reads.
 */
export default async function PracticePage({
  searchParams,
}: {
  searchParams: { kanji?: string; levels?: string; types?: string };
}) {
  const [t, locale] = await Promise.all([getT(), getLocale()]);
  const levels: PracticeLevel[] = getLevelPath(locale).map((entry) => {
    const available = isLevelAvailable(entry.level);
    return {
      level: entry.level,
      title: entry.title,
      available,
      kanji: available ? getKanji(entry.level, locale).map((k) => ({ char: k.char, meaning: k.meanings[0] ?? "" })) : [],
    };
  });

  return (
    <div className="stack" style={{ gap: 32 }}>
      <header className="stack" style={{ gap: 16 }}>
        <p className="eyebrow">{t.practice.eyebrow}</p>
        <h1
          style={{
            margin: 0,
            fontSize: "var(--text-display-3)",
            letterSpacing: "var(--tracking-display)",
            lineHeight: "var(--leading-display)",
            maxWidth: 720,
          }}
        >
          {t.practice.heading}
        </h1>
        <p style={{ margin: 0, maxWidth: 560 }}>
          {t.practice.intro}
        </p>
      </header>

      <PracticeSetup
        levels={levels}
        initialKanji={searchParams.kanji ?? ""}
        initialLevels={searchParams.levels ?? ""}
        initialTypes={searchParams.types ?? ""}
      />
    </div>
  );
}
