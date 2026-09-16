import Link from "next/link";
import { Badge } from "@/components/atlas/core/Badge.jsx";
import { Card } from "@/components/atlas/layout/Card.jsx";
import type { LessonSummary } from "@/lib/progress";
import { getT } from "@/lib/i18n/server";

const STATUS_TONE: Record<LessonSummary["status"], "sage" | "soft" | "accent"> = {
  not_started: "sage",
  learning: "soft",
  completed: "accent",
};

/**
 * A lesson tile, leading with the characters it teaches.
 *
 * The glyphs are the whole point of the lesson, so they get the largest
 * type on the card. Atlas alternates cream and sage across a grid, so tone is
 * driven by position; status is carried by the badge.
 */
export async function LessonCard({ lesson, index }: { lesson: LessonSummary; index: number }) {
  const t = await getT();
  const tone = index % 2 === 0 ? "cream" : "sage";

  return (
    <Link href={`/lessons/${lesson.slug}`} className="card-link">
      <Card tone={tone} pad="md" radius="lg" hover style={{ height: "100%" }}>
        <div className="stack" style={{ gap: 16, height: "100%" }}>
          <div className="row" style={{ justifyContent: "space-between", gap: 12 }}>
            <span
              style={{
                fontFamily: "var(--font-mono)",
                fontSize: "var(--text-body-sm)",
                color: "var(--on-tint-body)",
              }}
            >
              {String(lesson.order).padStart(2, "0")}
            </span>
            <Badge tone={STATUS_TONE[lesson.status]}>{t.shell.lessonStatus[lesson.status]}</Badge>
          </div>

          <div className="row jp" style={{ gap: 10, flexWrap: "wrap" }}>
            {lesson.kanji.map((char) => (
              <span
                key={char}
                style={{ fontSize: 34, lineHeight: 1, color: "var(--on-tint-heading)" }}
              >
                {char}
              </span>
            ))}
          </div>

          <div className="stack" style={{ gap: 6, flex: 1 }}>
            <h3 style={{ margin: 0, fontSize: "var(--text-heading-4)" }}>{lesson.title}</h3>
            <p className="body-sm" style={{ margin: 0, color: "var(--on-tint-body)" }}>
              {lesson.summary}
            </p>
          </div>

          <div className="stack" style={{ gap: 10 }}>
            <div className="meter on-tint">
              <span style={{ width: `${lesson.percent}%` }} />
            </div>
            <div
              className="row body-sm"
              style={{ justifyContent: "space-between", color: "var(--on-tint-body)" }}
            >
              <span>{t.shell.kanjiKnown(lesson.kanjiKnown, lesson.kanji.length)}</span>
              {lesson.due > 0 && <span>{t.shell.due(lesson.due)}</span>}
            </div>
          </div>
        </div>
      </Card>
    </Link>
  );
}
