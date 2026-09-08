import Link from "next/link";
import { redirect } from "next/navigation";
import { getUser } from "@/lib/supabase/server";
import { getDashboard, getLessonSummaries } from "@/lib/progress";
import { levelStats } from "@/lib/content";
import { BAND_LABEL, type MasteryBand } from "@/lib/srs";
import { Badge } from "@/components/atlas/core/Badge.jsx";
import { Button } from "@/components/atlas/core/Button.jsx";
import { Card } from "@/components/atlas/layout/Card.jsx";
import { Icon } from "@/components/atlas/core/Icon.jsx";
import { Sparkle } from "@/components/atlas/core/Sparkle.jsx";
import { BarChart } from "@/components/atlas/data/BarChart.jsx";
import { LessonCard } from "@/components/app/LessonCard";

export const metadata = { title: "Dashboard — Kanjikan" };
export const dynamic = "force-dynamic";

const BAND_COLOUR: Record<MasteryBand, string> = {
  new: "var(--band-new)",
  learning: "var(--band-learning)",
  known: "var(--band-known)",
  mastered: "var(--band-mastered)",
};

export default async function DashboardPage() {
  const user = await getUser();
  if (!user) redirect("/login");

  const data = await getDashboard(user.id);
  const lessons = await getLessonSummaries();
  const stats = levelStats("N5");

  const name = data.profile.display_name || user.email?.split("@")[0] || "there";
  const resume = data.resumeLesson ?? data.nextLesson;
  const upNext = lessons.filter((l) => l.status !== "completed").slice(0, 3);
  const percent = Math.round((data.kanjiKnown / Math.max(data.totalKanji, 1)) * 100);

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

        <Card tone="forest" pad="lg" radius="lg">
          <div
            className="row"
            style={{ gap: 40, justifyContent: "space-between", flexWrap: "wrap", alignItems: "flex-end" }}
          >
            <div className="stack" style={{ gap: 16, maxWidth: 480 }}>
              <div className="row" style={{ gap: 10 }}>
                <Sparkle size={16} color="var(--lime-500)" />
                <span className="eyebrow" style={{ color: "var(--lime-500)" }}>
                  {data.dueNow > 0 ? "Reviews waiting" : resume ? "Pick up where you left off" : "All caught up"}
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
                {data.dueNow > 0
                  ? `${data.dueNow} ${data.dueNow === 1 ? "word is" : "words are"} ready for review.`
                  : resume
                    ? resume.title
                    : "Every N5 kanji is scheduled."}
              </h2>

              <p style={{ margin: 0, color: "var(--forest-200)" }}>
                {data.dueNow > 0
                  ? "Clear these first. Reviews are what move a word from recognised to known."
                  : resume
                    ? resume.summary
                    : "Nothing is due right now. Come back later, or start a new lesson early."}
              </p>

              <div className="row" style={{ gap: 12, flexWrap: "wrap", marginTop: 8 }}>
                {data.dueNow > 0 && (
                  <Link href="/review" className="reset-link">
                    <Button variant="accent" size="lg" icon="zap" iconPosition="left">
                      Start Review
                    </Button>
                  </Link>
                )}
                {resume && (
                  <Link href={`/lessons/${resume.slug}/study`} className="reset-link">
                    <Button
                      variant={data.dueNow > 0 ? "outline-inverse" : "accent"}
                      size="lg"
                      icon="chevron-right"
                    >
                      {resume.status === "learning" ? "Continue Lesson" : "Start Lesson"}
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
              <div
                className="meter"
                style={{ background: "rgba(255,255,255,.16)", marginTop: 10, width: 200 }}
              >
                <span style={{ width: `${percent}%`, background: "var(--lime-500)" }} />
              </div>
              <div className="body-sm" style={{ color: "var(--forest-200)", marginTop: 6 }}>
                {data.kanjiKnown} of {data.totalKanji} kanji
              </div>
            </div>
          </div>
        </Card>
      </section>

      {/* ---- Numbers ----------------------------------------------------- */}
      <section className="grid grid-4">
        {[
          { label: "Kanji started", value: data.kanjiStarted, sub: `of ${stats.kanji}`, icon: "grid-2x2" },
          { label: "Can write", value: data.kanjiWritten, sub: "from memory", icon: "file-text" },
          { label: "Answered today", value: data.reviewedToday, sub: `goal ${data.profile.daily_goal}`, icon: "check" },
          { label: "Day streak", value: data.streak, sub: "consecutive days", icon: "star" },
        ].map((stat) => (
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
      <section className="grid" style={{ gridTemplateColumns: "minmax(0, 3fr) minmax(0, 2fr)", gap: 20 }}>
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

      {/* ---- Up next ----------------------------------------------------- */}
      {upNext.length > 0 && (
        <section className="stack" style={{ gap: 24 }}>
          <div className="row" style={{ justifyContent: "space-between", gap: 16, flexWrap: "wrap" }}>
            <div>
              <p className="eyebrow">Up next</p>
              <h2 style={{ margin: "8px 0 0", fontSize: "var(--text-heading-1)" }}>
                Keep working through N5
              </h2>
            </div>
            <Link href="/lessons" className="reset-link">
              <Button variant="outline" size="md" icon="chevron-right">
                All Lessons
              </Button>
            </Link>
          </div>

          <div className="grid grid-3">
            {upNext.map((lesson, i) => (
              <LessonCard key={lesson.slug} lesson={lesson} index={i} />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
