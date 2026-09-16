import Link from "next/link";
import { redirect } from "next/navigation";
import { getUser } from "@/lib/auth";
import { DAILY_QUIZ_SIZE, localDate, requestTimeZone, shiftDate } from "@/lib/daily";
import { getDailyHistory, getDailyQuiz } from "@/lib/progress";
import { Button } from "@/components/atlas/core/Button.jsx";
import { Card } from "@/components/atlas/layout/Card.jsx";
import { Sparkle } from "@/components/atlas/core/Sparkle.jsx";
import { DailyQuiz } from "@/components/app/DailyQuiz";
import { DailyResults } from "@/components/app/DailyResults";
import { getLocale, getT } from "@/lib/i18n/server";
import { intlTag } from "@/lib/i18n/format";
import type { Locale } from "@/lib/i18n/config";
import type { Messages } from "@/lib/i18n/messages";

export const dynamic = "force-dynamic";

const HISTORY_DAYS = 7;

export default async function DailyQuizPage() {
  const user = await getUser();
  if (!user) redirect("/login");
  const [t, locale] = await Promise.all([getT(), getLocale()]);

  const timeZone = requestTimeZone();
  const today = localDate(timeZone);
  const since = shiftDate(today, -(HISTORY_DAYS - 1));
  const [quiz, history] = await Promise.all([
    getDailyQuiz(user.id, today, timeZone, locale),
    getDailyHistory(user.id, since),
  ]);

  if (quiz.questions.length === 0) {
    return (
      <div style={{ maxWidth: 620, margin: "0 auto" }}>
        <Card tone="cream" pad="lg" radius="lg">
          <div className="stack" style={{ gap: 20 }}>
            <div className="row" style={{ gap: 10 }}>
              <Sparkle size={16} color="var(--on-tint-heading)" />
              <span className="eyebrow" style={{ color: "var(--on-tint-heading)" }}>
                {t.daily.eyebrow}
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
              {t.daily.lockedHeading(DAILY_QUIZ_SIZE)}
            </h1>
            <p style={{ margin: 0, color: "var(--on-tint-body)", maxWidth: 460 }}>
              {t.daily.lockedBody(DAILY_QUIZ_SIZE, quiz.learned)}
            </p>
            <div className="row" style={{ gap: 12, flexWrap: "wrap" }}>
              <Link href="/lessons" className="reset-link">
                <Button variant="primary" size="lg" icon="chevron-right">
                  {t.daily.browseLessons}
                </Button>
              </Link>
            </div>
          </div>
        </Card>
      </div>
    );
  }

  const finished = quiz.answers.length >= quiz.questions.length;

  return (
    <div className="stack" style={{ gap: 40, maxWidth: 620, margin: "0 auto" }}>
      {finished ? (
        <DailyResults date={today} rows={quiz.answers} />
      ) : (
        <DailyQuiz date={today} questions={quiz.questions} answered={quiz.answers} />
      )}

      {finished && <History today={today} history={history} t={t} locale={locale} />}
    </div>
  );
}

/** The last week's scores, one tile a day. */
function History({
  today,
  history,
  t,
  locale,
}: {
  today: string;
  history: Map<string, { answered: number; correct: number }>;
  t: Messages;
  locale: Locale;
}) {
  const days = Array.from({ length: HISTORY_DAYS }, (_, i) => shiftDate(today, i - (HISTORY_DAYS - 1)));

  return (
    <section className="stack" style={{ gap: 16 }}>
      <p className="eyebrow" style={{ margin: 0 }}>
        {t.daily.pastWeek}
      </p>
      <div style={{ display: "grid", gridTemplateColumns: `repeat(${HISTORY_DAYS}, minmax(0, 1fr))`, gap: 8 }}>
        {days.map((day) => {
          const h = history.get(day);
          const weekday = new Date(`${day}T00:00:00Z`).toLocaleDateString(locale === "en" ? "en-GB" : intlTag(locale), {
            weekday: "short",
            timeZone: "UTC",
          });
          return (
            <div
              key={day}
              title={h ? t.daily.dayScore(day, h.correct, h.answered) : t.daily.dayNotTaken(day)}
              className="stack"
              style={{
                gap: 6,
                alignItems: "center",
                padding: "12px 4px",
                borderRadius: "var(--radius-md)",
                background: h ? "var(--surface-card-sage)" : "var(--surface-sunken)",
                outline: day === today ? "1.5px solid var(--border-strong)" : "none",
              }}
            >
              <span className="eyebrow" style={{ fontSize: 10, color: h ? "var(--on-tint-body)" : "var(--text-muted)" }}>
                {weekday}
              </span>
              <span
                style={{
                  fontFamily: "var(--font-mono)",
                  fontSize: "var(--text-body-sm)",
                  color: h ? "var(--on-tint-heading)" : "var(--text-muted)",
                }}
              >
                {h ? `${h.correct}/${h.answered}` : "—"}
              </span>
            </div>
          );
        })}
      </div>
    </section>
  );
}
