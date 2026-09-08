"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Badge } from "@/components/atlas/core/Badge.jsx";
import { Button } from "@/components/atlas/core/Button.jsx";
import { Card } from "@/components/atlas/layout/Card.jsx";
import { Icon } from "@/components/atlas/core/Icon.jsx";
import { Sparkle } from "@/components/atlas/core/Sparkle.jsx";
import type { Kanji, Word } from "@/lib/content";
import {
  buildLessonQueue,
  buildReviewQueue,
  buildWritingQueue,
  PROMPT,
  type StudyCard,
} from "@/lib/study";
import { StrokeDiagram } from "./StrokeDiagram";
import { WritingPad } from "./WritingPad";

type Props = {
  mode: "lesson" | "review" | "writing";
  lessonSlug: string | null;
  lessonTitle: string;
  kanji: Kanji[];
  words: Word[];
  /** Wider candidate set for review distractors. */
  pool?: Word[];
  kanjiStages: Record<string, number>;
  wordStages: Record<string, number>;
  seed: number;
  /** Characters of this lesson already completed before this run. */
  cursorOffset?: number;
  lessonLength?: number;
};

/**
 * A failed write must never stall the queue, so this does not block. It must
 * not be silent either: dropping the error is what makes "my progress did not
 * save" impossible to notice until much later.
 */
function post(url: string, body: unknown, onFail?: (detail: string) => void) {
  void fetch(url, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
    keepalive: true,
  })
    .then(async (res) => {
      if (res.ok) return;
      const text = await res.text().catch(() => "");
      console.error(`[kanjikan] POST ${url} -> ${res.status} ${text}`);
      onFail?.(res.status === 401 ? "Your session expired. Sign in again." : "Could not reach the database.");
    })
    .catch((e) => {
      console.error(`[kanjikan] POST ${url} failed`, e);
      onFail?.("Could not reach the server.");
    });
}

export function StudySession({
  mode,
  lessonSlug,
  lessonTitle,
  kanji,
  words,
  pool,
  kanjiStages,
  wordStages,
  seed,
  cursorOffset = 0,
  lessonLength,
}: Props) {
  const router = useRouter();

  const queue = useMemo<StudyCard[]>(() => {
    if (mode === "lesson") return buildLessonQueue(kanji, words, kanjiStages, wordStages, seed);
    if (mode === "writing") return buildWritingQueue(kanji);
    return buildReviewQueue(words, wordStages, pool ?? words, seed);
  }, [mode, kanji, words, pool, kanjiStages, wordStages, seed]);

  const [index, setIndex] = useState(0);
  const [picked, setPicked] = useState<string | null>(null);
  const [answered, setAnswered] = useState(0);
  const [correctCount, setCorrectCount] = useState(0);
  const [done, setDone] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  const card = queue[index];
  const total = queue.length;
  const isLast = index === total - 1;

  const finish = useCallback(
    (right: number, asked: number) => {
      setDone(true);
      if (asked > 0) post("/api/session", { mode, lessonSlug, total: asked, correct: right }, setSaveError);
      if (lessonSlug) {
        post(
          "/api/checkpoint",
          { lessonSlug, cursor: lessonLength ?? cursorOffset + kanji.length, completed: true },
          setSaveError,
        );
      }
      router.refresh();
    },
    [mode, lessonSlug, kanji.length, cursorOffset, lessonLength, router],
  );

  const advance = useCallback(() => {
    if (isLast) {
      finish(correctCount, answered);
      return;
    }
    setPicked(null);
    setIndex((i) => {
      const next = i + 1;
      // A character's cycle ends on its writing card, which is the only safe
      // place to resume from — mid-cycle would re-teach words already seen.
      if (lessonSlug && queue[i]?.kind === "kanji-write") {
        const doneChars = queue.slice(0, next).filter((c) => c.kind === "kanji-write").length;
        post(
          "/api/checkpoint",
          { lessonSlug, cursor: cursorOffset + doneChars, completed: false },
          setSaveError,
        );
      }
      return next;
    });
  }, [isLast, finish, correctCount, answered, lessonSlug, queue, cursorOffset]);

  /** Records one graded answer against a word or a character. */
  const grade = useCallback(
    (right: boolean) => {
      if (!card) return;
      setAnswered((n) => n + 1);
      if (right) setCorrectCount((n) => n + 1);

      if (card.kind === "kanji-write") {
        post("/api/kanji", { char: card.kanji.char, correct: right, skill: "writing" }, setSaveError);
      } else if (card.kind === "kanji-meaning") {
        post("/api/kanji", { char: card.kanji.char, correct: right, skill: "recognition" }, setSaveError);
      } else if ("word" in card) {
        post("/api/answer", { wordId: card.word.id, correct: right }, setSaveError);
      }
    },
    [card],
  );

  const choose = useCallback(
    (choiceId: string) => {
      if (picked || !card || !("choices" in card)) return;
      setPicked(choiceId);
      grade(choiceId === card.answerId);
    },
    [picked, card, grade],
  );

  const gradeWriting = useCallback(
    (right: boolean) => {
      grade(right);
      advance();
    },
    [grade, advance],
  );

  // Number keys pick an option, Enter or Space moves on. Study screens live or
  // die on not needing the mouse. The writing pad is exempt: it wants the
  // pointer, and Space there would skip past the character being drawn.
  useEffect(() => {
    if (done || !card || card.kind === "kanji-write") return;
    function onKey(e: KeyboardEvent) {
      if (!card) return;
      const isQuiz = "choices" in card;
      if (!isQuiz || picked) {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          advance();
        }
        return;
      }
      const n = Number(e.key);
      if (n >= 1 && n <= card.choices.length) {
        e.preventDefault();
        choose(card.choices[n - 1].id);
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [card, picked, done, advance, choose]);

  if (done) {
    return (
      <div className="stack" style={{ gap: 20 }}>
        {saveError && <SaveWarning detail={saveError} />}
        <Summary correct={correctCount} total={answered} mode={mode} lessonTitle={lessonTitle} />
      </div>
    );
  }

  if (!card) {
    return (
      <Card tone="cream" pad="lg">
        <p style={{ margin: 0 }}>Nothing to study here right now.</p>
      </Card>
    );
  }

  const progress = Math.round((index / total) * 100);

  return (
    <div className="stack" style={{ gap: 28 }}>
      {saveError && <SaveWarning detail={saveError} />}

      <div className="stack" style={{ gap: 12 }}>
        <div className="row" style={{ justifyContent: "space-between", gap: 16 }}>
          <span className="eyebrow">
            {lessonTitle}
            {cursorOffset > 0 && ` · resumed at kanji ${cursorOffset + 1}`}
          </span>
          <span className="eyebrow" style={{ color: "var(--text-body)" }}>
            {index + 1} / {total}
          </span>
        </div>
        <div className="meter">
          <span style={{ width: `${progress}%` }} />
        </div>
      </div>

      {card.kind === "kanji-teach" && <KanjiTeachCard kanji={card.kanji} onNext={advance} />}
      {card.kind === "word-teach" && <WordTeachCard word={card.word} onNext={advance} />}
      {card.kind === "kanji-write" && (
        <Card tone="white" pad="lg" elevation="md" radius="lg">
          <WritingPad
            key={card.kanji.char}
            char={card.kanji.char}
            paths={card.kanji.strokePaths}
            meaning={card.kanji.meanings.join(", ")}
            expectedStrokes={card.kanji.strokes}
            onGrade={gradeWriting}
          />
        </Card>
      )}
      {"choices" in card && (
        <QuizCard card={card} picked={picked} onChoose={choose} onNext={advance} isLast={isLast} />
      )}
    </div>
  );
}

/* -------------------------------------------------------------------------- */

function SaveWarning({ detail }: { detail: string }) {
  return (
    <div
      role="alert"
      className="row"
      style={{
        gap: 12,
        padding: "12px 16px",
        borderRadius: "var(--radius-input)",
        background: "var(--negative-100)",
        color: "var(--negative-600)",
        fontSize: "var(--text-body-sm)",
        lineHeight: "var(--leading-body-tight)",
      }}
    >
      <Icon name="circle" size={16} color="var(--negative-600)" />
      <span>
        <strong>Progress is not being saved.</strong> {detail} You can keep going, but this session
        will not be recorded.
      </span>
    </div>
  );
}

function KanjiTeachCard({ kanji, onNext }: { kanji: Kanji; onNext: () => void }) {
  return (
    <Card tone="white" pad="lg" elevation="md" radius="lg">
      <div className="stack" style={{ gap: 24 }}>
        <div className="row" style={{ gap: 10 }}>
          <Sparkle size={16} color="var(--accent)" />
          <span className="eyebrow" style={{ color: "var(--text-brand)" }}>
            New kanji
          </span>
        </div>

        <div className="row" style={{ gap: 28, flexWrap: "wrap", alignItems: "flex-start" }}>
          <StrokeDiagram
            char={kanji.char}
            paths={kanji.strokePaths}
            size={200}
            mode="animate"
          />

          <div className="stack" style={{ gap: 16, flex: 1, minWidth: 200 }}>
            <div style={{ fontSize: "var(--text-heading-1)", color: "var(--text-heading)", lineHeight: 1.2 }}>
              {kanji.meanings.join(", ")}
            </div>

            <div className="stack" style={{ gap: 10 }}>
              {[
                ["On", kanji.onyomi],
                ["Kun", kanji.kunyomi],
              ].map(([label, readings]) => (
                <div key={label as string} className="row" style={{ gap: 14, alignItems: "baseline" }}>
                  <span className="eyebrow" style={{ width: 34 }}>
                    {label as string}
                  </span>
                  <span className="jp" style={{ color: "var(--text-heading)" }}>
                    {(readings as string[]).length ? (readings as string[]).join("・") : "—"}
                  </span>
                </div>
              ))}
            </div>

            <div className="row" style={{ gap: 8, flexWrap: "wrap" }}>
              <Badge tone="sage">{kanji.strokes} strokes</Badge>
              {kanji.radical && <Badge tone="cream">radical {kanji.radical}</Badge>}
            </div>
          </div>
        </div>

        <Button variant="primary" size="lg" fullWidth onClick={onNext} icon="chevron-right">
          Got It
        </Button>
      </div>
    </Card>
  );
}

function WordTeachCard({ word, onNext }: { word: Word; onNext: () => void }) {
  return (
    <Card tone="white" pad="lg" elevation="md" radius="lg">
      <div className="stack" style={{ gap: 22 }}>
        <span className="eyebrow">
          {word.teaches} in a word
        </span>

        <div className="stack" style={{ gap: 8 }}>
          <div className="jp-display" style={{ fontSize: "clamp(40px, 13vw, 56px)" }}>
            {word.word}
          </div>
          {word.reading !== word.word && (
            <div className="jp" style={{ fontSize: 20, color: "var(--text-muted)" }}>
              {word.reading}
            </div>
          )}
        </div>

        <div style={{ height: 1, background: "var(--border-subtle)" }} />

        <div className="stack" style={{ gap: 12 }}>
          <div style={{ fontSize: "var(--text-heading-3)", color: "var(--text-heading)" }}>
            {word.meanings.join(", ")}
          </div>
          <div className="row" style={{ gap: 8, flexWrap: "wrap" }}>
            <Badge tone="sage">{word.pos}</Badge>
          </div>
        </div>

        <Button variant="primary" size="lg" fullWidth onClick={onNext} icon="chevron-right">
          Got It
        </Button>
      </div>
    </Card>
  );
}

function QuizCard({
  card,
  picked,
  onChoose,
  onNext,
  isLast,
}: {
  card: Extract<StudyCard, { choices: unknown }>;
  picked: string | null;
  onChoose: (id: string) => void;
  onNext: () => void;
  isLast: boolean;
}) {
  const wasRight = picked === card.answerId;
  const isKanji = card.kind === "kanji-meaning";

  const prompt = isKanji
    ? card.kanji.char
    : card.kind === "word-recall"
      ? card.word.meanings.join(", ")
      : card.word.word;
  const promptIsJapanese = isKanji || card.kind !== "word-recall";
  const sub =
    !isKanji && card.kind === "word-meaning" && card.word.reading !== card.word.word
      ? card.word.reading
      : null;

  // Options are Japanese except when the answer is an English gloss.
  const optionsAreJapanese = card.kind === "word-reading" || card.kind === "word-recall";

  return (
    <div className="stack" style={{ gap: 20 }}>
      <Card tone="cream" pad="lg" radius="lg">
        <div className="stack" style={{ gap: 16, alignItems: "center", textAlign: "center" }}>
          <span className="eyebrow">{PROMPT[card.kind]}</span>
          <div
            className={promptIsJapanese ? "jp-display" : undefined}
            style={{
              fontSize: isKanji
                ? "clamp(64px, 22vw, 96px)"
                : promptIsJapanese
                  ? "clamp(38px, 13vw, 56px)"
                  : "var(--text-display-4)",
              letterSpacing: promptIsJapanese ? 0 : "var(--tracking-display)",
              lineHeight: 1.15,
              color: "var(--on-tint-heading)",
            }}
          >
            {prompt}
          </div>
          {sub && (
            <div className="jp" style={{ fontSize: 18, color: "var(--on-tint-body)" }}>
              {sub}
            </div>
          )}
        </div>
      </Card>

      <div className="stack" style={{ gap: 10 }}>
        {card.choices.map((choice, i) => {
          const isAnswer = choice.id === card.answerId;
          const isPicked = choice.id === picked;

          let background = "var(--surface-card)";
          let borderColor = "var(--border-default)";
          let color = "var(--text-heading)";

          if (picked) {
            if (isAnswer) {
              background = "var(--surface-accent)";
              borderColor = "var(--surface-accent)";
              color = "var(--text-on-accent)";
            } else if (isPicked) {
              background = "var(--negative-100)";
              borderColor = "var(--negative-500)";
              color = "var(--negative-600)";
            } else {
              color = "var(--text-muted)";
            }
          }

          return (
            <button
              key={choice.id}
              type="button"
              onClick={() => onChoose(choice.id)}
              disabled={Boolean(picked)}
              className={optionsAreJapanese ? "jp" : undefined}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 14,
                width: "100%",
                minHeight: 60,
                padding: "14px 18px",
                textAlign: "left",
                background,
                border: `1px solid ${borderColor}`,
                borderRadius: "var(--radius-input)",
                color,
                fontFamily: optionsAreJapanese ? "var(--font-jp)" : "var(--font-text)",
                fontSize: optionsAreJapanese ? 20 : "var(--text-body-md)",
                fontWeight: "var(--weight-semibold)",
                cursor: picked ? "default" : "pointer",
                transition: "var(--transition-control)",
              }}
            >
              <span
                aria-hidden
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  justifyContent: "center",
                  flex: "0 0 auto",
                  width: 26,
                  height: 26,
                  borderRadius: "var(--radius-full)",
                  background: picked && isAnswer ? "var(--forest-800)" : "var(--surface-sunken)",
                  color: picked && isAnswer ? "var(--lime-500)" : "var(--text-muted)",
                  fontFamily: "var(--font-mono)",
                  fontSize: 12,
                }}
              >
                {i + 1}
              </span>
              {choice.label}
            </button>
          );
        })}
      </div>

      {picked && (
        <Card tone={wasRight ? "accent" : "white"} pad="md" radius="md" bordered={!wasRight}>
          <div className="row" style={{ justifyContent: "space-between", gap: 16, flexWrap: "wrap" }}>
            <div className="row" style={{ gap: 12 }}>
              <Icon
                name={wasRight ? "check" : "arrow-up-right"}
                size={20}
                color={wasRight ? "var(--text-on-accent)" : "var(--negative-600)"}
              />
              <div>
                <div
                  style={{
                    fontWeight: "var(--weight-semibold)",
                    color: wasRight ? "var(--text-on-accent)" : "var(--text-heading)",
                  }}
                >
                  {wasRight ? "Correct" : "Not quite"}
                </div>
                <div className="body-sm" style={{ color: wasRight ? "var(--forest-700)" : "var(--text-body)" }}>
                  {isKanji ? (
                    <>
                      <span className="jp">{card.kanji.char}</span>
                      {" — "}
                      {card.kanji.meanings.join(", ")}
                    </>
                  ) : (
                    <>
                      <span className="jp">{card.word.word}</span>
                      {card.word.reading !== card.word.word && (
                        <span className="jp"> ({card.word.reading})</span>
                      )}
                      {" — "}
                      {card.word.meanings.join(", ")}
                    </>
                  )}
                </div>
              </div>
            </div>
            <Button variant="primary" size="md" onClick={onNext} icon="chevron-right" autoFocus>
              {isLast ? "Finish" : "Next"}
            </Button>
          </div>
        </Card>
      )}
    </div>
  );
}

function Summary({
  correct,
  total,
  mode,
  lessonTitle,
}: {
  correct: number;
  total: number;
  mode: "lesson" | "review" | "writing";
  lessonTitle: string;
}) {
  const percent = total ? Math.round((correct / total) * 100) : 0;

  return (
    <Card tone="forest" pad="lg" radius="lg">
      <div className="stack" style={{ gap: 28 }}>
        <div className="row" style={{ gap: 10 }}>
          <Sparkle size={18} color="var(--lime-500)" />
          <span className="eyebrow" style={{ color: "var(--lime-500)" }}>
            Session complete
          </span>
        </div>

        <h2
          style={{
            margin: 0,
            fontSize: "var(--text-display-4)",
            letterSpacing: "var(--tracking-display)",
            lineHeight: "var(--leading-display)",
            color: "var(--white)",
          }}
        >
          {lessonTitle}
        </h2>

        <div className="row" style={{ gap: 48, flexWrap: "wrap" }}>
          {[
            [`${percent}%`, "Accuracy", "var(--lime-500)"],
            [`${correct}/${total}`, "Answered", "var(--white)"],
          ].map(([value, label, colour]) => (
            <div key={label}>
              <div
                style={{
                  fontSize: "var(--text-stat-lg)",
                  fontWeight: "var(--weight-extrabold)",
                  letterSpacing: "var(--tracking-stat)",
                  color: colour,
                  lineHeight: 1,
                }}
              >
                {value}
              </div>
              <div className="eyebrow" style={{ color: "var(--forest-200)", marginTop: 8 }}>
                {label}
              </div>
            </div>
          ))}
        </div>

        <p style={{ margin: 0, color: "var(--forest-200)", maxWidth: 460 }}>
          Everything you answered is scheduled. What you missed comes back within minutes; what you
          knew moves further out.
        </p>

        <div className="row" style={{ gap: 12, flexWrap: "wrap" }}>
          <Link href="/dashboard" className="reset-link">
            <Button variant="accent" size="lg" icon="chevron-right">
              Back to Dashboard
            </Button>
          </Link>
          <Link href={mode === "review" ? "/lessons" : "/review"} className="reset-link">
            <Button variant="outline-inverse" size="lg">
              {mode === "review" ? "Browse Lessons" : "Start a Review"}
            </Button>
          </Link>
        </div>
      </div>
    </Card>
  );
}
