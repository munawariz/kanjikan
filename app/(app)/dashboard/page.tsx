import Link from "next/link";
import { redirect } from "next/navigation";
import { getUser } from "@/lib/auth";
import {
  getDailyQuiz,
  getDashboard,
  type DailyQuiz,
  type LessonSummary,
  type LevelProgress,
} from "@/lib/progress";
import { getAllWords, getLevelPath } from "@/lib/content";
import { DAILY_QUIZ_SIZE, localDate, requestTimeZone } from "@/lib/daily";
import type { MasteryBand } from "@/lib/srs";
import { Badge } from "@/components/atlas/core/Badge.jsx";
import { Button } from "@/components/atlas/core/Button.jsx";
import { Card } from "@/components/atlas/layout/Card.jsx";
import { Icon } from "@/components/atlas/core/Icon.jsx";
import { Sparkle } from "@/components/atlas/core/Sparkle.jsx";
import { BarChart } from "@/components/atlas/data/BarChart.jsx";
import { WritingSetting } from "@/components/app/StudySettings";
import { getLocale, getT } from "@/lib/i18n/server";
import type { Messages } from "@/lib/i18n/messages";

export const dynamic = "force-dynamic";

const BAND_COLOUR: Record<MasteryBand, string> = {
  new: "var(--band-new)",
  learning: "var(--band-learning)",
  known: "var(--band-known)",
  mastered: "var(--band-mastered)",
};

/** The bands in order, from not started to mastered. */
const BANDS = Object.keys(BAND_COLOUR) as MasteryBand[];

/**
 * Today's quiz in one line: locked, waiting, half done, or done with a score.
 * Home is where a day starts, so this is where the quiz is found — it has no
 * tab of its own, since five already only just fit on a phone.
 */
function DailyQuizCard({ quiz, t }: { quiz: DailyQuiz; t: Messages }) {
  const m = t.dashboard;
  const locked = quiz.questions.length === 0;
  const answered = quiz.answers.length;
  const finished = !locked && answered >= quiz.questions.length;
  const correct = quiz.answers.filter((a) => a.correct).length;

  const [title, body] = locked
    ? [m.dailyQuiz, m.quizLocked(DAILY_QUIZ_SIZE, quiz.learned)]
    : finished
      ? [m.quizDone(correct, answered), m.quizTomorrow]
      : answered > 0
        ? [m.quizProgress(answered, quiz.questions.length), m.quizFinish]
        : [m.dailyQuiz, m.quizIntro(DAILY_QUIZ_SIZE)];

  return (
    <Card tone="sage" pad="md" radius="lg">
      <div className="row" style={{ gap: 20, justifyContent: "space-between", flexWrap: "wrap" }}>
        <div className="row" style={{ gap: 14, minWidth: 0, flex: "1 1 280px" }}>
          <div
            className="row"
            style={{
              width: 44,
              height: 44,
              flex: "0 0 auto",
              borderRadius: "var(--radius-full)",
              background: finished ? "var(--lime-500)" : "var(--surface-card)",
              justifyContent: "center",
            }}
          >
            {finished ? (
              <Icon name="check" size={20} color="var(--forest-800)" />
            ) : (
              <Sparkle size={18} color="var(--forest-800)" />
            )}
          </div>
          <div style={{ minWidth: 0 }}>
            <div style={{ fontWeight: "var(--weight-semibold)", color: "var(--on-tint-heading)" }}>{title}</div>
            <div className="body-sm" style={{ color: "var(--on-tint-body)" }}>
              {body}
            </div>
          </div>
        </div>
        {!locked && (
          <Link href="/daily-quiz" className="reset-link">
            <Button variant={finished ? "outline" : "primary"} size="md" icon="chevron-right">
              {finished ? m.seeResults : answered > 0 ? m.continueQuiz : m.takeQuiz}
            </Button>
          </Link>
        )}
      </div>
    </Card>
  );
}

/**
 * The one step Home recommends: due reviews first, then the lesson in hand,
 * then the next one. The other buttons stay beside it, because the learner
 * decides — this only says what order works best. A lesson started with too
 * much due warns first (see the study page), but is never refused.
 */
function ContinueCard({
  dueNow,
  resume,
  level,
  t,
}: {
  dueNow: number;
  resume: LessonSummary | null;
  /** The level being worked through, whose kanji the figure counts. */
  level: LevelProgress;
  t: Messages;
}) {
  const m = t.dashboard;
  const percent = Math.round((level.kanjiKnown / Math.max(level.totalKanji, 1)) * 100);
  const lessonLabel = resume?.status === "learning" ? m.continueLesson : m.startLesson;

  return (
    <Card tone="forest" pad="lg" radius="lg">
      <div
        className="row"
        style={{ gap: 40, justifyContent: "space-between", flexWrap: "wrap", alignItems: "flex-end" }}
      >
        <div className="stack" style={{ gap: 16, maxWidth: 480 }}>
          <div className="row" style={{ gap: 10 }}>
            <Sparkle size={16} color="var(--lime-500)" />
            <span className="eyebrow" style={{ color: "var(--lime-500)" }}>
              {dueNow > 0 ? m.nextReviews : resume ? m.nextLesson(resume.order) : m.allCaughtUp}
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
            {dueNow > 0
              ? m.reviewsReady(dueNow)
              : resume
                ? resume.title
                : m.allDone}
          </h2>

          <p style={{ margin: 0, color: "var(--forest-200)" }}>
            {dueNow > 0
              ? m.clearFirst(resume?.title ?? null)
              : resume
                ? resume.summary
                : m.nothingDue}
          </p>

          <div className="row" style={{ gap: 12, flexWrap: "wrap", marginTop: 8 }}>
            {dueNow > 0 && (
              <Link href="/review" className="reset-link">
                <Button variant="accent" size="lg" icon="zap" iconPosition="left">
                  {m.continueReview}
                </Button>
              </Link>
            )}
            {resume && (
              <Link href={`/lessons/${resume.slug}/study`} className="reset-link">
                <Button variant={dueNow > 0 ? "outline-inverse" : "accent"} size="lg" icon="chevron-right">
                  {dueNow > 0 ? lessonLabel : m.continueWith(lessonLabel)}
                </Button>
              </Link>
            )}
            {dueNow === 0 && !resume && (
              <Link href="/practice" className="reset-link">
                <Button variant="accent" size="lg" icon="chevron-right">
                  {m.practise}
                </Button>
              </Link>
            )}
          </div>
        </div>

        <div className="stack" style={{ gap: 6, minWidth: 200 }}>
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
          <div className="eyebrow" style={{ color: "var(--forest-200)" }}>
            {m.levelKanjiKnown(level.level)}
          </div>
          <div className="meter" style={{ background: "rgba(255,255,255,.16)", marginTop: 10, width: 200 }}>
            <span style={{ width: `${percent}%`, background: "var(--lime-500)" }} />
          </div>
          <div className="body-sm" style={{ color: "var(--forest-200)", marginTop: 6 }}>
            {m.kanjiOf(level.kanjiKnown, level.totalKanji)}
          </div>
        </div>
      </div>
    </Card>
  );
}

/**
 * The learning path: one level's lessons in order, each showing how its kanji
 * stand. A kanji's mark fills in as most of its words become known and falls
 * back if they slip, so the path shows where the work is, not just what has
 * been started.
 */
function LessonPath({ lessons, next, t }: { lessons: LessonSummary[]; next: string | null; t: Messages }) {
  return (
    <Card tone="white" pad="none" radius="lg" bordered>
      <ol style={{ listStyle: "none", margin: 0, padding: 0 }}>
        {lessons.map((lesson, i) => {
          const isNext = lesson.slug === next;
          return (
            <li key={lesson.slug} style={{ borderTop: i === 0 ? "none" : "1px solid var(--border-subtle)" }}>
              <Link
                href={`/lessons/${lesson.slug}`}
                className="reset-link row"
                style={{
                  gap: 20,
                  padding: "14px 24px",
                  justifyContent: "space-between",
                  flexWrap: "wrap",
                  background: isNext ? "var(--surface-card-sage)" : undefined,
                }}
              >
                <div className="row" style={{ gap: 16, minWidth: 0, flex: "1 1 280px" }}>
                  <span
                    style={{
                      fontFamily: "var(--font-mono)",
                      fontSize: "var(--text-body-xs)",
                      color: "var(--text-muted)",
                      width: 22,
                      flex: "0 0 auto",
                    }}
                  >
                    {String(lesson.order).padStart(2, "0")}
                  </span>
                  <span className="row jp" style={{ gap: 4, flex: "0 0 auto" }}>
                    {lesson.kanji.map((char, k) => (
                      <span
                        key={char}
                        title={`${char}: ${t.common.band[lesson.bands[k]]}`}
                        style={{
                          display: "inline-flex",
                          alignItems: "center",
                          justifyContent: "center",
                          width: 30,
                          height: 30,
                          fontSize: 17,
                          lineHeight: 1,
                          color: "var(--text-heading)",
                          // Squared like the Kanji page's tiles. Their radius
                          // on a tile this small rounds it into a pill, so it
                          // is scaled down with the tile.
                          border: "1px solid var(--border-subtle)",
                          borderRadius: "calc(var(--radius-sm) / 2)",
                          background: "var(--surface-card)",
                          boxShadow: `inset 0 -3px 0 0 ${BAND_COLOUR[lesson.bands[k]]}`,
                        }}
                      >
                        {char}
                      </span>
                    ))}
                  </span>
                  <span
                    style={{
                      fontWeight: "var(--weight-semibold)",
                      color: "var(--text-heading)",
                      minWidth: 0,
                    }}
                  >
                    {lesson.title}
                  </span>
                </div>

                <div className="row" style={{ gap: 12, flexWrap: "wrap" }}>
                  {isNext && <Badge tone="accent">{t.dashboard.next}</Badge>}
                  {lesson.due > 0 && <Badge tone="warning">{t.dashboard.due(lesson.due)}</Badge>}
                  <span
                    className="body-sm"
                    style={{ fontFamily: "var(--font-mono)", color: "var(--text-body)", minWidth: 96, textAlign: "right" }}
                  >
                    {t.dashboard.wordsOf(lesson.wordsKnown, lesson.words)}
                  </span>
                </div>
              </Link>
            </li>
          );
        })}
      </ol>
    </Card>
  );
}

export default async function HomePage() {
  const user = await getUser();
  if (!user) redirect("/login");

  const [t, locale] = await Promise.all([getT(), getLocale()]);
  const m = t.dashboard;
  const timeZone = requestTimeZone();
  const [data, daily] = await Promise.all([
    getDashboard(user.id, locale),
    getDailyQuiz(user.id, localDate(timeZone), timeZone, locale),
  ]);
  const lessons = data.lessons;
  const levels = getLevelPath(locale);
  const built = levels.filter((l) => l.available);
  const unbuilt = levels.filter((l) => !l.available);

  const name = data.profile.display_name || user.username;
  const resume = data.resumeLesson ?? data.nextLesson;
  const current = data.levels.find((l) => l.level === data.currentLevel)!;

  // Accuracy across every answer ever recorded, not just this session.
  const progress = data.progress.words;
  let correct = 0;
  let attempts = 0;
  for (const p of progress.values()) {
    correct += p.correct_count;
    attempts += p.correct_count + p.incorrect_count;
  }
  const accuracy = attempts ? Math.round((correct / attempts) * 100) : 0;

  // The words getting missed most often — the honest part of a progress page.
  const words = getAllWords(undefined, locale);
  const trouble = [...progress.values()]
    .filter((p) => p.incorrect_count > 0)
    .sort((a, b) => b.incorrect_count - a.incorrect_count)
    .slice(0, 8)
    .map((p) => ({ row: p, word: words.find((w) => w.id === p.word_id) }))
    .filter((x) => x.word);

  const stats = [
    { label: m.wordsKnown, value: data.wordsKnown, sub: m.of(data.totalWords), icon: "file-text" },
    data.studyWriting
      ? { label: m.canWrite, value: data.kanjiWritten, sub: m.fromMemory, icon: "pen-line" }
      : { label: m.kanjiStarted, value: data.kanjiStarted, sub: m.of(data.totalKanji), icon: "grid-2x2" },
    { label: m.answeredToday, value: data.reviewedToday, sub: m.goal(data.profile.daily_goal), icon: "check" },
    { label: m.dayStreak, value: data.streak, sub: m.consecutiveDays, icon: "star" },
    { label: m.accuracy, value: `${accuracy}%`, sub: m.answersAllTime(attempts), icon: "chart-line" },
    { label: m.dueNow, value: data.dueNow, sub: m.waitingForReview, icon: "zap" },
  ];

  return (
    <div className="stack" style={{ gap: 48 }}>
      {/* ---- Hero -------------------------------------------------------- */}
      <section className="stack" style={{ gap: 24 }}>
        <div className="row" style={{ justifyContent: "space-between", gap: 24, flexWrap: "wrap" }}>
          <div>
            <p className="eyebrow">JLPT {data.currentLevel}</p>
            <h1
              style={{
                margin: "10px 0 0",
                fontSize: "var(--text-display-3)",
                letterSpacing: "var(--tracking-display)",
                lineHeight: "var(--leading-display)",
              }}
            >
              {m.greeting(name)}
            </h1>
          </div>
          {data.streak > 0 && (
            <Badge tone="soft" icon="zap">
              {m.streak(data.streak)}
            </Badge>
          )}
        </div>

        {/* Asked once, before it matters: it decides whether lessons end in
            writing. Existing accounts are asked too; until they answer they
            carry on with writing, as before. */}
        {data.profile.study_writing === null && (
          <Card tone="cream" pad="md" radius="lg">
            <div className="stack" style={{ gap: 16 }}>
              <div className="stack" style={{ gap: 6 }}>
                <h2 style={{ margin: 0, fontSize: "var(--text-heading-3)" }}>{m.writingTitle}</h2>
                <p className="body-sm" style={{ margin: 0, color: "var(--on-tint-body)", maxWidth: 560 }}>
                  {m.writingBody}
                </p>
              </div>
              <WritingSetting initial={null} />
            </div>
          </Card>
        )}

        <ContinueCard dueNow={data.dueNow} resume={resume} level={current} t={t} />
        <DailyQuizCard quiz={daily} t={t} />
      </section>

      {/* ---- The path ---------------------------------------------------- */}
      <section className="stack" style={{ gap: 20 }}>
        <div className="row" style={{ justifyContent: "space-between", gap: 16, flexWrap: "wrap", alignItems: "flex-end" }}>
          <div>
            <p className="eyebrow">{m.yourPath}</p>
            <h2 style={{ margin: "8px 0 0", fontSize: "var(--text-heading-1)" }}>
              {m.pathTitle(lessons.length, data.totalKanji)}
            </h2>
            <p className="body-sm muted" style={{ margin: "8px 0 0", maxWidth: 560 }}>
              {m.pathBody}
            </p>
          </div>
          <div className="row" style={{ gap: 14, flexWrap: "wrap" }}>
            {BANDS.map((band) => (
              <span key={band} className="row body-sm" style={{ gap: 6 }}>
                <span style={{ width: 10, height: 10, borderRadius: "var(--radius-full)", background: BAND_COLOUR[band] }} />
                {t.common.band[band]}
              </span>
            ))}
          </div>
        </div>

        {data.levels.map((level) => (
          <div key={level.level} className="stack" style={{ gap: 12 }}>
            <div className="row" style={{ justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
              <h3 style={{ margin: 0, fontSize: "var(--text-heading-4)" }}>
                {level.level} · {built.find((l) => l.level === level.level)?.title}
              </h3>
              <span className="body-sm" style={{ fontFamily: "var(--font-mono)", color: "var(--text-body)" }}>
                {m.levelKnown(level.kanjiKnown, level.totalKanji)}
              </span>
            </div>
            <LessonPath lessons={lessons.filter((l) => l.level === level.level)} next={resume?.slug ?? null} t={t} />
          </div>
        ))}
      </section>

      {/* ---- Numbers ----------------------------------------------------- */}
      <section className="grid grid-3">
        {stats.map((stat) => (
          <Card key={stat.label} tone="white" pad="md" radius="lg" bordered>
            <div className="stack" style={{ gap: 14 }}>
              <div
                className="row"
                style={{
                  width: 44,
                  height: 44,
                  borderRadius: "var(--radius-full)",
                  background: "var(--lime-500)",
                  justifyContent: "center",
                }}
              >
                <Icon name={stat.icon} size={20} color="var(--forest-800)" />
              </div>
              <div>
                <div
                  style={{
                    fontSize: "var(--text-stat-md)",
                    fontWeight: "var(--weight-extrabold)",
                    letterSpacing: "var(--tracking-stat)",
                    color: "var(--text-heading)",
                    lineHeight: 1,
                  }}
                >
                  {stat.value}
                </div>
                <div className="eyebrow" style={{ marginTop: 8 }}>
                  {stat.label}
                </div>
                <div className="body-sm muted">{stat.sub}</div>
              </div>
            </div>
          </Card>
        ))}
      </section>

      {/* ---- Activity and mastery ---------------------------------------- */}
      <section className="grid grid-split" style={{ gap: 20 }}>
        <Card tone="cream" pad="lg" radius="lg">
          <div className="stack" style={{ gap: 24 }}>
            <div>
              <p className="eyebrow">{m.last14Days}</p>
              <h3 style={{ margin: "8px 0 0", fontSize: "var(--text-heading-3)" }}>
                {m.cardsAnswered}
              </h3>
            </div>
            <BarChart data={data.activity} height={160} highlight="alternate" />
          </div>
        </Card>

        <Card tone="white" pad="lg" radius="lg" bordered>
          <div className="stack" style={{ gap: 24 }}>
            <div>
              <p className="eyebrow">{m.masteryEyebrow}</p>
              <h3 style={{ margin: "8px 0 0", fontSize: "var(--text-heading-3)" }}>{m.masteryTitle}</h3>
              <p className="body-sm muted" style={{ margin: "8px 0 0" }}>
                {m.masteryBody}
              </p>
            </div>

            <div style={{ display: "flex", height: 12, borderRadius: "var(--radius-full)", overflow: "hidden" }}>
              {BANDS.map((band) => (
                <span
                  key={band}
                  style={{
                    width: `${(data.bands[band] / Math.max(data.totalKanji, 1)) * 100}%`,
                    background: BAND_COLOUR[band],
                  }}
                />
              ))}
            </div>

            <div className="stack" style={{ gap: 12 }}>
              {BANDS.map((band) => (
                <div key={band} className="row" style={{ justifyContent: "space-between", gap: 12 }}>
                  <div className="row" style={{ gap: 10 }}>
                    <span
                      style={{
                        width: 10,
                        height: 10,
                        borderRadius: "var(--radius-full)",
                        background: BAND_COLOUR[band],
                      }}
                    />
                    <span className="body-sm">{t.common.band[band]}</span>
                  </div>
                  <span
                    className="body-sm"
                    style={{ fontFamily: "var(--font-mono)", color: "var(--text-heading)" }}
                  >
                    {data.bands[band]}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </Card>
      </section>

      {/* ---- Trouble words ----------------------------------------------- */}
      {trouble.length > 0 && (
        <section className="stack" style={{ gap: 20 }}>
          <div>
            <p className="eyebrow">{m.troubleEyebrow}</p>
            <h2 style={{ margin: "8px 0 0", fontSize: "var(--text-heading-1)" }}>
              {m.troubleTitle}
            </h2>
          </div>

          <div className="grid grid-4">
            {trouble.map(({ row, word }) => (
              <Card key={row.word_id} tone="white" pad="md" radius="md" bordered>
                <div className="stack" style={{ gap: 10 }}>
                  <div className="jp" style={{ fontSize: 26, color: "var(--text-heading)" }}>
                    {word!.word}
                  </div>
                  {word!.reading !== word!.word && (
                    <div className="jp body-sm muted">{word!.reading}</div>
                  )}
                  <div className="body-sm" style={{ color: "var(--text-heading)" }}>
                    {word!.meanings[0]}
                  </div>
                  <Badge tone="negative">
                    {m.misses(row.incorrect_count)}
                  </Badge>
                </div>
              </Card>
            ))}
          </div>
        </section>
      )}

      {/* ---- The road ahead ---------------------------------------------- */}
      <section className="stack" style={{ gap: 16 }}>
        <div>
          <p className="eyebrow">{m.beyond(built[built.length - 1].level)}</p>
          <h2 style={{ margin: "8px 0 0", fontSize: "var(--text-heading-2)" }}>{m.roadTitle}</h2>
          <p className="body-sm muted" style={{ margin: "8px 0 0", maxWidth: 620 }}>
            {m.roadBody(
              built.map((l) => l.level),
              unbuilt.map((l) => l.level),
            )}
          </p>
        </div>
        <div className="grid" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))" }}>
          {levels.map((entry) => (
            <Card key={entry.level} tone={entry.available ? "cream" : "white"} pad="sm" radius="md" bordered={!entry.available}>
              <div className="stack" style={{ gap: 6 }} title={entry.canDo}>
                <div className="row" style={{ gap: 8, justifyContent: "space-between" }}>
                  <strong style={{ color: entry.available ? "var(--on-tint-heading)" : "var(--text-heading)" }}>
                    {entry.level}
                  </strong>
                  <span
                    className="body-sm"
                    style={{
                      fontFamily: "var(--font-mono)",
                      color: entry.available ? "var(--on-tint-body)" : "var(--text-muted)",
                    }}
                  >
                    {entry.available ? m.kanjiCount(entry.kanji) : m.kanjiTarget(entry.kanjiTarget)}
                  </span>
                </div>
                <span className="body-sm" style={{ color: entry.available ? "var(--on-tint-body)" : "var(--text-muted)" }}>
                  {entry.available ? m.availableNow : m.notWrittenYet}
                </span>
              </div>
            </Card>
          ))}
        </div>
      </section>
    </div>
  );
}
