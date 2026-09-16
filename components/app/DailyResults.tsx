"use client";

import { Badge } from "@/components/atlas/core/Badge.jsx";
import { Card } from "@/components/atlas/layout/Card.jsx";
import { Sparkle } from "@/components/atlas/core/Sparkle.jsx";
import type { DailyAnswerRow } from "@/lib/progress";
import type { Locale } from "@/lib/i18n/config";
import { intlTag } from "@/lib/i18n/format";
import { useLocale, useT } from "@/lib/i18n/client";

/**
 * A quiz date as a heading, e.g. "Saturday 12 September".
 *
 * Fixed locale and UTC: the date is already the learner's own day, and this
 * renders on the server and again in the browser, where any other choice
 * could disagree and trip a hydration mismatch. English keeps its day-month
 * order (en-GB) rather than intlTag's en-US.
 */
export function formatQuizDate(date: string, locale: Locale) {
  return new Date(`${date}T00:00:00Z`).toLocaleDateString(locale === "en" ? "en-GB" : intlTag(locale), {
    weekday: "long",
    day: "numeric",
    month: "long",
    timeZone: "UTC",
  });
}

/**
 * The finished quiz. Rendered by the page once every answer is on record, and
 * by the quiz itself the moment the last one is given, so the two must look
 * the same — the page's version replaces the quiz's as soon as it refreshes.
 */
export function DailyResults({ date, rows }: { date: string; rows: DailyAnswerRow[] }) {
  const t = useT().daily;
  const locale = useLocale();
  const correct = rows.filter((r) => r.correct).length;

  return (
    <div className="stack" style={{ gap: 20 }}>
      <Card tone="forest" pad="lg" radius="lg">
        <div className="stack" style={{ gap: 20 }}>
          <div className="row" style={{ gap: 10 }}>
            <Sparkle size={18} color="var(--lime-500)" />
            <span className="eyebrow" style={{ color: "var(--lime-500)" }}>
              {t.eyebrowDate(formatQuizDate(date, locale))}
            </span>
          </div>

          <div
            style={{
              fontSize: "var(--text-stat-lg)",
              fontWeight: "var(--weight-extrabold)",
              letterSpacing: "var(--tracking-stat)",
              color: "var(--lime-500)",
              lineHeight: 1,
            }}
          >
            {correct}/{rows.length}
          </div>

          <p style={{ margin: 0, color: "var(--forest-200)", maxWidth: 460 }}>
            {correct === rows.length
              ? t.allCorrect
              : correct === 0
                ? t.noneCorrect
                : ""}
            {t.tomorrow}
          </p>
        </div>
      </Card>

      <Card tone="white" pad="none" radius="lg" bordered>
        {rows.map((r, i) => (
          <div
            key={r.position}
            className="row"
            style={{
              gap: 18,
              padding: "16px 22px",
              borderTop: i === 0 ? "none" : "1px solid var(--border-subtle)",
              justifyContent: "space-between",
            }}
          >
            <div className="row" style={{ gap: 18, minWidth: 0 }}>
              <span className="jp" style={{ fontSize: 34, lineHeight: 1, color: "var(--text-heading)" }}>
                {r.char}
              </span>
              <div style={{ minWidth: 0 }}>
                <div style={{ color: "var(--text-heading)", fontWeight: "var(--weight-semibold)" }}>
                  {r.answer}
                </div>
                {!r.correct && (
                  <div className="body-sm" style={{ color: "var(--negative-600)" }}>
                    {t.youChose(r.chosen)}
                  </div>
                )}
              </div>
            </div>
            <Badge tone={r.correct ? "accent" : "sage"}>{r.correct ? t.correct : t.missed}</Badge>
          </div>
        ))}
      </Card>
    </div>
  );
}
