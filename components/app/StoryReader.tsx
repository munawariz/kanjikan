"use client";

import { useState } from "react";
import { Button } from "@/components/atlas/core/Button.jsx";
import { Icon } from "@/components/atlas/core/Icon.jsx";
import { Card } from "@/components/atlas/layout/Card.jsx";
import { Switch } from "@/components/atlas/forms/Switch.jsx";
import type { RubyText, Story } from "@/lib/content";
import { useT } from "@/lib/i18n/client";

/**
 * Japanese text with readings.
 *
 * A word with a kanji beyond the story's level always shows its reading. Any
 * other word is the test: the reader can tap it to see its reading, or turn
 * every reading on at once. A hidden reading is not rendered at all, since
 * even an invisible one widens a short word; the line height leaves room for
 * one, so revealing it moves the text sideways at most, never down.
 *
 * `path` keys each word so a reading stays revealed across re-renders.
 */
export function RubyLine({
  text,
  path,
  showAll = false,
  revealed,
  onReveal,
}: {
  text: RubyText;
  path: string;
  showAll?: boolean;
  revealed?: ReadonlySet<string>;
  onReveal?: (key: string) => void;
}) {
  return (
    <>
      {text.map((seg, i) => {
        if (!seg.reading) return <span key={i}>{seg.text}</span>;
        const key = `${path}.${i}`;
        const shown = seg.beyond || showAll || Boolean(revealed?.has(key));
        const ruby = shown ? (
          <ruby>
            {seg.text}
            <rt>{seg.reading}</rt>
          </ruby>
        ) : (
          seg.text
        );
        if (seg.beyond || !onReveal) return <span key={i}>{ruby}</span>;
        return (
          <button
            key={i}
            type="button"
            className="ruby-word"
            aria-pressed={shown}
            aria-label={shown ? `${seg.text} (${seg.reading})` : seg.text}
            onClick={() => onReveal(key)}
          >
            {ruby}
          </button>
        );
      })}
    </>
  );
}

/**
 * The story, its questions and its translation.
 *
 * Practice only: answers are checked here and never sent anywhere, the same
 * as a guest's lesson. The questions start collapsed. An answer is final once
 * chosen, and Start Over clears them all.
 */
export function StoryReader({ story }: { story: Story }) {
  const t = useT().reading;
  const [showAll, setShowAll] = useState(false);
  const [revealed, setRevealed] = useState<Set<string>>(() => new Set());
  const [answers, setAnswers] = useState<(number | null)[]>(() => story.questions.map(() => null));
  const [translation, setTranslation] = useState(false);
  const [questionsOpen, setQuestionsOpen] = useState(false);

  function reveal(key: string) {
    setRevealed((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  function startOver() {
    setAnswers(story.questions.map(() => null));
    setRevealed(new Set());
    setShowAll(false);
    setTranslation(false);
    setQuestionsOpen(false);
  }

  const readingProps = { showAll, revealed, onReveal: reveal };

  return (
    <div className="stack" style={{ gap: 40 }}>
      <Card tone="white" pad="md" radius="lg" bordered>
        <div className="stack" style={{ gap: 24 }}>
          <div className="row" style={{ gap: 16, justifyContent: "space-between", flexWrap: "wrap" }}>
            <p className="body-sm muted" style={{ margin: 0 }}>
              {t.tapHint}
            </p>
            <Switch checked={showAll} onChange={setShowAll} label={t.showAll} />
          </div>

          <div className="story-text jp stack" lang="ja" style={{ gap: 20 }}>
            {story.paragraphs.map((p, i) => (
              <p key={i} style={{ margin: 0 }}>
                <RubyLine text={p} path={`p${i}`} {...readingProps} />
              </p>
            ))}
          </div>
        </div>
      </Card>

      {/* Closed until asked for, so the questions do not give the story away
          before it has been read. Open state is kept here too, so Start Over
          can close it; the browser toggles it and onToggle reports back. */}
      <details
        className="fold"
        open={questionsOpen}
        onToggle={(e) => setQuestionsOpen(e.currentTarget.open)}
      >
        <summary className="fold-summary">
          <span className="stack" style={{ gap: 4, flex: 1, minWidth: 0 }}>
            <h2 style={{ margin: 0, fontSize: "var(--text-heading-1)" }}>{t.questionsHeading}</h2>
            <span className="body-sm muted">
              {t.questionsCount(story.questions.length)} · {t.questionsNote}
            </span>
          </span>
          <span className="fold-chevron" aria-hidden="true">
            <Icon name="chevron-down" size={22} />
          </span>
        </summary>

        <div className="fold-body">
          <div className="stack" style={{ gap: 20, paddingTop: 20 }}>
            {story.questions.map((q, qi) => {
              const chosen = answers[qi];
              const done = chosen !== null;
              return (
                <Card key={qi} tone={qi % 2 === 0 ? "cream" : "sage"} pad="md" radius="lg">
                  <div className="stack" style={{ gap: 16 }}>
                    <p className="eyebrow" style={{ margin: 0, color: "var(--on-tint-body)" }}>
                      {t.question(qi + 1)}
                    </p>
                    <p className="story-text jp" lang="ja" style={{ margin: 0, color: "var(--on-tint-heading)" }}>
                      <RubyLine text={q.prompt} path={`q${qi}`} {...readingProps} />
                    </p>

                    <div className="stack" style={{ gap: 8 }} role="group" aria-label={t.question(qi + 1)}>
                      {q.choices.map((choice, ci) => {
                        const right = ci === q.answer;
                        const state = !done ? "open" : right ? "right" : ci === chosen ? "wrong" : "muted";
                        return (
                          <button
                            key={ci}
                            type="button"
                            className="story-choice"
                            data-state={state}
                            disabled={done}
                            aria-pressed={ci === chosen}
                            onClick={() =>
                              setAnswers((prev) => prev.map((a, i) => (i === qi ? ci : a)))
                            }
                          >
                            <span className="story-choice-mark" aria-hidden="true">
                              {state === "right" ? <Icon name="check" size={16} /> : ci + 1}
                            </span>
                            {/* Readings in a choice are shown as the story shows them;
                                tapping here picks the answer, not a word. */}
                            <span className="story-text jp" lang="ja">
                              <RubyLine text={choice} path={`q${qi}c${ci}`} showAll={showAll} />
                            </span>
                          </button>
                        );
                      })}
                    </div>

                    {done && (
                      <p className="body-sm" role="status" style={{ margin: 0, color: "var(--on-tint-body)" }}>
                        {chosen === q.answer ? t.correct : t.incorrect}
                      </p>
                    )}
                  </div>
                </Card>
              );
            })}
          </div>
        </div>
      </details>

      <div className="row" style={{ gap: 12, flexWrap: "wrap" }}>
        <Button variant="outline" onClick={() => setTranslation((v) => !v)} aria-expanded={translation}>
          {translation ? t.hideTranslation : t.showTranslation}
        </Button>
        <Button variant="ghost" onClick={startOver}>
          {t.startOver}
        </Button>
      </div>

      {translation && (
        <section className="stack" style={{ gap: 16 }}>
          <h2 style={{ margin: 0, fontSize: "var(--text-heading-2)" }}>{t.translationHeading}</h2>
          <div className="stack" style={{ gap: 14, maxWidth: 720 }}>
            {story.translation.map((p, i) => (
              <p key={i} style={{ margin: 0 }}>
                {p}
              </p>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
