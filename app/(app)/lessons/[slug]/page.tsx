import Link from "next/link";
import { notFound } from "next/navigation";
import { getLesson, getKanji } from "@/lib/content";
import { getWordProgress, getLessonProgress } from "@/lib/progress";
import { bandFor, BAND_LABEL, type MasteryBand } from "@/lib/srs";
import { Badge } from "@/components/atlas/core/Badge.jsx";
import { Button } from "@/components/atlas/core/Button.jsx";
import { Card } from "@/components/atlas/layout/Card.jsx";

export const dynamic = "force-dynamic";

export function generateMetadata({ params }: { params: { slug: string } }) {
  const lesson = getLesson(params.slug);
  return { title: lesson ? `${lesson.title} — Kanjikan` : "Lesson — Kanjikan" };
}

const BAND_TONE: Record<MasteryBand, "sage" | "soft" | "accent" | "forest"> = {
  new: "sage",
  learning: "soft",
  known: "accent",
  mastered: "forest",
};

export default async function LessonPage({ params }: { params: { slug: string } }) {
  const lesson = getLesson(params.slug);
  if (!lesson) notFound();

  const [progress, lessonRows] = await Promise.all([getWordProgress(), getLessonProgress()]);
  const row = lessonRows.get(lesson.slug);

  const known = lesson.words.filter((w) => (progress.get(w.id)?.srs_stage ?? 0) >= 5).length;
  const started = lesson.words.filter((w) => progress.has(w.id)).length;
  const percent = Math.round((known / lesson.words.length) * 100);

  // Every kanji in the lesson, split by whether kanji.json has data for it.
  // N5 vocabulary routinely uses characters from higher levels — 大丈夫 is an
  // N5 word, but 丈 and 夫 are not N5 kanji — so showing only the studied set
  // would silently hide most of what the learner is actually looking at.
  const kanjiData = new Map(getKanji().map((k) => [k.char, k]));
  const studiedKanji = [...new Set(lesson.words.flatMap((w) => w.levelKanji))];
  const otherKanji = [...new Set(lesson.words.flatMap((w) => w.kanji))].filter(
    (c) => !kanjiData.has(c),
  );

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
              {started === 0 ? "Start Lesson" : started < lesson.words.length ? "Continue Lesson" : "Practise Again"}
            </Button>
          </Link>
        </div>
      </header>

      <Card tone="cream" pad="md" radius="lg">
        <div className="stack" style={{ gap: 14 }}>
          <div className="row" style={{ justifyContent: "space-between", gap: 16, flexWrap: "wrap" }}>
            <span className="eyebrow" style={{ color: "var(--on-tint-body)" }}>
              {known} of {lesson.words.length} known
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

      {(studiedKanji.length > 0 || otherKanji.length > 0) && (
        <section className="stack" style={{ gap: 20 }}>
          <div>
            <p className="eyebrow">Kanji in this lesson</p>
            <h2 style={{ margin: "8px 0 0", fontSize: "var(--text-heading-2)" }}>
              {studiedKanji.length + otherKanji.length} characters you will meet
            </h2>
          </div>

          {studiedKanji.length > 0 && (
            <div className="stack" style={{ gap: 12 }}>
              <p className="eyebrow" style={{ color: "var(--on-tint-body)" }}>
                On the N5 list · {studiedKanji.length}
              </p>
              <div className="row" style={{ gap: 10, flexWrap: "wrap" }}>
                {studiedKanji.map((char) => {
                  const k = kanjiData.get(char);
                  return (
                    <Card key={char} tone="sage" pad="none" radius="md" style={{ padding: "14px 16px" }}>
                      <div className="row" style={{ gap: 12 }}>
                        <span className="jp" style={{ fontSize: 28, color: "var(--on-tint-heading)" }}>
                          {char}
                        </span>
                        <div>
                          <div
                            className="body-sm"
                            style={{ fontWeight: "var(--weight-semibold)", color: "var(--on-tint-heading)" }}
                          >
                            {k?.meanings.slice(0, 2).join(", ")}
                          </div>
                          <div className="jp body-sm" style={{ color: "var(--on-tint-body)" }}>
                            {[...(k?.onyomi ?? []), ...(k?.kunyomi ?? [])].slice(0, 3).join("・")}
                          </div>
                        </div>
                      </div>
                    </Card>
                  );
                })}
              </div>
            </div>
          )}

          {otherKanji.length > 0 && (
            <div className="stack" style={{ gap: 12 }}>
              <p className="eyebrow" style={{ color: "var(--text-muted)" }}>
                Beyond the N5 list · {otherKanji.length}
              </p>
              <div className="row" style={{ gap: 8, flexWrap: "wrap" }}>
                {otherKanji.map((char) => (
                  <span
                    key={char}
                    className="jp"
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      justifyContent: "center",
                      width: 46,
                      height: 46,
                      borderRadius: "var(--radius-sm)",
                      border: "1px solid var(--border-subtle)",
                      color: "var(--text-body)",
                      fontSize: 24,
                    }}
                  >
                    {char}
                  </span>
                ))}
              </div>
              <p className="body-sm muted" style={{ margin: 0, maxWidth: 560 }}>
                These appear in this lesson but are not N5 kanji, so no readings ship for them.
                Learn the word as a whole — that is the point of studying vocabulary first.
              </p>
            </div>
          )}
        </section>
      )}

      <section className="stack" style={{ gap: 20 }}>
        <div>
          <p className="eyebrow">Word list</p>
          <h2 style={{ margin: "8px 0 0", fontSize: "var(--text-heading-2)" }}>
            {lesson.words.length} words
          </h2>
        </div>

        <Card tone="white" pad="none" radius="lg" bordered>
          {lesson.words.map((word, i) => {
            const band = bandFor(progress.get(word.id)?.srs_stage);
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
                    style={{
                      fontFamily: "var(--font-mono)",
                      fontSize: "var(--text-body-xs)",
                      color: "var(--text-muted)",
                      width: 24,
                      flex: "0 0 auto",
                    }}
                  >
                    {String(i + 1).padStart(2, "0")}
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
