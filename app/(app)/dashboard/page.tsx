import Link from "next/link";
import { redirect } from "next/navigation";
import { getUser } from "@/lib/auth";
import { getDailyQuiz, getDashboard, type DailyQuiz, type LessonSummary } from "@/lib/progress";
import { getAllWords, getLevelPath } from "@/lib/content";
import { DAILY_QUIZ_SIZE, localDate, requestTimeZone } from "@/lib/daily";
import { BAND_LABEL, type MasteryBand } from "@/lib/srs";
import { Badge } from "@/components/atlas/core/Badge.jsx";
import { Button } from "@/components/atlas/core/Button.jsx";
import { Card } from "@/components/atlas/layout/Card.jsx";
import { Icon } from "@/components/atlas/core/Icon.jsx";
import { Sparkle } from "@/components/atlas/core/Sparkle.jsx";
import { BarChart } from "@/components/atlas/data/BarChart.jsx";
import { WritingSetting } from "@/components/app/StudySettings";

export const dynamic = "force-dynamic";

const BAND_COLOUR: Record<MasteryBand, string> = {
  new: "var(--band-new)",
  learning: "var(--band-learning)",
  known: "var(--band-known)",
  mastered: "var(--band-mastered)",
};

/**
 * Today's quiz in one line: locked, waiting, half done, or done with a score.
 * Home is where a day starts, so this is where the quiz is found — it has no
 * tab of its own, since five already only just fit on a phone.
 */
function DailyQuizCard({ quiz }: { quiz: DailyQuiz }) {
  const locked = quiz.questions.length === 0;
  const answered = quiz.answers.length;
  const finished = !locked && answered >= quiz.questions.length;
  const correct = quiz.answers.filter((a) => a.correct).length;

  const [title, body] = locked
    ? [
        "Daily quiz",
        `Unlocks once you have learned ${DAILY_QUIZ_SIZE} kanji — you have ${quiz.learned}. A character joins the day after you first study it.`,
      ]
    : finished
      ? [`Today’s quiz: ${correct} of ${answered} correct`, "Five new questions tomorrow."]
      : answered > 0
        ? [`Daily quiz: ${answered} of ${quiz.questions.length} answered`, "Finish today’s questions."]
        : ["Daily quiz", `${DAILY_QUIZ_SIZE} questions on kanji you have already learned. One try each.`];

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
              {finished ? "See Results" : answered > 0 ? "Continue Quiz" : "Take Today’s Quiz"}
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
  percent,
  known,
  total,
}: {
  dueNow: number;
  resume: LessonSummary | null;
  percent: number;
  known: number;
  total: number;
}) {
  const lessonLabel = resume?.status === "learning" ? "Continue Lesson" : "Start Lesson";

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
              {dueNow > 0 ? "Next: reviews" : resume ? `Next: lesson ${resume.order}` : "All caught up"}
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
              ? `${dueNow} ${dueNow === 1 ? "review is" : "reviews are"} ready.`
              : resume
                ? resume.title
                : "Every N5 lesson is done."}
          </h2>

          <p style={{ margin: 0, color: "var(--forest-200)" }}>
            {dueNow > 0
              ? `Clear these first, then ${resume ? `carry on with ${resume.title}` : "you are done for now"}. Reviews are what turn a word you have met into one you know.`
              : resume
                ? resume.summary
                : "Nothing is due right now. Come back later for reviews, or practise any kanji you like."}
          </p>

          <div className="row" style={{ gap: 12, flexWrap: "wrap", marginTop: 8 }}>
            {dueNow > 0 && (
              <Link href="/review" className="reset-link">
                <Button variant="accent" size="lg" icon="zap" iconPosition="left">
                  Continue: Review
                </Button>
              </Link>
            )}
            {resume && (
              <Link href={`/lessons/${resume.slug}/study`} className="reset-link">
                <Button variant={dueNow > 0 ? "outline-inverse" : "accent"} size="lg" icon="chevron-right">
                  {dueNow > 0 ? lessonLabel : `Continue: ${lessonLabel}`}
                </Button>
              </Link>
            )}
            {dueNow === 0 && !resume && (
              <Link href="/practice" className="reset-link">
                <Button variant="accent" size="lg" icon="chevron-right">
                  Practise
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
            N5 kanji known
          </div>
          <div className="meter" style={{ background: "rgba(255,255,255,.16)", marginTop: 10, width: 200 }}>
            <span style={{ width: `${percent}%`, background: "var(--lime-500)" }} />
          </div>
          <div className="body-sm" style={{ color: "var(--forest-200)", marginTop: 6 }}>
            {known} of {total} kanji
          </div>
        </div>
      </div>
    </Card>
  );
}

/**
 * The learning path: every lesson in order, each showing how its five kanji
 * stand. A kanji's mark fills in as most of its words become known and falls
 * back if they slip, so the path shows where the work is, not just what has
 * been started.
 */
function LessonPath({ lessons, next }: { lessons: LessonSummary[]; next: string | null }) {
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
                        title={`${char}: ${BAND_LABEL[lesson.bands[k]]}`}
                        style={{
                          display: "inline-flex",
                          alignItems: "center",
                          justifyContent: "center",
                          width: 30,
                          height: 30,
                          fontSize: 17,
                          lineHeight: 1,
                          color: "var(--text-heading)",
                          borderRadius: "var(--radius-sm)",
                          background: "var(--surface-sunken)",
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
                  {isNext && <Badge tone="accent">Next</Badge>}
                  {lesson.due > 0 && <Badge tone="warning">{lesson.due} due</Badge>}
                  <span
                    className="body-sm"
                    style={{ fontFamily: "var(--font-mono)", color: "var(--text-body)", minWidth: 96, textAlign: "right" }}
                  >
                    {lesson.wordsKnown}/{lesson.words} words
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

  const timeZone = requestTimeZone();
  const [data, daily] = await Promise.all([
    getDashboard(user.id),
    getDailyQuiz(user.id, localDate(timeZone), timeZone),
  ]);
  const lessons = data.lessons;
  const levels = getLevelPath();

  const name = data.profile.display_name || user.username;
  const resume = data.resumeLesson ?? data.nextLesson;
  const percent = Math.round((data.kanjiKnown / Math.max(data.totalKanji, 1)) * 100);

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
  const words = getAllWords();
  const trouble = [...progress.values()]
    .filter((p) => p.incorrect_count > 0)
    .sort((a, b) => b.incorrect_count - a.incorrect_count)
    .slice(0, 8)
    .map((p) => ({ row: p, word: words.find((w) => w.id === p.word_id) }))
    .filter((x) => x.word);

  const stats = [
    { label: "Words known", value: data.wordsKnown, sub: `of ${data.totalWords}`, icon: "file-text" },
    data.studyWriting
      ? { label: "Can write", value: data.kanjiWritten, sub: "from memory", icon: "pen-line" }
      : { label: "Kanji started", value: data.kanjiStarted, sub: `of ${data.totalKanji}`, icon: "grid-2x2" },
    { label: "Answered today", value: data.reviewedToday, sub: `goal ${data.profile.daily_goal}`, icon: "check" },
    { label: "Day streak", value: data.streak, sub: "consecutive days", icon: "star" },
    { label: "Accuracy", value: `${accuracy}%`, sub: `${attempts} answers, all time`, icon: "chart-line" },
    { label: "Due now", value: data.dueNow, sub: "waiting for review", icon: "zap" },
  ];

  return (
    <div className="stack" style={{ gap: 48 }}>
      {/* ---- Hero -------------------------------------------------------- */}
      <section className="stack" style={{ gap: 24 }}>
        <div className="row" style={{ justifyContent: "space-between", gap: 24, flexWrap: "wrap" }}>
          <div>
            <p className="eyebrow">JLPT N5</p>
            <h1
              style={{
                margin: "10px 0 0",
                fontSize: "var(--text-display-3)",
                letterSpacing: "var(--tracking-display)",
                lineHeight: "var(--leading-display)",
              }}
            >
              Good to see you, {name}.
            </h1>
          </div>
          {data.streak > 0 && (
            <Badge tone="soft" icon="zap">
              {data.streak} day streak
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
                <h2 style={{ margin: 0, fontSize: "var(--text-heading-3)" }}>What are you learning for?</h2>
                <p className="body-sm" style={{ margin: 0, color: "var(--on-tint-body)", maxWidth: 560 }}>
                  Reading is enough for travel and for most everyday Japanese. Choose writing too if you
                  want to draw each kanji from memory. You can change this at any time in Settings.
                </p>
              </div>
              <WritingSetting initial={null} />
            </div>
          </Card>
        )}

        <ContinueCard
          dueNow={data.dueNow}
          resume={resume}
          percent={percent}
          known={data.kanjiKnown}
          total={data.totalKanji}
        />
        <DailyQuizCard quiz={daily} />
      </section>

      {/* ---- The path ---------------------------------------------------- */}
      <section className="stack" style={{ gap: 20 }}>
        <div className="row" style={{ justifyContent: "space-between", gap: 16, flexWrap: "wrap", alignItems: "flex-end" }}>
          <div>
            <p className="eyebrow">Your path</p>
            <h2 style={{ margin: "8px 0 0", fontSize: "var(--text-heading-1)" }}>
              {lessons.length} lessons, five kanji each
            </h2>
            <p className="body-sm muted" style={{ margin: "8px 0 0", maxWidth: 560 }}>
              The line under each kanji shows how well you know it. Take them in order, or open any
              lesson: nothing is locked.
            </p>
          </div>
          <div className="row" style={{ gap: 14, flexWrap: "wrap" }}>
            {(Object.keys(BAND_LABEL) as MasteryBand[]).map((band) => (
              <span key={band} className="row body-sm" style={{ gap: 6 }}>
                <span style={{ width: 10, height: 10, borderRadius: "var(--radius-full)", background: BAND_COLOUR[band] }} />
                {BAND_LABEL[band]}
              </span>
            ))}
          </div>
        </div>

        <LessonPath lessons={lessons} next={resume?.slug ?? null} />
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
              <p className="eyebrow">Last 14 days</p>
              <h3 style={{ margin: "8px 0 0", fontSize: "var(--text-heading-3)" }}>
                Cards answered
              </h3>
            </div>
            <BarChart data={data.activity} height={160} highlight="alternate" />
          </div>
        </Card>

        <Card tone="white" pad="lg" radius="lg" bordered>
          <div className="stack" style={{ gap: 24 }}>
            <div>
              <p className="eyebrow">Where your kanji sit</p>
              <h3 style={{ margin: "8px 0 0", fontSize: "var(--text-heading-3)" }}>Kanji mastery</h3>
              <p className="body-sm muted" style={{ margin: "8px 0 0" }}>
                A kanji counts as known once most of its words are known — each has survived a
                week-long gap, or you marked it as one you already knew.
              </p>
            </div>

            <div style={{ display: "flex", height: 12, borderRadius: "var(--radius-full)", overflow: "hidden" }}>
              {(Object.keys(BAND_LABEL) as MasteryBand[]).map((band) => (
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
              {(Object.keys(BAND_LABEL) as MasteryBand[]).map((band) => (
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
                    <span className="body-sm">{BAND_LABEL[band]}</span>
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
            <p className="eyebrow">Needs another look</p>
            <h2 style={{ margin: "8px 0 0", fontSize: "var(--text-heading-1)" }}>
              The words tripping you up
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
                    {row.incorrect_count} {row.incorrect_count === 1 ? "miss" : "misses"}
                  </Badge>
                </div>
              </Card>
            ))}
          </div>
        </section>
      )}

      {/* ---- Beyond N5 --------------------------------------------------- */}
      <section className="stack" style={{ gap: 16 }}>
        <div>
          <p className="eyebrow">Beyond N5</p>
          <h2 style={{ margin: "8px 0 0", fontSize: "var(--text-heading-2)" }}>The road ahead</h2>
          <p className="body-sm muted" style={{ margin: "8px 0 0", maxWidth: 620 }}>
            N5 is built. The other levels are mapped but not written yet. Their counts are community
            estimates, because the JLPT has published no official kanji list since 2010.
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
                    {entry.available ? `${entry.kanji} kanji` : `~${entry.kanjiTarget} kanji`}
                  </span>
                </div>
                <span className="body-sm" style={{ color: entry.available ? "var(--on-tint-body)" : "var(--text-muted)" }}>
                  {entry.available ? "Available now" : "Not written yet"}
                </span>
              </div>
            </Card>
          ))}
        </div>
      </section>
    </div>
  );
}
