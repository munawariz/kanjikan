import Link from "next/link";
import { redirect } from "next/navigation";
import { getUser } from "@/lib/supabase/server";
import { getDashboard, getLessonSummaries, getWordProgress } from "@/lib/progress";
import { getAllWords } from "@/lib/content";
import { BAND_LABEL, type MasteryBand } from "@/lib/srs";
import { Badge } from "@/components/atlas/core/Badge.jsx";
import { Card } from "@/components/atlas/layout/Card.jsx";
import { BarChart } from "@/components/atlas/data/BarChart.jsx";

export const metadata = { title: "Progress — Kanjikan" };
export const dynamic = "force-dynamic";

const BAND_COLOUR: Record<MasteryBand, string> = {
  new: "var(--band-new)",
  learning: "var(--band-learning)",
  known: "var(--band-known)",
  mastered: "var(--band-mastered)",
};

export default async function ProgressPage() {
  const user = await getUser();
  if (!user) redirect("/login");

  const [data, progress] = await Promise.all([getDashboard(user.id), getWordProgress()]);
  const lessons = await getLessonSummaries("N5", { words: progress });

  const words = getAllWords();

  // Accuracy across every answer ever recorded, not just this session.
  let correct = 0;
  let attempts = 0;
  for (const p of progress.values()) {
    correct += p.correct_count;
    attempts += p.correct_count + p.incorrect_count;
  }
  const accuracy = attempts ? Math.round((correct / attempts) * 100) : 0;

  // The words getting missed most often — the honest part of a progress page.
  const trouble = [...progress.values()]
    .filter((p) => p.incorrect_count > 0)
    .sort((a, b) => b.incorrect_count - a.incorrect_count)
    .slice(0, 8)
    .map((p) => ({ row: p, word: words.find((w) => w.id === p.word_id) }))
    .filter((x) => x.word);

  return (
    <div className="stack" style={{ gap: 48 }}>
      <header className="stack" style={{ gap: 16 }}>
        <p className="eyebrow">Your progress</p>
        <h1
          style={{
            margin: 0,
            fontSize: "var(--text-display-3)",
            letterSpacing: "var(--tracking-display)",
            lineHeight: "var(--leading-display)",
            maxWidth: 720,
          }}
        >
          {data.kanjiKnown} of {data.totalKanji} N5 kanji are sticking.
        </h1>
        <p style={{ margin: 0, maxWidth: 560 }}>
          A character counts as known once its meaning has survived a week-long gap. Everything
          below is measured against that bar, not against how many cards you have seen.
        </p>
      </header>

      <section className="grid grid-4">
        {[
          { label: "Kanji known", value: data.kanjiKnown, sub: `of ${data.totalKanji}` },
          { label: "Accuracy", value: `${accuracy}%`, sub: `${attempts} answers` },
          { label: "Day streak", value: data.streak, sub: "consecutive days" },
          { label: "Due now", value: data.dueNow, sub: "waiting for review" },
        ].map((stat) => (
          <Card key={stat.label} tone="white" pad="md" radius="lg" bordered>
            <div
              style={{
                fontSize: "var(--text-stat-md)",
                fontWeight: "var(--weight-extrabold)",
                letterSpacing: "var(--tracking-stat)",
                color: "var(--text-heading)",
                lineHeight: 1,
              }}
            >
              {stat.value}
            </div>
            <div className="eyebrow" style={{ marginTop: 10 }}>
              {stat.label}
            </div>
            <div className="body-sm muted">{stat.sub}</div>
          </Card>
        ))}
      </section>

      <section className="grid grid-split" style={{ gap: 20 }}>
        <Card tone="cream" pad="lg" radius="lg">
          <div className="stack" style={{ gap: 24 }}>
            <div>
              <p className="eyebrow">Last 14 days</p>
              <h2 style={{ margin: "8px 0 0", fontSize: "var(--text-heading-3)" }}>Cards answered</h2>
            </div>
            <BarChart data={data.activity} height={180} highlight="alternate" />
          </div>
        </Card>

        <Card tone="forest" pad="lg" radius="lg">
          <div className="stack" style={{ gap: 24 }}>
            <div>
              <p className="eyebrow" style={{ color: "var(--lime-500)" }}>
                Mastery
              </p>
              <h2
                style={{
                  margin: "8px 0 0",
                  fontSize: "var(--text-heading-3)",
                  color: "var(--white)",
                }}
              >
                Every N5 kanji
              </h2>
            </div>

            <div className="stack" style={{ gap: 16 }}>
              {(Object.keys(BAND_LABEL) as MasteryBand[]).map((band) => {
                const pct = Math.round((data.bands[band] / Math.max(data.totalKanji, 1)) * 100);
                return (
                  <div key={band} className="stack" style={{ gap: 8 }}>
                    <div className="row" style={{ justifyContent: "space-between" }}>
                      <span className="body-sm" style={{ color: "var(--forest-200)" }}>
                        {BAND_LABEL[band]}
                      </span>
                      <span
                        className="body-sm"
                        style={{ fontFamily: "var(--font-mono)", color: "var(--white)" }}
                      >
                        {data.bands[band]}
                      </span>
                    </div>
                    <div className="meter" style={{ background: "rgba(255,255,255,.16)" }}>
                      <span style={{ width: `${pct}%`, background: BAND_COLOUR[band] }} />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </Card>
      </section>

      {trouble.length > 0 && (
        <section className="stack" style={{ gap: 20 }}>
          <div>
            <p className="eyebrow">Needs another look</p>
            <h2 style={{ margin: "8px 0 0", fontSize: "var(--text-heading-1)" }}>
              The words tripping you up
            </h2>
          </div>

          <div className="grid grid-4">
            {trouble.map(({ row, word }) => (
              <Card key={row.word_id} tone="white" pad="md" radius="md" bordered>
                <div className="stack" style={{ gap: 10 }}>
                  <div className="jp" style={{ fontSize: 26, color: "var(--text-heading)" }}>
                    {word!.word}
                  </div>
                  {word!.reading !== word!.word && (
                    <div className="jp body-sm muted">{word!.reading}</div>
                  )}
                  <div className="body-sm" style={{ color: "var(--text-heading)" }}>
                    {word!.meanings[0]}
                  </div>
                  <Badge tone="negative">
                    {row.incorrect_count} {row.incorrect_count === 1 ? "miss" : "misses"}
                  </Badge>
                </div>
              </Card>
            ))}
          </div>
        </section>
      )}

      <section className="stack" style={{ gap: 20 }}>
        <div>
          <p className="eyebrow">By lesson</p>
          <h2 style={{ margin: "8px 0 0", fontSize: "var(--text-heading-1)" }}>
            All {lessons.length} lessons
          </h2>
        </div>

        <Card tone="white" pad="none" radius="lg" bordered>
          {lessons.map((lesson, i) => (
            <Link
              key={lesson.slug}
              href={`/lessons/${lesson.slug}`}
              className="reset-link row"
              style={{
                gap: 20,
                padding: "16px 24px",
                borderTop: i === 0 ? "none" : "1px solid var(--border-subtle)",
                justifyContent: "space-between",
                flexWrap: "wrap",
              }}
            >
              <div className="row" style={{ gap: 18, minWidth: 0, flex: 1 }}>
                <span
                  style={{
                    fontFamily: "var(--font-mono)",
                    fontSize: "var(--text-body-xs)",
                    color: "var(--text-muted)",
                    width: 24,
                    flex: "0 0 auto",
                  }}
                >
                  {String(lesson.order).padStart(2, "0")}
                </span>
                <span
                  style={{
                    fontWeight: "var(--weight-semibold)",
                    color: "var(--text-heading)",
                    minWidth: 0,
                  }}
                >
                  {lesson.title}
                </span>
              </div>

              <div className="row lesson-row-meter" style={{ gap: 16 }}>
                <div className="meter" style={{ width: "100%", minWidth: 80 }}>
                  <span style={{ width: `${lesson.percent}%` }} />
                </div>
                <span
                  className="body-sm"
                  style={{
                    fontFamily: "var(--font-mono)",
                    color: "var(--text-heading)",
                    width: 68,
                    textAlign: "right",
                  }}
                >
                  {lesson.kanjiKnown}/{lesson.kanji.length}
                </span>
              </div>
            </Link>
          ))}
        </Card>
      </section>
    </div>
  );
}
