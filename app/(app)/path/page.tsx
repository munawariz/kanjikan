import Link from "next/link";
import { redirect } from "next/navigation";
import { getUser } from "@/lib/supabase/server";
import { getLevelPath, getLessons } from "@/lib/content";
import { getDashboard, getLessonSummaries } from "@/lib/progress";
import { Badge } from "@/components/atlas/core/Badge.jsx";
import { Button } from "@/components/atlas/core/Button.jsx";
import { Card } from "@/components/atlas/layout/Card.jsx";
import { Sparkle } from "@/components/atlas/core/Sparkle.jsx";

export const dynamic = "force-dynamic";

export default async function PathPage() {
  const user = await getUser();
  if (!user) redirect("/login");

  const path = getLevelPath();
  const data = await getDashboard(user.id);
  const lessons = await getLessonSummaries();

  const totalTarget = path.reduce((n, l) => n + l.kanjiTarget, 0);
  const resume = data.resumeLesson ?? data.nextLesson;

  return (
    <div className="stack" style={{ gap: 44 }}>
      <header className="stack" style={{ gap: 16 }}>
        <p className="eyebrow">Learning path</p>
        <h1
          style={{
            margin: 0,
            fontSize: "var(--text-display-3)",
            letterSpacing: "var(--tracking-display)",
            lineHeight: "var(--leading-display)",
            maxWidth: 720,
          }}
        >
          Five levels, roughly {totalTarget.toLocaleString()} characters.
        </h1>
        <p style={{ margin: 0, maxWidth: 620 }}>
          N5 is built. The rest are mapped but not written yet — the counts below are the usual
          community estimates, because the JLPT publishes no official kanji list.
        </p>
      </header>

      <ol className="stack" style={{ gap: 0, listStyle: "none", margin: 0, padding: 0 }}>
        {path.map((entry, i) => {
          const isLast = i === path.length - 1;
          const percent = entry.available
            ? Math.round((data.kanjiKnown / Math.max(entry.kanji, 1)) * 100)
            : 0;

          return (
            <li key={entry.level} className="row path-row" style={{ gap: 24, alignItems: "stretch" }}>
              {/* Rail: a flat marker and a connecting line, the only decorative
                  shapes Atlas permits. */}
              <div
                className="stack path-rail"
                style={{ alignItems: "center", flex: "0 0 auto", width: 44 }}
                aria-hidden
              >
                <div
                  className="row"
                  style={{
                    width: 44,
                    height: 44,
                    borderRadius: "var(--radius-full)",
                    justifyContent: "center",
                    flex: "0 0 auto",
                    background: entry.available ? "var(--accent)" : "var(--surface-chip)",
                    color: entry.available ? "var(--text-on-accent)" : "var(--text-muted)",
                    fontWeight: "var(--weight-extrabold)",
                    fontSize: "var(--text-body-sm)",
                    letterSpacing: "var(--tracking-label)",
                  }}
                >
                  {entry.level}
                </div>
                {!isLast && (
                  <div style={{ width: 1.5, flex: 1, background: "var(--border-default)" }} />
                )}
              </div>

              <div style={{ flex: 1, paddingBottom: isLast ? 0 : 24 }}>
                <Card
                  tone={entry.available ? "cream" : "white"}
                  pad="lg"
                  radius="lg"
                  bordered={!entry.available}
                >
                  <div className="stack" style={{ gap: 20 }}>
                    <div
                      className="row"
                      style={{ justifyContent: "space-between", gap: 16, flexWrap: "wrap" }}
                    >
                      <div className="row" style={{ gap: 12, flexWrap: "wrap" }}>
                        <h2 style={{ margin: 0, fontSize: "var(--text-heading-2)" }}>
                          {entry.title}
                        </h2>
                        <Badge tone={entry.available ? "accent" : "sage"}>
                          {entry.available ? "Available now" : "Not written yet"}
                        </Badge>
                      </div>
                      <span
                        className="body-sm"
                        style={{
                          fontFamily: "var(--font-mono)",
                          color: entry.available ? "var(--on-tint-body)" : "var(--text-muted)",
                        }}
                      >
                        {entry.available
                          ? `${entry.kanji} kanji`
                          : `~${entry.kanjiTarget} kanji`}
                      </span>
                    </div>

                    <p
                      className="body-sm"
                      style={{
                        margin: 0,
                        maxWidth: 560,
                        color: entry.available ? "var(--on-tint-body)" : "var(--text-body)",
                      }}
                    >
                      {entry.blurb}
                    </p>

                    <div
                      className="body-sm"
                      style={{
                        padding: "10px 14px",
                        borderRadius: "var(--radius-sm)",
                        background: entry.available
                          ? "var(--meter-track-on-tint)"
                          : "var(--surface-sunken)",
                        color: entry.available ? "var(--on-tint-heading)" : "var(--text-body)",
                      }}
                    >
                      <strong>What you can do:</strong> {entry.canDo}
                    </div>

                    {entry.available ? (
                      <>
                        <div className="stack" style={{ gap: 10 }}>
                          <div className="meter on-tint">
                            <span style={{ width: `${percent}%` }} />
                          </div>
                          <div
                            className="row body-sm"
                            style={{ justifyContent: "space-between", color: "var(--on-tint-body)" }}
                          >
                            <span>
                              {data.kanjiKnown} of {entry.kanji} kanji known
                            </span>
                            <span>
                              {entry.lessons} lessons · {entry.words} words
                            </span>
                          </div>
                        </div>

                        <div className="row" style={{ gap: 12, flexWrap: "wrap" }}>
                          {resume && (
                            <Link href={`/lessons/${resume.slug}/study`} className="reset-link">
                              <Button variant="primary" size="md" icon="chevron-right">
                                {resume.status === "learning" ? "Continue" : "Start"} {resume.title}
                              </Button>
                            </Link>
                          )}
                          <Link href="/lessons" className="reset-link">
                            <Button variant="outline" size="md">
                              All {entry.lessons} Lessons
                            </Button>
                          </Link>
                        </div>

                        {/* The lesson chain, so the shape of the level is visible
                            without leaving this page. */}
                        <div className="row" style={{ gap: 6, flexWrap: "wrap" }}>
                          {lessons.map((l) => (
                            <Link
                              key={l.slug}
                              href={`/lessons/${l.slug}`}
                              title={`${l.title} — ${l.kanjiKnown}/${l.kanji.length} known`}
                              className="reset-link jp"
                              style={{
                                display: "inline-flex",
                                gap: 2,
                                padding: "6px 8px",
                                borderRadius: "var(--radius-sm)",
                                background:
                                  l.status === "completed"
                                    ? "var(--accent)"
                                    : l.status === "learning"
                                      ? "var(--surface-chip)"
                                      : "var(--meter-track-on-tint)",
                                color:
                                  l.status === "completed"
                                    ? "var(--text-on-accent)"
                                    : "var(--on-tint-heading)",
                                fontSize: 15,
                                lineHeight: 1,
                              }}
                            >
                              {l.kanji.join("")}
                            </Link>
                          ))}
                        </div>
                      </>
                    ) : (
                      <p className="body-sm muted" style={{ margin: 0 }}>
                        Roughly {entry.cumulativeKanji.toLocaleString()} characters in total by the
                        end of this level. Adding it means dropping a data directory beside{" "}
                        <code style={{ fontFamily: "var(--font-mono)" }}>data/jlpt/n5</code> — the
                        app needs no schema change.
                      </p>
                    )}
                  </div>
                </Card>
              </div>
            </li>
          );
        })}
      </ol>

      <Card tone="forest" pad="lg" radius="lg">
        <div className="stack" style={{ gap: 14 }}>
          <div className="row" style={{ gap: 10 }}>
            <Sparkle size={16} color="var(--lime-500)" />
            <span className="eyebrow" style={{ color: "var(--lime-500)" }}>
              On the estimates
            </span>
          </div>
          <p style={{ margin: 0, color: "var(--forest-200)", maxWidth: 620 }}>
            The JLPT has published no official kanji or vocabulary list since 2010. Every per-level
            count above except N5 is a community estimate and will vary by a few dozen characters
            depending on the source. N5 is exact, because it is built and counted from the files in
            this repository.
          </p>
        </div>
      </Card>
    </div>
  );
}
