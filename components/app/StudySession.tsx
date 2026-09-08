"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Badge } from "@/components/atlas/core/Badge.jsx";
import { Button } from "@/components/atlas/core/Button.jsx";
import { Card } from "@/components/atlas/layout/Card.jsx";
import { Icon } from "@/components/atlas/core/Icon.jsx";
import { Sparkle } from "@/components/atlas/core/Sparkle.jsx";
import type { Word } from "@/lib/content";
import { buildLessonQueue, buildReviewQueue, PROMPT, type StudyCard } from "@/lib/study";

type Props = {
  mode: "lesson" | "review";
  lessonSlug: string | null;
  lessonTitle: string;
  words: Word[];
  /** Wider candidate set for review distractors. */
  pool?: Word[];
  stages: Record<string, number>;
  seed: number;
  /** How many of the lesson's words were already covered before this run. */
  cursorOffset?: number;
  /** Full lesson length, which may be longer than `words` when resuming. */
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
  words,
  pool,
  stages,
  seed,
  cursorOffset = 0,
  lessonLength,
}: Props) {
  const router = useRouter();

  const queue = useMemo<StudyCard[]>(
    () =>
      mode === "lesson"
        ? buildLessonQueue(words, stages, seed)
        : buildReviewQueue(words, stages, pool ?? words, seed),
    [mode, words, pool, stages, seed],
  );

  const [index, setIndex] = useState(0);
  const [picked, setPicked] = useState<string | null>(null);
  const [answered, setAnswered] = useState(0);
  const [correctCount, setCorrectCount] = useState(0);
  const [done, setDone] = useState(false);
  // Set when any write fails, so the learner is told their answers are not
  // being stored rather than discovering it on the dashboard later.
  const [saveError, setSaveError] = useState<string | null>(null);

  const card = queue[index];
  const total = queue.length;
  const isLast = index === total - 1;

  const finish = useCallback(
    (right: number, asked: number) => {
      setDone(true);
      if (asked > 0) {
        post("/api/session", { mode, lessonSlug, total: asked, correct: right }, setSaveError);
      }
      if (lessonSlug) {
        post(
          "/api/checkpoint",
          { lessonSlug, cursor: lessonLength ?? cursorOffset + words.length, completed: true },
          setSaveError,
        );
      }
      router.refresh();
    },
    [mode, lessonSlug, words.length, cursorOffset, lessonLength, router],
  );

  const advance = useCallback(() => {
    if (isLast) {
      finish(correctCount, answered);
      return;
    }
    setPicked(null);
    setIndex((i) => {
      const next = i + 1;
      // Checkpoint on the way past every fifth card, matching the teach/quiz
      // chunk size, so a resumed lesson restarts at a group boundary.
      if (lessonSlug && next % 5 === 0) {
        // Count words fully dealt with, not cards shown, and add back the
        // words this run started from so a second resume does not rewind.
        const seen = new Set(queue.slice(0, next).map((c) => c.word.id)).size;
        post(
          "/api/checkpoint",
          { lessonSlug, cursor: cursorOffset + seen, completed: false },
          setSaveError,
        );
      }
      return next;
    });
  }, [isLast, finish, correctCount, answered, lessonSlug, queue, cursorOffset]);

  const choose = useCallback(
    (choiceId: string) => {
      if (picked || card?.kind === "teach") return;
      setPicked(choiceId);

      const right = choiceId === (card as Exclude<StudyCard, { kind: "teach" }>).answerId;
      setAnswered((n) => n + 1);
      if (right) setCorrectCount((n) => n + 1);
      post("/api/answer", { wordId: card.word.id, correct: right }, setSaveError);
    },
    [picked, card],
  );

  // Number keys pick an option, Enter or Space moves on. Study screens live or
  // die on not needing the mouse.
  useEffect(() => {
    if (done) return;
    function onKey(e: KeyboardEvent) {
      if (!card) return;
      if (card.kind === "teach") {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          advance();
        }
        return;
      }
      if (picked) {
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
            {cursorOffset > 0 && ` · resumed at word ${cursorOffset + 1}`}
          </span>
          <span className="eyebrow" style={{ color: "var(--text-body)" }}>
            {index + 1} / {total}
          </span>
        </div>
        <div className="meter">
          <span style={{ width: `${progress}%` }} />
        </div>
      </div>

      {card.kind === "teach" ? (
        <TeachCard card={card} onNext={advance} />
      ) : (
        <QuizCard card={card} picked={picked} onChoose={choose} onNext={advance} isLast={isLast} />
      )}
    </div>
  );
}

/* -------------------------------------------------------------------------- */

/**
 * Shown as soon as any write fails. Study continues — the queue still works
 * offline — but the learner is told plainly that nothing is being recorded,
 * rather than finding an empty dashboard afterwards.
 */
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

/**
 * Every kanji in the word. Only the ones on the level's studied list link to
 * the kanji screen — the rest have no entry there, so a link would dead-end.
 */
function KanjiChips({ word }: { word: Word }) {
  if (word.kanji.length === 0) return null;

  const box = {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    width: 44,
    height: 44,
    borderRadius: "var(--radius-sm)",
    fontSize: 22,
  } as const;

  return (
    <div className="row" style={{ gap: 8, flexWrap: "wrap" }}>
      {word.kanji.map((k) =>
        word.levelKanji.includes(k) ? (
          <Link
            key={k}
            href={`/kanji#${encodeURIComponent(k)}`}
            className="reset-link jp"
            style={{ ...box, background: "var(--surface-chip)", color: "var(--on-tint-heading)" }}
          >
            {k}
          </Link>
        ) : (
          <span
            key={k}
            className="jp"
            title="Not an N5 kanji"
            style={{ ...box, border: "1px solid var(--border-subtle)", color: "var(--text-muted)" }}
          >
            {k}
          </span>
        ),
      )}
    </div>
  );
}

function TeachCard({ card, onNext }: { card: Extract<StudyCard, { kind: "teach" }>; onNext: () => void }) {
  const { word } = card;
  return (
    <Card tone="white" pad="lg" elevation="md" radius="lg">
      <div className="stack" style={{ gap: 24 }}>
        <div className="row" style={{ gap: 10 }}>
          <Sparkle size={16} color="var(--lime-500)" />
          <span className="eyebrow" style={{ color: "var(--forest-800)" }}>
            New word
          </span>
        </div>

        <div className="stack" style={{ gap: 10 }}>
          <div className="jp-display" style={{ fontSize: 64 }}>
            {word.word}
          </div>
          {word.reading !== word.word && (
            <div className="jp" style={{ fontSize: 22, color: "var(--text-muted)" }}>
              {word.reading}
            </div>
          )}
        </div>

        <div style={{ height: 1, background: "var(--border-subtle)" }} />

        <div className="stack" style={{ gap: 14 }}>
          <div style={{ fontSize: "var(--text-heading-3)", color: "var(--text-heading)" }}>
            {word.meanings.join(", ")}
          </div>
          <div className="row" style={{ gap: 8, flexWrap: "wrap" }}>
            <Badge tone="sage">{word.pos}</Badge>
          </div>
        </div>

        <KanjiChips word={word} />

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
  card: Exclude<StudyCard, { kind: "teach" }>;
  picked: string | null;
  onChoose: (id: string) => void;
  onNext: () => void;
  isLast: boolean;
}) {
  const { word } = card;
  const wasRight = picked === card.answerId;

  // The prompt shows the side the question is not asking about: English for a
  // production card, the written form otherwise. A meaning card also shows the
  // reading, since that is not what is being tested.
  const prompt = card.kind === "recall" ? word.meanings.join(", ") : word.word;
  const promptIsJapanese = card.kind !== "recall";
  const sub = card.kind === "meaning" && word.reading !== word.word ? word.reading : null;

  return (
    <div className="stack" style={{ gap: 20 }}>
      <Card tone="cream" pad="lg" radius="lg">
        <div className="stack" style={{ gap: 16, alignItems: "center", textAlign: "center" }}>
          <span className="eyebrow">{PROMPT[card.kind]}</span>
          <div
            className={promptIsJapanese ? "jp-display" : undefined}
            style={{
              fontSize: promptIsJapanese ? 56 : "var(--text-display-4)",
              letterSpacing: promptIsJapanese ? 0 : "var(--tracking-display)",
              lineHeight: 1.15,
              color: "var(--text-heading)",
            }}
          >
            {prompt}
          </div>
          {sub && (
            <div className="jp" style={{ fontSize: 18, color: "var(--text-muted)" }}>
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
              background = "var(--lime-500)";
              borderColor = "var(--lime-500)";
              color = "var(--forest-800)";
            } else if (isPicked) {
              background = "var(--negative-100)";
              borderColor = "var(--negative-500)";
              color = "var(--negative-600)";
            } else {
              color = "var(--text-muted)";
            }
          }

          const japanese = card.kind !== "meaning";

          return (
            <button
              key={choice.id}
              type="button"
              onClick={() => onChoose(choice.id)}
              disabled={Boolean(picked)}
              className={japanese ? "jp" : undefined}
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
                fontFamily: japanese ? "var(--font-jp)" : "var(--font-text)",
                fontSize: japanese ? 20 : "var(--text-body-md)",
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
                color={wasRight ? "var(--forest-800)" : "var(--negative-600)"}
              />
              <div>
                <div
                  style={{
                    fontWeight: "var(--weight-semibold)",
                    color: wasRight ? "var(--forest-800)" : "var(--text-heading)",
                  }}
                >
                  {wasRight ? "Correct" : "Not quite"}
                </div>
                <div className="body-sm" style={{ color: wasRight ? "var(--forest-700)" : "var(--text-body)" }}>
                  <span className="jp">{word.word}</span>
                  {word.reading !== word.word && <span className="jp"> ({word.reading})</span>}
                  {" — "}
                  {word.meanings.join(", ")}
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
  mode: "lesson" | "review";
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
          <div>
            <div
              style={{
                fontSize: "var(--text-stat-lg)",
                fontWeight: "var(--weight-extrabold)",
                letterSpacing: "var(--tracking-stat)",
                color: "var(--lime-500)",
                lineHeight: 1,
              }}
            >
              {percent}%
            </div>
            <div className="eyebrow" style={{ color: "var(--forest-200)", marginTop: 8 }}>
              Accuracy
            </div>
          </div>
          <div>
            <div
              style={{
                fontSize: "var(--text-stat-lg)",
                fontWeight: "var(--weight-extrabold)",
                letterSpacing: "var(--tracking-stat)",
                color: "var(--white)",
                lineHeight: 1,
              }}
            >
              {correct}/{total}
            </div>
            <div className="eyebrow" style={{ color: "var(--forest-200)", marginTop: 8 }}>
              Answered
            </div>
          </div>
        </div>

        <p style={{ margin: 0, color: "var(--forest-200)", maxWidth: 460 }}>
          Everything you answered is scheduled. The words you missed come back within minutes; the
          ones you knew move further out.
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
