import { getUser } from "@/lib/auth";
import { getLessonSummaries, getProgress } from "@/lib/progress";
import { getLevelPath, levelStats } from "@/lib/content";
import { LessonCard } from "@/components/app/LessonCard";
import { Card } from "@/components/atlas/layout/Card.jsx";
import { getLocale, getT } from "@/lib/i18n/server";

export const dynamic = "force-dynamic";

export default async function LessonsPage() {
  const locale = await getLocale();
  const lessons = getLessonSummaries(await getProgress(await getUser()), undefined, locale);
  const stats = levelStats();
  const levels = getLevelPath(locale).filter((l) => l.available);
  const t = await getT();

  const completed = lessons.filter((l) => l.status === "completed").length;
  const inProgress = lessons.filter((l) => l.status === "learning").length;

  return (
    <div className="stack" style={{ gap: 40 }}>
      <header className="stack" style={{ gap: 20 }}>
        <p className="eyebrow">{t.lessons.curriculum(levels.map((l) => l.level))}</p>
        <h1
          style={{
            margin: 0,
            fontSize: "var(--text-display-3)",
            letterSpacing: "var(--tracking-display)",
            lineHeight: "var(--leading-display)",
            maxWidth: 720,
          }}
        >
          {t.lessons.heading(stats.kanji)}
        </h1>
        <p style={{ margin: 0, maxWidth: 560 }}>
          {t.lessons.intro(levels[0].level, levels[levels.length - 1].level)}
        </p>
      </header>

      <Card tone="cream" pad="md" radius="lg">
        <div className="row" style={{ gap: 48, flexWrap: "wrap" }}>
          {[
            [String(stats.kanji), t.lessons.statKanji],
            [String(stats.lessons), t.lessons.statLessons],
            [String(completed), t.lessons.statCompleted],
            [String(inProgress), t.lessons.statInProgress],
          ].map(([value, label]) => (
            <div key={label}>
              <div
                style={{
                  fontSize: "var(--text-stat-sm)",
                  fontWeight: "var(--weight-extrabold)",
                  letterSpacing: "var(--tracking-stat)",
                  color: "var(--on-tint-heading)",
                }}
              >
                {value}
              </div>
              <div className="eyebrow" style={{ marginTop: 4, color: "var(--on-tint-body)" }}>
                {label}
              </div>
            </div>
          ))}
        </div>
      </Card>

      {levels.map((level) => {
        const own = lessons.filter((l) => l.level === level.level);
        return (
          <section key={level.level} className="stack" style={{ gap: 24 }}>
            <div className="stack" style={{ gap: 8 }}>
              <p className="eyebrow">
                {t.lessons.levelRange(level.level, own[0].order, own[own.length - 1].order)}
              </p>
              <h2 style={{ margin: 0, fontSize: "var(--text-heading-1)" }}>
                {t.lessons.levelHeading(level.title, level.kanji)}
              </h2>
              <p className="body-sm muted" style={{ margin: 0, maxWidth: 620 }}>
                {level.blurb}
              </p>
            </div>
            <div className="grid grid-3 grid-roomy">
              {own.map((lesson, i) => (
                <LessonCard key={lesson.slug} lesson={lesson} index={i} />
              ))}
            </div>
          </section>
        );
      })}
    </div>
  );
}
