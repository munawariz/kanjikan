import { getUser } from "@/lib/auth";
import { getLessonSummaries, getProgress } from "@/lib/progress";
import { getLevelPath, levelStats } from "@/lib/content";
import { LessonCard } from "@/components/app/LessonCard";
import { Card } from "@/components/atlas/layout/Card.jsx";

export const dynamic = "force-dynamic";

export default async function LessonsPage() {
  const lessons = getLessonSummaries(await getProgress(await getUser()));
  const stats = levelStats();
  const levels = getLevelPath().filter((l) => l.available);

  const completed = lessons.filter((l) => l.status === "completed").length;
  const inProgress = lessons.filter((l) => l.status === "learning").length;

  return (
    <div className="stack" style={{ gap: 40 }}>
      <header className="stack" style={{ gap: 20 }}>
        <p className="eyebrow">JLPT {levels.map((l) => l.level).join(" and ")} curriculum</p>
        <h1
          style={{
            margin: 0,
            fontSize: "var(--text-display-3)",
            letterSpacing: "var(--tracking-display)",
            lineHeight: "var(--leading-display)",
            maxWidth: 720,
          }}
        >
          {stats.kanji} kanji, about five at a time.
        </h1>
        <p style={{ margin: 0, maxWidth: 560 }}>
          Lessons run in order, from {levels[0].level} into {levels[levels.length - 1].level}, but
          nothing is locked. Each introduces a handful of characters and teaches the words that fix
          their readings. If you are learning to write, it ends with you writing each one from memory.
        </p>
      </header>

      <Card tone="cream" pad="md" radius="lg">
        <div className="row" style={{ gap: 48, flexWrap: "wrap" }}>
          {[
            [String(stats.kanji), "Kanji"],
            [String(stats.lessons), "Lessons"],
            [String(completed), "Completed"],
            [String(inProgress), "In progress"],
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
                {level.level} · Lessons {own[0].order}–{own[own.length - 1].order}
              </p>
              <h2 style={{ margin: 0, fontSize: "var(--text-heading-1)" }}>
                {level.title}: {level.kanji} kanji
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
