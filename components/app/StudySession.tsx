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
  buildPracticeQueue,
  buildReviewQueue,
  cardChar,
  type KanjiGloss,
  type PracticeType,
  type StudyCard,
} from "@/lib/study";
import { KanjiAnatomy } from "./KanjiAnatomy";
import { StrokeDiagram } from "./StrokeDiagram";
import { WritingPad } from "./WritingPad";
import { useT } from "@/lib/i18n/client";
import { isLocale } from "@/lib/i18n/config";
import { messages } from "@/lib/i18n/messages";

type Mode = "lesson" | "review" | "practice";

/**
 * The writing score below which practice will not take Next. Well under
 * the check's own pass mark, since the check can be wrong: this only stops a
 * scribble, or a blank pad, being counted as written.
 */
const PRACTICE_MIN_WRITING_SCORE = 35;

type Props = {
  /**
   * Practice runs over characters picked on the practice page, signed in or
   * not, and is never saved: it exists to drill a few characters without the
   * result moving them through the review schedule or counting towards what
   * the learner is shown to know.
   */
  mode: Mode;
  /** What a practice run drills. Ignored by every other mode. */
  practiceTypes?: PracticeType[];
  /**
   * Not signed in. The session runs exactly the same, but nothing is sent to
   * the server — every write would only come back 401 and raise the "not
   * being saved" alarm for something the guest already knows.
   */
  guest?: boolean;
  lessonSlug: string | null;
  lessonTitle: string;
  /** The characters in play. In a review, those whose writing is due. */
  kanji: Kanji[];
  words: Word[];
  /** Wider candidate set for review distractors. */
  pool?: Word[];
  /** Every character of the levels in play, for practice distractors. */
  kanjiPool?: KanjiGloss[];
  wordStages: Record<string, number>;
  /** Lesson only: characters met before, which skip their introduction. */
  seenKanji?: string[];
  /** Lesson only: words marked as already known, left out of the run. */
  markedWords?: string[];
  /** Lesson only: characters whose writing is marked as already known. */
  markedWriting?: string[];
  /** Lesson only: whether each character ends by being written. */
  writing?: boolean;
  /**
   * Lesson only: reviews waiting, when there are enough to suggest clearing
   * them first. Shown before the first card, never after: it is state here
   * rather than a page of its own so the refresh at the end of the lesson,
   * when more may have come due, cannot swap the summary for the warning.
   */
  reviewsWaiting?: number;
  seed: number;
  /** Characters of this lesson already completed before this run. */
  cursorOffset?: number;
  lessonLength?: number;
};

/**
 * A failed write must never stall the queue, so nothing waits on this. It must
 * not be silent either: dropping the error is what makes "my progress did not
 * save" impossible to notice until much later.
 *
 * Resolves to whether the write landed, for a caller that has to know when
 * every write is in. It never rejects.
 */
export function post(url: string, body: unknown, onFail?: (detail: string) => void): Promise<boolean> {
  // A plain function, not a hook, so the language comes from <html lang>.
  const lang = typeof document === "undefined" ? undefined : document.documentElement.lang;
  const t = messages[isLocale(lang) ? lang : "en"].study.save;
  return fetch(url, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
    keepalive: true,
  })
    .then(async (res) => {
      if (res.ok) return true;
      const text = await res.text().catch(() => "");
      console.error(`[kanjikan] POST ${url} -> ${res.status} ${text}`);
      onFail?.(res.status === 401 ? t.sessionExpired : t.database);
      return false;
    })
    .catch((e) => {
      console.error(`[kanjikan] POST ${url} failed`, e);
      onFail?.(t.network);
      return false;
    });
}

const FURIGANA_KEY = "kanjikan-furigana";
const HINTS_KEY = "kanjikan-writing-hints";

/** Words, and characters' reading, that the learner marked known mid-run. */
type Skipped = { words: ReadonlySet<string>; chars: ReadonlySet<string> };
const NOTHING_SKIPPED: Skipped = { words: new Set(), chars: new Set() };

/**
 * The queue less what has been marked known mid-run.
 *
 * A mark is only ever made on a teaching card, and everything it removes comes
 * after that card: a word's quizzes follow its introduction, and a character's
 * word cards and meaning quiz follow its own. So the card on screen and those
 * before it keep their positions, and the current index stays valid. Writing
 * cards are never removed here — reading and writing are marked separately.
 */
function withoutSkipped(queue: StudyCard[], skipped: Skipped): StudyCard[] {
  if (skipped.words.size === 0 && skipped.chars.size === 0) return queue;
  return queue.filter((c) => {
    if (c.kind === "kanji-teach" || c.kind === "kanji-write") return true;
    if (c.kind === "kanji-meaning") return !skipped.chars.has(c.kanji.char);
    if (skipped.chars.has(c.word.teaches)) return false;
    return c.kind === "word-teach" || !skipped.words.has(c.word.id);
  });
}

export function StudySession({
  mode,
  practiceTypes,
  guest = false,
  lessonSlug,
  lessonTitle,
  kanji,
  words,
  pool,
  kanjiPool,
  wordStages,
  seenKanji,
  markedWords,
  markedWriting,
  writing = true,
  reviewsWaiting,
  seed,
  cursorOffset = 0,
  lessonLength,
}: Props) {
  const router = useRouter();
  const t = useT();
  const practice = mode === "practice";
  const [started, setStarted] = useState(!reviewsWaiting);
  /** Only a signed-in lesson offers "I already know this": it is where things are taught. */
  const canMark = mode === "lesson" && !guest;

  /**
   * Which pass through a practice run this is. Going again reshuffles by
   * moving the seed on; it only changes after the first render, so the server
   * and the client still build the same first queue.
   */
  const [round, setRound] = useState(0);

  const baseQueue = useMemo<StudyCard[]>(() => {
    if (mode === "lesson") {
      return buildLessonQueue(
        kanji,
        words,
        {
          seen: new Set(seenKanji),
          wordStages,
          skipWords: new Set(markedWords),
          writing,
          skipWriting: new Set(markedWriting),
        },
        seed,
      );
    }
    if (mode === "practice") {
      return buildPracticeQueue(
        practiceTypes ?? ["reading"],
        kanji,
        words,
        kanjiPool ?? kanji,
        pool ?? words,
        wordStages,
        seed + round,
      );
    }
    return buildReviewQueue(words, wordStages, pool ?? words, seed, kanji);
  }, [
    mode,
    practiceTypes,
    kanji,
    words,
    pool,
    kanjiPool,
    wordStages,
    seenKanji,
    markedWords,
    markedWriting,
    writing,
    seed,
    round,
  ]);

  /**
   * What the learner has said they already know, during this run. Their cards
   * still to come are dropped; the mark itself is saved as it is made.
   */
  const [skipped, setSkipped] = useState<Skipped>(NOTHING_SKIPPED);
  const queue = useMemo(() => withoutSkipped(baseQueue, skipped), [baseQueue, skipped]);

  /** A session with no writing card has no use for the hint toggle. */
  const hasWriting = useMemo(() => queue.some((c) => c.kind === "kanji-write"), [queue]);

  const [index, setIndex] = useState(0);
  const [picked, setPicked] = useState<string | null>(null);
  const [answered, setAnswered] = useState(0);
  const [correctCount, setCorrectCount] = useState(0);
  const [done, setDone] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  /**
   * Whether the reading is shown beneath the word on a meaning card.
   *
   * That reading is a hint: with it visible a word can be answered without
   * reading its kanji at all, which is the one thing this app exists to make
   * you do. Hiding it is the harder, more useful mode, so it is worth being
   * able to switch without leaving the session.
   *
   * Starts true to match the server render, then reads the stored preference
   * after mount — deciding during render would disagree with the HTML and trip
   * a hydration mismatch.
   */
  const [showFurigana, setShowFurigana] = useState(true);

  /**
   * Whether the writing pad checks each stroke as it is drawn.
   *
   * The opposite default to the reading: writing from memory is the point of
   * the card, so hints are something to ask for rather than something to turn
   * off. Read after mount for the same hydration reason as the reading.
   */
  const [hints, setHints] = useState(false);

  useEffect(() => {
    try {
      setShowFurigana(localStorage.getItem(FURIGANA_KEY) !== "off");
      setHints(localStorage.getItem(HINTS_KEY) === "on");
    } catch {
      // Private browsing can refuse storage; the defaults stand.
    }
  }, []);

  const toggleFurigana = useCallback(() => {
    setShowFurigana((on) => {
      const next = !on;
      try {
        localStorage.setItem(FURIGANA_KEY, next ? "on" : "off");
      } catch {
        // Applies for this session; it just will not be remembered.
      }
      return next;
    });
  }, []);

  const toggleHints = useCallback(() => {
    setHints((on) => {
      const next = !on;
      try {
        localStorage.setItem(HINTS_KEY, next ? "on" : "off");
      } catch {
        // Applies for this session; it just will not be remembered.
      }
      return next;
    });
  }, []);

  const card = queue[index];
  const total = queue.length;
  const isLast = index === total - 1;

  /**
   * Every write goes through here, so a guest session or a practice run can
   * make none — not an answer, not a session in the history, not a checkpoint.
   */
  const save = useCallback(
    (url: string, body: unknown) => {
      if (!guest && !practice) void post(url, body, setSaveError);
    },
    [guest, practice],
  );

  const finish = useCallback(
    (right: number, asked: number) => {
      setDone(true);
      if (asked > 0) save("/api/session", { mode, lessonSlug, total: asked, correct: right });
      if (lessonSlug) {
        save("/api/checkpoint", {
          lessonSlug,
          cursor: lessonLength ?? cursorOffset + kanji.length,
          completed: true,
        });
      }
      // Picks up the progress just written. A guest or a practice run wrote none.
      if (!guest && !practice) router.refresh();
    },
    [mode, guest, practice, save, lessonSlug, kanji.length, cursorOffset, lessonLength, router],
  );

  /** Another pass over the same characters, reshuffled. */
  const restart = useCallback(() => {
    setRound((r) => r + 1);
    setIndex(0);
    setPicked(null);
    setAnswered(0);
    setCorrectCount(0);
    setDone(false);
    setSkipped(NOTHING_SKIPPED);
  }, []);

  /**
   * Moves to the next card of `q`, or finishes after the last.
   *
   * Takes the queue and the tally rather than reading them from this render,
   * because both can change in the same click that moves on: a mark shortens
   * the queue, and a graded writing card adds to the tally. Reading them here
   * would finish one card late, or leave the last answer out of the summary.
   */
  const advanceIn = useCallback(
    (q: StudyCard[], tally = { right: correctCount, asked: answered }) => {
      if (index >= q.length - 1) {
        finish(tally.right, tally.asked);
        return;
      }
      setPicked(null);
      const next = index + 1;
      // The end of a character's cycle is the only safe place to resume from —
      // mid-cycle would re-teach words already seen. The cursor counts the
      // lesson's characters up to and including this one, so a character with
      // nothing left to do, and so no cards, is counted as passed too.
      if (lessonSlug && cardChar(q[index]) !== cardChar(q[next])) {
        const at = kanji.findIndex((k) => k.char === cardChar(q[index]));
        save("/api/checkpoint", { lessonSlug, cursor: cursorOffset + at + 1, completed: false });
      }
      setIndex(next);
    },
    [index, finish, correctCount, answered, lessonSlug, kanji, cursorOffset, save],
  );

  const advance = useCallback(() => advanceIn(queue), [advanceIn, queue]);

  /**
   * Records one graded answer against a word or a character's writing.
   *
   * The meaning card is not recorded: a character's reading comes from its
   * words, which are asked straight after it. It still counts in the summary.
   */
  const grade = useCallback(
    (right: boolean) => {
      if (!card) return;
      setAnswered((n) => n + 1);
      if (right) setCorrectCount((n) => n + 1);

      if (card.kind === "kanji-write") {
        save("/api/kanji", { char: card.kanji.char, correct: right });
      } else if ("word" in card) {
        save("/api/answer", { wordId: card.word.id, correct: right });
      }
    },
    [card, save],
  );

  /** "I already know this" on a word being introduced: no quiz on it follows. */
  const knowWord = useCallback(
    (word: Word) => {
      save("/api/mark", { scope: "word", id: word.id, skill: "reading" });
      const next = { ...skipped, words: new Set(skipped.words).add(word.id) };
      setSkipped(next);
      advanceIn(withoutSkipped(baseQueue, next));
    },
    [save, skipped, baseQueue, advanceIn],
  );

  /** On a character being introduced: marks its words, and skips to its writing, if any. */
  const knowKanji = useCallback(
    (k: Kanji) => {
      save("/api/mark", { scope: "kanji", id: k.char, skill: "reading" });
      const next = { ...skipped, chars: new Set(skipped.chars).add(k.char) };
      setSkipped(next);
      advanceIn(withoutSkipped(baseQueue, next));
    },
    [save, skipped, baseQueue, advanceIn],
  );

  /** On a writing card: marks the writing known instead of grading an attempt. */
  const knowWriting = useCallback(
    (k: Kanji) => {
      save("/api/mark", { scope: "kanji", id: k.char, skill: "writing" });
      advance();
    },
    [save, advance],
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
      advanceIn(queue, { right: correctCount + (right ? 1 : 0), asked: answered + 1 });
    },
    [grade, advanceIn, queue, correctCount, answered],
  );

  /**
   * Retry on the writing pad: recorded as a miss straight away, so closing the
   * tab mid-retry keeps it, and not graded again when the learner moves on.
   */
  const missWriting = useCallback(() => grade(false), [grade]);

  // Number keys pick an option, Enter or Space moves on. Study screens live or
  // die on not needing the mouse. The writing pad is exempt: it wants the
  // pointer, and Space there would skip past the character being drawn.
  useEffect(() => {
    if (done || !card || !started) return;
    function onKey(e: KeyboardEvent) {
      if (!card) return;

      // Handled first, and outside every other branch: hiding the reading is a
      // session setting rather than a card action, so it has to work on any
      // card — including the writing pad and a card already answered, which
      // both return early below.
      if (e.key === "f" || e.key === "F") {
        e.preventDefault();
        toggleFurigana();
        return;
      }
      // Likewise hints, which matter most on the writing pad itself.
      if ((e.key === "h" || e.key === "H") && hasWriting) {
        e.preventDefault();
        toggleHints();
        return;
      }

      // The writing pad wants the pointer, and Space there would skip past the
      // character being drawn.
      if (card.kind === "kanji-write") return;

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
  }, [card, picked, done, started, advance, choose, toggleFurigana, toggleHints, hasWriting]);

  if (!started && reviewsWaiting) {
    return <ReviewFirst waiting={reviewsWaiting} title={lessonTitle} onStart={() => setStarted(true)} />;
  }

  if (done) {
    return (
      <div className="stack" style={{ gap: 20 }}>
        {saveError && <SaveWarning detail={saveError} />}
        <Summary
          correct={correctCount}
          total={answered}
          mode={mode}
          guest={guest}
          lessonSlug={lessonSlug}
          lessonTitle={lessonTitle}
          practiceHref={
            practice
              ? `/practice?kanji=${encodeURIComponent(kanji.map((k) => k.char).join(""))}&types=${(practiceTypes ?? []).join(",")}`
              : null
          }
          onRestart={restart}
        />
      </div>
    );
  }

  if (!card) {
    return (
      <Card tone="cream" pad="lg">
        <p style={{ margin: 0 }}>
          {mode === "lesson" ? t.study.nothingLeftLesson : t.study.nothingLeft}
        </p>
      </Card>
    );
  }

  const progress = Math.round((index / total) * 100);

  /**
   * Whether the current card has a reading for the toggle to act on.
   *
   * Only the meaning card shows one as a hint. On every other card the button
   * still records the preference for the next word, but changes nothing on
   * screen — and a control that looks live while doing nothing reads as broken,
   * so it says so instead.
   */
  const cardHasReading =
    "choices" in card && card.kind === "word-meaning" && card.word.reading !== card.word.word;

  return (
    <div className="stack" style={{ gap: 28 }}>
      {saveError && <SaveWarning detail={saveError} />}

      <div className="stack" style={{ gap: 12 }}>
        <div className="row" style={{ justifyContent: "space-between", gap: 16 }}>
          <span className="eyebrow">
            {lessonTitle}
            {cursorOffset > 0 && t.study.resumedAt(cursorOffset + 1)}
          </span>
          <div className="row" style={{ gap: 10 }}>
            {hasWriting && (
              <SessionToggle
                onClick={toggleHints}
                pressed={hints}
                applies={card.kind === "kanji-write"}
                icon={hints ? "lightbulb" : "lightbulb-off"}
                label={hints ? t.study.hints.turnOff : t.study.hints.turnOn}
                title={
                  card.kind === "kanji-write"
                    ? hints
                      ? t.study.hints.offTitle
                      : t.study.hints.onTitle
                    : hints
                      ? t.study.hints.naOn
                      : t.study.hints.naOff
                }
              />
            )}
            <SessionToggle
              onClick={toggleFurigana}
              pressed={!showFurigana}
              applies={cardHasReading}
              icon={showFurigana ? "eye" : "eye-off"}
              label={showFurigana ? t.study.furigana.hide : t.study.furigana.show}
              title={
                cardHasReading
                  ? showFurigana
                    ? t.study.furigana.hideTitle
                    : t.study.furigana.showTitle
                  : showFurigana
                    ? t.study.furigana.naShown
                    : t.study.furigana.naHidden
              }
            />
            <span className="eyebrow" style={{ color: "var(--text-body)" }}>
              {index + 1} / {total}
            </span>
          </div>
        </div>
        <div className="meter">
          <span style={{ width: `${progress}%` }} />
        </div>
      </div>

      {card.kind === "kanji-teach" && (
        <KanjiTeachCard
          kanji={card.kanji}
          onNext={advance}
          onKnown={canMark ? () => knowKanji(card.kanji) : undefined}
        />
      )}
      {card.kind === "word-teach" && (
        <WordTeachCard
          word={card.word}
          onNext={advance}
          onKnown={canMark ? () => knowWord(card.word) : undefined}
        />
      )}
      {card.kind === "kanji-write" && (
        <Card tone="white" pad="lg" elevation="md" radius="lg">
          <WritingPad
            key={card.kanji.char}
            char={card.kanji.char}
            paths={card.kanji.strokePaths}
            meaning={card.kanji.meanings.join(", ")}
            expectedStrokes={card.kanji.strokes}
            level={card.kanji.level}
            hints={hints}
            onGrade={gradeWriting}
            onMiss={missWriting}
            onContinue={advance}
            onKnown={canMark ? () => knowWriting(card.kanji) : undefined}
            minScore={practice ? PRACTICE_MIN_WRITING_SCORE : undefined}
          />
        </Card>
      )}
      {"choices" in card && (
        <QuizCard
          card={card}
          picked={picked}
          onChoose={choose}
          onNext={advance}
          isLast={isLast}
          showFurigana={showFurigana}
        />
      )}
    </div>
  );
}

/* -------------------------------------------------------------------------- */

/**
 * A session setting in the header: the reading, or writing hints.
 *
 * `applies` is whether the current card has anything for it to change. It
 * stays clickable when not, so the setting can be made ahead of the card it is
 * for, but drops to a hairline outline so it does not promise a change it
 * cannot make here.
 */
function SessionToggle({
  onClick,
  pressed,
  applies,
  icon,
  label,
  title,
}: {
  onClick: () => void;
  pressed: boolean;
  applies: boolean;
  icon: string;
  label: string;
  title: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={pressed}
      title={title}
      aria-label={label}
      style={{
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        width: 30,
        height: 30,
        flex: "0 0 auto",
        borderRadius: "var(--radius-full)",
        border: `1px solid ${applies ? "var(--border-default)" : "var(--border-subtle)"}`,
        background: pressed && applies ? "var(--surface-sunken)" : "transparent",
        color: applies ? (pressed ? "var(--text-heading)" : "var(--text-muted)") : "var(--border-default)",
        cursor: "pointer",
        transition: "var(--transition-control)",
      }}
    >
      <Icon name={icon} size={15} />
    </button>
  );
}

export function SaveWarning({ detail }: { detail: string }) {
  const t = useT().study.save;
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
        <strong>{t.notSaved}</strong> {detail} {t.after}
      </span>
    </div>
  );
}

/**
 * Shown before a lesson when reviews have piled up past the learner's own
 * threshold. New characters build on the ones already met, so clearing what is
 * due first is the better order — but it is the learner's call, and starting
 * anyway is one click.
 */
function ReviewFirst({ waiting, title, onStart }: { waiting: number; title: string; onStart: () => void }) {
  const t = useT().study.reviewFirst;
  return (
    <Card tone="cream" pad="lg" radius="lg">
      <div className="stack" style={{ gap: 20 }}>
        <div className="row" style={{ gap: 10 }}>
          <Sparkle size={16} color="var(--on-tint-heading)" />
          <span className="eyebrow" style={{ color: "var(--on-tint-heading)" }}>
            {t.eyebrow(title)}
          </span>
        </div>
        <h1
          style={{
            margin: 0,
            fontSize: "var(--text-display-4)",
            letterSpacing: "var(--tracking-display)",
            lineHeight: "var(--leading-display)",
          }}
        >
          {t.heading(waiting)}
        </h1>
        <p style={{ margin: 0, color: "var(--on-tint-body)", maxWidth: 460 }}>
          {t.body}
        </p>
        <div className="row" style={{ gap: 12, flexWrap: "wrap" }}>
          <Link href="/review" className="reset-link">
            <Button variant="primary" size="lg" icon="zap" iconPosition="left">
              {t.reviewFirst}
            </Button>
          </Link>
          <Button variant="outline" size="lg" icon="chevron-right" onClick={onStart}>
            {t.startAnyway}
          </Button>
        </div>
        <p className="body-sm" style={{ margin: 0, color: "var(--on-tint-body)" }}>
          {t.settingsBefore}{" "}
          <Link href="/settings" style={{ color: "var(--on-tint-heading)" }}>
            {t.settingsLink}
          </Link>
          {t.settingsAfter}
        </p>
      </div>
    </Card>
  );
}

/**
 * "Got It", and beside it "Already Know It" where marking is offered.
 *
 * The mark sits on the teaching card because that is where time would be
 * wasted: someone who already reads 日本語 should not sit through its quizzes.
 * It is the quieter of the two, so the lesson's own path stays the default.
 */
function TeachActions({ onNext, onKnown, knownTitle }: { onNext: () => void; onKnown?: () => void; knownTitle: string }) {
  const t = useT().study;
  if (!onKnown) {
    return (
      <Button variant="primary" size="lg" fullWidth onClick={onNext} icon="chevron-right">
        {t.gotIt}
      </Button>
    );
  }
  return (
    <div className="row" style={{ gap: 12 }}>
      <Button variant="outline" size="lg" fullWidth onClick={onKnown} title={knownTitle}>
        {t.alreadyKnow}
      </Button>
      <Button variant="primary" size="lg" fullWidth onClick={onNext} icon="chevron-right">
        {t.gotIt}
      </Button>
    </div>
  );
}

function KanjiTeachCard({ kanji, onNext, onKnown }: { kanji: Kanji; onNext: () => void; onKnown?: () => void }) {
  const t = useT().study;
  return (
    <Card tone="white" pad="lg" elevation="md" radius="lg">
      <div className="stack" style={{ gap: 24 }}>
        <div className="row" style={{ gap: 10 }}>
          <Sparkle size={16} color="var(--accent)" />
          <span className="eyebrow" style={{ color: "var(--text-brand)" }}>
            {t.newKanji}
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
                [t.on, kanji.onyomi],
                [t.kun, kanji.kunyomi],
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
              <Badge tone="sage">{t.strokes(kanji.strokes)}</Badge>
            </div>
          </div>
        </div>

        {/* The radical badge that sat above is gone: the anatomy names the
            radical, says what it means, and shows it among the parts. */}
        <KanjiAnatomy kanji={kanji} variant="teach" />

        <TeachActions
          onNext={onNext}
          onKnown={onKnown}
          knownTitle={t.knownKanjiTitle(kanji.char)}
        />
      </div>
    </Card>
  );
}

function WordTeachCard({ word, onNext, onKnown }: { word: Word; onNext: () => void; onKnown?: () => void }) {
  const { study: t, common: { pos } } = useT();
  return (
    <Card tone="white" pad="lg" elevation="md" radius="lg">
      <div className="stack" style={{ gap: 22 }}>
        <span className="eyebrow">
          {t.inAWord(word.teaches)}
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
            <Badge tone="sage">{pos[word.pos] ?? word.pos}</Badge>
          </div>
        </div>

        <TeachActions
          onNext={onNext}
          onKnown={onKnown}
          knownTitle={t.knownWordTitle(word.word)}
        />
      </div>
    </Card>
  );
}

export function QuizCard({
  card,
  picked,
  onChoose,
  onNext,
  isLast,
  showFurigana,
}: {
  card: Extract<StudyCard, { choices: unknown }>;
  picked: string | null;
  onChoose: (id: string) => void;
  onNext: () => void;
  isLast: boolean;
  showFurigana: boolean;
}) {
  const t = useT().study;
  const wasRight = picked === card.answerId;
  const isKanji = card.kind === "kanji-meaning";

  const prompt = isKanji
    ? card.kanji.char
    : card.kind === "word-recall"
      ? card.word.meanings.join(", ")
      : card.word.word;
  const promptIsJapanese = isKanji || card.kind !== "word-recall";
  /**
   * Only the meaning card's reading is hidden.
   *
   * A reading card's options ARE readings, and the answer reveal is where the
   * reading gets taught after a wrong guess — suppressing either would remove
   * information rather than remove a hint.
   */
  /**
   * The reading, and separately whether it is currently shown.
   *
   * These are two questions, not one. Whether the card HAS a reading decides
   * if the row is rendered at all; whether the learner wants to see it decides
   * only its visibility. Collapsing them into one value is what made the card
   * change height when the eye was toggled, which moves the answer buttons
   * under the cursor mid-read.
   */
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
          <span className="eyebrow">{t.prompt[card.kind]}</span>
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
            <div
              className="jp"
              style={{
                fontSize: 18,
                color: "var(--on-tint-body)",
                // Hidden, not removed: the row keeps its height so the card and
                // everything below it stay put. visibility also takes it out of
                // the accessibility tree, so it is not read aloud either.
                visibility: showFurigana ? "visible" : "hidden",
              }}
            >
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
                  {wasRight ? t.correct : t.notQuite}
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
              {isLast ? t.finish : t.next}
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
  guest,
  lessonSlug,
  lessonTitle,
  practiceHref,
  onRestart,
}: {
  correct: number;
  total: number;
  mode: Mode;
  guest: boolean;
  lessonSlug: string | null;
  lessonTitle: string;
  /** Back to the practice page with this run's choices, or null for a run that counts. */
  practiceHref: string | null;
  onRestart: () => void;
}) {
  const t = useT().study.summary;
  const percent = total ? Math.round((correct / total) * 100) : 0;

  return (
    <Card tone="forest" pad="lg" radius="lg">
      <div className="stack" style={{ gap: 28 }}>
        <div className="row" style={{ gap: 10 }}>
          <Sparkle size={18} color="var(--lime-500)" />
          <span className="eyebrow" style={{ color: "var(--lime-500)" }}>
            {t.complete}
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

        {/* Practice is for drilling, not for a mark. */}
        {practiceHref === null && (
          <div className="row" style={{ gap: 48, flexWrap: "wrap" }}>
            {[
              [`${percent}%`, t.accuracy, "var(--lime-500)"],
              [`${correct}/${total}`, t.answered, "var(--white)"],
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
        )}

        {practiceHref !== null ? (
          <>
            <p style={{ margin: 0, color: "var(--forest-200)", maxWidth: 460 }}>
              {guest ? t.practiceGuest : t.practice}
            </p>

            <div className="row" style={{ gap: 12, flexWrap: "wrap" }}>
              <Button variant="accent" size="lg" icon="chevron-right" onClick={onRestart}>
                {t.practiseAgain}
              </Button>
              {/* Back with the same choices still made, so the set can be
                  adjusted rather than chosen again from nothing. */}
              <Link href={practiceHref} className="reset-link">
                <Button variant="outline-inverse" size="lg">
                  {t.changePractice}
                </Button>
              </Link>
            </div>
          </>
        ) : guest ? (
          <>
            <p style={{ margin: 0, color: "var(--forest-200)", maxWidth: 460 }}>
              {t.guest}
            </p>

            <div className="row" style={{ gap: 12, flexWrap: "wrap" }}>
              {/* Back to this lesson, so it can be taken again and kept. */}
              <Link
                href={`/login?next=${encodeURIComponent(lessonSlug ? `/lessons/${lessonSlug}` : "/lessons")}`}
                className="reset-link"
              >
                <Button variant="accent" size="lg" icon="chevron-right">
                  {t.signIn}
                </Button>
              </Link>
              <Link href="/lessons" className="reset-link">
                <Button variant="outline-inverse" size="lg">
                  {t.browseLessons}
                </Button>
              </Link>
            </div>
          </>
        ) : (
          <>
            <p style={{ margin: 0, color: "var(--forest-200)", maxWidth: 460 }}>
              {t.saved}
            </p>

            <div className="row" style={{ gap: 12, flexWrap: "wrap" }}>
              <Link href="/dashboard" className="reset-link">
                <Button variant="accent" size="lg" icon="chevron-right">
                  {t.dashboard}
                </Button>
              </Link>
              <Link href={mode === "review" ? "/lessons" : "/review"} className="reset-link">
                <Button variant="outline-inverse" size="lg">
                  {mode === "review" ? t.browseLessons : t.startReview}
                </Button>
              </Link>
            </div>
          </>
        )}
      </div>
    </Card>
  );
}
