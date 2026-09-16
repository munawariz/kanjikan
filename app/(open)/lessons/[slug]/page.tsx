import Link from "next/link";
import { notFound } from "next/navigation";
import { getLesson, strokeViewBox } from "@/lib/content";
import { getUser } from "@/lib/auth";
import {
  getKanjiReadings,
  getProfile,
  getProgress,
  studiesWriting,
  wordMarkState,
  writingMarkState,
} from "@/lib/progress";
import { bandFor, KNOWN_STAGE, type MasteryBand } from "@/lib/srs";
import { getLocale, getT } from "@/lib/i18n/server";
import { Badge } from "@/components/atlas/core/Badge.jsx";
import { Button } from "@/components/atlas/core/Button.jsx";
import { Card } from "@/components/atlas/layout/Card.jsx";
import { StrokeDiagram } from "@/components/app/StrokeDiagram";
import { KanjiAnatomy } from "@/components/app/KanjiAnatomy";
import { MarkControl } from "@/components/app/MarkControl";

export const dynamic = "force-dynamic";

const BAND_TONE: Record<MasteryBand, "sage" | "soft" | "accent" | "forest"> = {
  new: "sage",
  learning: "soft",
  known: "accent",
  mastered: "forest",
};

export default async function LessonPage({ params }: { params: { slug: string } }) {
  const lesson = getLesson(params.slug, await getLocale());
  if (!lesson) notFound();

  const user = await getUser();
  const t = await getT();
  const tl = t.lessons;
  const [{ words: wordRows, kanji: kanjiRows, lessons: lessonRows }, profile] = await Promise.all([
    getProgress(user),
    user ? getProfile(user.id) : null,
  ]);
  const row = lessonRows.get(lesson.slug);
  // Marking needs somewhere to save the mark, and the writing figures only
  // mean something to a learner who studies writing.
  const canMark = Boolean(user);
  const writing = Boolean(user) && studiesWriting(profile);

  const readings = getKanjiReadings(wordRows);
  const known = lesson.kanji.filter((k) => {
    const band = readings.get(k.char)?.band;
    return band === "known" || band === "mastered";
  }).length;
  const percent = Math.round((known / lesson.kanji.length) * 100);
  const started = row ? row.cursor > 0 : false;
  const chars = lesson.kanji.map((k) => k.char);

  return (
    <div className="stack" style={{ gap: 40 }}>
      <div>
        <Link href="/lessons" className="body-sm" style={{ textDecoration: "none" }}>
          {tl.allLessons}
        </Link>
      </div>

      <header className="stack" style={{ gap: 20 }}>
        <div className="row" style={{ gap: 12, flexWrap: "wrap" }}>
          <Badge tone="sage" uppercase>
            {tl.lessonBadge(lesson.level, String(lesson.order).padStart(2, "0"))}
          </Badge>
          {row?.status === "completed" && <Badge tone="accent">{tl.completed}</Badge>}
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
              {!started ? tl.start : row?.status === "completed" ? tl.again : tl.continue}
            </Button>
          </Link>
        </div>

        {canMark && (
          <div className="stack" style={{ gap: 8 }}>
            <p className="body-sm muted" style={{ margin: 0, maxWidth: 560 }}>
              {tl.markIntro}
            </p>
            <MarkControl
              scope="lesson"
              id={lesson.slug}
              skill="reading"
              state={wordMarkState(lesson.words, wordRows)}
              markLabel={tl.markLesson}
              markedLabel={tl.markLessonDone}
              title={tl.markLessonTitle}
            />
            {writing && (
              <MarkControl
                scope="lesson"
                id={lesson.slug}
                skill="writing"
                state={writingMarkState(chars, kanjiRows)}
                markLabel={tl.markLessonWriting}
                markedLabel={tl.writingMarked}
                title={tl.markLessonWritingTitle(chars.length)}
              />
            )}
          </div>
        )}
      </header>

      <Card tone="cream" pad="md" radius="lg">
        <div className="stack" style={{ gap: 14 }}>
          <div className="row" style={{ justifyContent: "space-between", gap: 16, flexWrap: "wrap" }}>
            <span className="eyebrow" style={{ color: "var(--on-tint-body)" }}>
              {tl.progress(known, lesson.kanji.length, lesson.words.length)}
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
          <p className="eyebrow">{tl.charactersEyebrow}</p>
          <h2 style={{ margin: "8px 0 0", fontSize: "var(--text-heading-1)" }}>
            {tl.charactersHeading(lesson.kanji.length, lesson.words.length)}
          </h2>
        </div>

        <div className="stack" style={{ gap: 16 }}>
          {lesson.kanji.map((k) => {
            const p = kanjiRows.get(k.char);
            const words = lesson.words.filter((w) => w.teaches === k.char);
            const reading = readings.get(k.char);
            const band = reading?.band ?? "new";
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
                      <Badge tone={BAND_TONE[band]}>{t.common.band[band]}</Badge>
                      {writing && (p?.writing_stage ?? 0) >= KNOWN_STAGE && <Badge tone="accent">{tl.canWrite}</Badge>}
                    </div>

                    <div className="row body-sm" style={{ gap: 18, flexWrap: "wrap" }}>
                      {user && reading && (
                        <span style={{ color: "var(--text-heading)" }}>
                          {tl.wordsKnown(reading.known, reading.total)}
                        </span>
                      )}
                      <span className="muted">{tl.strokes(k.strokes)}</span>
                      {k.radicalPart && (
                        <span className="muted">
                          {tl.radical} <span className="jp">{k.radicalPart.char}</span> {k.radicalPart.meaning}
                        </span>
                      )}
                      <span className="jp" style={{ color: "var(--text-body)" }}>
                        {[...k.onyomi, ...k.kunyomi].join("・")}
                      </span>
                    </div>

                    <KanjiAnatomy kanji={k} variant="compact" />

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

                    {canMark && (
                      <div className="row" style={{ gap: 8, flexWrap: "wrap" }}>
                        <MarkControl
                          scope="kanji"
                          id={k.char}
                          skill="reading"
                          state={wordMarkState(words, wordRows)}
                          markLabel={tl.markKanji(k.char)}
                          markedLabel={tl.markedKnown}
                          title={tl.markKanjiTitle(k.char)}
                        />
                        {writing && (
                          <MarkControl
                            scope="kanji"
                            id={k.char}
                            skill="writing"
                            state={writingMarkState([k.char], kanjiRows)}
                            markLabel={tl.markKanjiWriting(k.char)}
                            markedLabel={tl.writingMarked}
                          />
                        )}
                      </div>
                    )}
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
          <p className="eyebrow">{tl.wordListEyebrow}</p>
          <h2 style={{ margin: "8px 0 0", fontSize: "var(--text-heading-2)" }}>
            {tl.wordCount(lesson.words.length)}
          </h2>
        </div>

        <Card tone="white" pad="none" radius="lg" bordered>
          {lesson.words.map((word, i) => {
            const band = bandFor(wordRows.get(word.id)?.srs_stage);
            const marked = Boolean(wordRows.get(word.id)?.marked_at);
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
                    <div className="body-sm muted">{t.common.pos[word.pos] ?? word.pos}</div>
                  </div>
                </div>

                <div className="row" style={{ gap: 8, flexWrap: "wrap", justifyContent: "flex-end" }}>
                  {canMark && (
                    <MarkControl
                      scope="word"
                      id={word.id}
                      skill="reading"
                      state={wordMarkState([word], wordRows)}
                      markLabel={tl.markWord}
                    />
                  )}
                  <Badge tone={BAND_TONE[band]}>{marked ? tl.markedKnownBadge : t.common.band[band]}</Badge>
                </div>
              </div>
            );
          })}
        </Card>
      </section>
    </div>
  );
}
