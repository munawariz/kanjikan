import Link from "next/link";
import { notFound } from "next/navigation";
import { getLesson, strokeViewBox } from "@/lib/content";
import { getUser } from "@/lib/supabase/server";
import { getProgress } from "@/lib/progress";
import { bandFor, BAND_LABEL, KNOWN_STAGE, type MasteryBand } from "@/lib/srs";
import { Badge } from "@/components/atlas/core/Badge.jsx";
import { Button } from "@/components/atlas/core/Button.jsx";
import { Card } from "@/components/atlas/layout/Card.jsx";
import { StrokeDiagram } from "@/components/app/StrokeDiagram";

export const dynamic = "force-dynamic";

const BAND_TONE: Record<MasteryBand, "sage" | "soft" | "accent" | "forest"> = {
  new: "sage",
  learning: "soft",
  known: "accent",
  mastered: "forest",
};

export default async function LessonPage({ params }: { params: { slug: string } }) {
  const lesson = getLesson(params.slug);
  if (!lesson) notFound();

  const {
    words: wordRows,
    kanji: kanjiRows,
    lessons: lessonRows,
  } = await getProgress(await getUser());
  const row = lessonRows.get(lesson.slug);

  const known = lesson.kanji.filter(
    (k) => (kanjiRows.get(k.char)?.recognition_stage ?? 0) >= KNOWN_STAGE,
  ).length;
  const percent = Math.round((known / lesson.kanji.length) * 100);
  const started = row ? row.cursor > 0 : false;

  return (
    <div className="stack" style={{ gap: 40 }}>
      <div>
        <Link href="/lessons" className="body-sm" style={{ textDecoration: "none" }}>
          ← All lessons
        </Link>
      </div>

      <header className="stack" style={{ gap: 20 }}>
        <div className="row" style={{ gap: 12, flexWrap: "wrap" }}>
          <Badge tone="sage" uppercase>
            Lesson {String(lesson.order).padStart(2, "0")}
          </Badge>
          {row?.status === "completed" && <Badge tone="accent">Completed</Badge>}
        </div>

        <h1
          style={{
            margin: 0,
            fontSize: "var(--text-display-3)",
            letterSpacing: "var(--tracking-display)",
            lineHeight: "var(--leading-display)",
            maxWidth: 760,
          }}
        >
          {lesson.title}
        </h1>

        <p style={{ margin: 0, maxWidth: 620 }}>{lesson.summary}</p>

        <div className="row" style={{ gap: 12, flexWrap: "wrap", marginTop: 8 }}>
          <Link href={`/lessons/${lesson.slug}/study`} className="reset-link">
            <Button variant="primary" size="lg" icon="chevron-right">
              {!started ? "Start Lesson" : row?.status === "completed" ? "Practise Again" : "Continue Lesson"}
            </Button>
          </Link>
        </div>
      </header>

      <Card tone="cream" pad="md" radius="lg">
        <div className="stack" style={{ gap: 14 }}>
          <div className="row" style={{ justifyContent: "space-between", gap: 16, flexWrap: "wrap" }}>
            <span className="eyebrow" style={{ color: "var(--on-tint-body)" }}>
              {known} of {lesson.kanji.length} kanji known · {lesson.words.length} words
            </span>
            <span
              style={{
                fontFamily: "var(--font-mono)",
                fontSize: "var(--text-body-sm)",
                color: "var(--on-tint-heading)",
              }}
            >
              {percent}%
            </span>
          </div>
          <div className="meter on-tint">
            <span style={{ width: `${percent}%` }} />
          </div>
        </div>
      </Card>

      {/* ---- The characters ------------------------------------------------ */}
      <section className="stack" style={{ gap: 24 }}>
        <div>
          <p className="eyebrow">The characters</p>
          <h2 style={{ margin: "8px 0 0", fontSize: "var(--text-heading-1)" }}>
            {lesson.kanji.length} kanji, {lesson.words.length} words to fix them
          </h2>
        </div>

        <div className="stack" style={{ gap: 16 }}>
          {lesson.kanji.map((k) => {
            const p = kanjiRows.get(k.char);
            const words = lesson.words.filter((w) => w.teaches === k.char);
            return (
              <Card key={k.char} tone="white" pad="md" radius="lg" bordered>
                <div className="row" style={{ gap: 24, alignItems: "flex-start", flexWrap: "wrap" }}>
                  <StrokeDiagram
                    char={k.char}
                    paths={k.strokePaths}
                    viewBox={strokeViewBox()}
                    size={120}
                  />

                  <div className="stack" style={{ gap: 12, flex: 1, minWidth: 220 }}>
                    <div className="row" style={{ gap: 12, flexWrap: "wrap", alignItems: "baseline" }}>
                      <span style={{ fontSize: "var(--text-heading-3)", color: "var(--text-heading)" }}>
                        {k.meanings.join(", ")}
                      </span>
                      <Badge tone={BAND_TONE[bandFor(p?.recognition_stage)]}>
                        {BAND_LABEL[bandFor(p?.recognition_stage)]}
                      </Badge>
                      {(p?.writing_stage ?? 0) >= KNOWN_STAGE && <Badge tone="accent">Can write</Badge>}
                    </div>

                    <div className="row body-sm" style={{ gap: 18, flexWrap: "wrap" }}>
                      <span className="muted">{k.strokes} strokes</span>
                      {k.radical && <span className="muted">radical {k.radical}</span>}
                      <span className="jp" style={{ color: "var(--text-body)" }}>
                        {[...k.onyomi, ...k.kunyomi].join("・")}
                      </span>
                    </div>

                    <div className="row" style={{ gap: 8, flexWrap: "wrap", marginTop: 4 }}>
                      {words.map((w) => (
                        <span
                          key={w.id}
                          className="jp"
                          title={w.meanings.join(", ")}
                          style={{
                            padding: "6px 12px",
                            borderRadius: "var(--radius-full)",
                            background: "var(--surface-sunken)",
                            color: "var(--text-heading)",
                            fontSize: 15,
                          }}
                        >
                          {w.word}
                          <span style={{ color: "var(--text-muted)", marginLeft: 6, fontSize: 13 }}>
                            {w.reading}
                          </span>
                        </span>
                      ))}
                    </div>
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      </section>

      {/* ---- Full word list ------------------------------------------------ */}
      <section className="stack" style={{ gap: 20 }}>
        <div>
          <p className="eyebrow">Word list</p>
          <h2 style={{ margin: "8px 0 0", fontSize: "var(--text-heading-2)" }}>
            {lesson.words.length} words
          </h2>
        </div>

        <Card tone="white" pad="none" radius="lg" bordered>
          {lesson.words.map((word, i) => {
            const band = bandFor(wordRows.get(word.id)?.srs_stage);
            return (
              <div
                key={word.id}
                className="row"
                style={{
                  gap: 20,
                  padding: "16px 24px",
                  borderTop: i === 0 ? "none" : "1px solid var(--border-subtle)",
                  justifyContent: "space-between",
                  flexWrap: "wrap",
                }}
              >
                <div className="row" style={{ gap: 20, minWidth: 0, flex: 1 }}>
                  <span
                    className="jp"
                    style={{
                      width: 28,
                      flex: "0 0 auto",
                      fontSize: 20,
                      color: "var(--text-muted)",
                    }}
                  >
                    {word.teaches}
                  </span>

                  <div style={{ minWidth: 130 }}>
                    <div className="jp" style={{ fontSize: 22, color: "var(--text-heading)" }}>
                      {word.word}
                    </div>
                    {word.reading !== word.word && (
                      <div className="jp body-sm" style={{ color: "var(--text-muted)" }}>
                        {word.reading}
                      </div>
                    )}
                  </div>

                  <div style={{ minWidth: 0, flex: 1 }}>
                    <div style={{ color: "var(--text-heading)" }}>{word.meanings.join(", ")}</div>
                    <div className="body-sm muted">{word.pos}</div>
                  </div>
                </div>

                <Badge tone={BAND_TONE[band]}>{BAND_LABEL[band]}</Badge>
              </div>
            );
          })}
        </Card>
      </section>
    </div>
  );
}
