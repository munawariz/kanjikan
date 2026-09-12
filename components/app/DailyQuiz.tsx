"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import type { KanjiQuizCard } from "@/lib/study";
import type { DailyAnswerRow } from "@/lib/progress";
import { post, QuizCard, SaveWarning } from "./StudySession";
import { DailyResults, formatQuizDate } from "./DailyResults";

/**
 * Today's five questions, one attempt each.
 *
 * Questions already answered — by an earlier visit today — are skipped, so
 * leaving halfway resumes rather than restarts. Each answer is sent the moment
 * it is given and graded again on the server; the verdict shown here is only
 * for immediate feedback.
 */
export function DailyQuiz({
  date,
  questions,
  answered,
}: {
  date: string;
  /** The whole day's quiz, in order. */
  questions: KanjiQuizCard[];
  /** Answers already on record for this date. */
  answered: DailyAnswerRow[];
}) {
  const router = useRouter();

  const [remaining] = useState(() => {
    const done = new Set(answered.map((a) => a.position));
    return questions
      .map((card, i) => ({ card, position: i + 1 }))
      .filter((q) => !done.has(q.position));
  });

  const [index, setIndex] = useState(0);
  const [picked, setPicked] = useState<string | null>(null);
  const [rows, setRows] = useState<DailyAnswerRow[]>(answered);
  const [done, setDone] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const writes = useRef<Promise<boolean>[]>([]);

  const current = remaining[index];
  const isLast = index === remaining.length - 1;

  const choose = useCallback(
    (choiceId: string) => {
      if (picked || !current) return;
      const { card, position } = current;
      const label = (id: string) => card.choices.find((c) => c.id === id)?.label ?? "";

      setPicked(choiceId);
      setRows((r) => [
        ...r,
        {
          position,
          char: card.kanji.char,
          answer: label(card.answerId),
          chosen: label(choiceId),
          correct: choiceId === card.answerId,
        },
      ]);
      writes.current.push(post("/api/daily-quiz", { date, position, choiceId }, setSaveError));
    },
    [picked, current, date],
  );

  const advance = useCallback(() => {
    if (!isLast) {
      setPicked(null);
      setIndex((i) => i + 1);
      return;
    }
    setDone(true);
    // Refresh only once every answer is in, so the page rebuilds from the full
    // record and the dashboard stops offering today's quiz. After a failed
    // write it would instead rebuild with that question still open — and ask
    // it again of someone who has just been shown the answer — so the results
    // stay as they are, beside the warning.
    void Promise.all(writes.current).then((ok) => {
      if (ok.every(Boolean)) router.refresh();
    });
  }, [isLast, router]);

  // Number keys pick an option, Enter or Space moves on — as in a lesson.
  useEffect(() => {
    if (done || !current) return;
    function onKey(e: KeyboardEvent) {
      if (!current) return;
      if (picked) {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          advance();
        }
        return;
      }
      const n = Number(e.key);
      if (n >= 1 && n <= current.card.choices.length) {
        e.preventDefault();
        choose(current.card.choices[n - 1].id);
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [current, picked, done, advance, choose]);

  if (done || !current) {
    return (
      <div className="stack" style={{ gap: 20 }}>
        {saveError && <SaveWarning detail={saveError} />}
        <DailyResults date={date} rows={[...rows].sort((a, b) => a.position - b.position)} />
      </div>
    );
  }

  const answeredCount = questions.length - remaining.length + index;

  return (
    <div className="stack" style={{ gap: 28 }}>
      {saveError && <SaveWarning detail={saveError} />}

      <div className="stack" style={{ gap: 12 }}>
        <div className="row" style={{ justifyContent: "space-between", gap: 16 }}>
          <span className="eyebrow">Daily quiz · {formatQuizDate(date)}</span>
          <span className="eyebrow" style={{ color: "var(--text-body)" }}>
            {current.position} / {questions.length}
          </span>
        </div>
        <div className="meter">
          <span style={{ width: `${Math.round((answeredCount / questions.length) * 100)}%` }} />
        </div>
      </div>

      <QuizCard
        card={current.card}
        picked={picked}
        onChoose={choose}
        onNext={advance}
        isLast={isLast}
        showFurigana
      />
    </div>
  );
}
