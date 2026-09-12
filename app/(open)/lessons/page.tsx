import { getUser } from "@/lib/auth";
import { getLessonSummaries, getProgress } from "@/lib/progress";
import { levelStats } from "@/lib/content";
import { LessonCard } from "@/components/app/LessonCard";
import { Card } from "@/components/atlas/layout/Card.jsx";

export const dynamic = "force-dynamic";

export default async function LessonsPage() {
  const lessons = getLessonSummaries(await getProgress(await getUser()));
  const stats = levelStats("N5");

  const completed = lessons.filter((l) => l.status === "completed").length;
  const inProgress = lessons.filter((l) => l.status === "learning").length;

  return (
    <div className="stack" style={{ gap: 40 }}>
      <header className="stack" style={{ gap: 20 }}>
        <p className="eyebrow">JLPT N5 curriculum</p>
        <h1
          style={{
            margin: 0,
            fontSize: "var(--text-display-3)",
            letterSpacing: "var(--tracking-display)",
            lineHeight: "var(--leading-display)",
            maxWidth: 720,
          }}
        >
          {stats.kanji} kanji, five at a time.
        </h1>
        <p style={{ margin: 0, maxWidth: 560 }}>
          Lessons run in order, but nothing is locked. Each introduces five characters, teaches the
          words that fix their readings, and ends with you writing each one from memory.
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

      <div className="grid grid-3 grid-roomy">
        {lessons.map((lesson, i) => (
          <LessonCard key={lesson.slug} lesson={lesson} index={i} />
        ))}
      </div>
    </div>
  );
}
