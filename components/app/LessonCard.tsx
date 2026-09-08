import Link from "next/link";
import { Badge } from "@/components/atlas/core/Badge.jsx";
import { Card } from "@/components/atlas/layout/Card.jsx";
import type { LessonSummary } from "@/lib/progress";

const STATUS: Record<LessonSummary["status"], { label: string; tone: "sage" | "soft" | "accent" }> = {
  not_started: { label: "Not started", tone: "sage" },
  learning: { label: "In progress", tone: "soft" },
  completed: { label: "Completed", tone: "accent" },
};

/**
 * A lesson tile. Atlas alternates cream and sage across a grid, so the tone is
 * driven by position rather than by status — status is carried by the badge.
 */
export function LessonCard({ lesson, index }: { lesson: LessonSummary; index: number }) {
  const status = STATUS[lesson.status];
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
            <Badge tone={status.tone}>{status.label}</Badge>
          </div>

          <div className="stack" style={{ gap: 8, flex: 1 }}>
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
              <span>
                {lesson.known} of {lesson.total} known
              </span>
              {lesson.due > 0 && <span>{lesson.due} due</span>}
            </div>
          </div>
        </div>
      </Card>
    </Link>
  );
}
