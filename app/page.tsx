import Link from "next/link";
import { redirect } from "next/navigation";
import { getLevelPath, levelStats } from "@/lib/content";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { getUser } from "@/lib/supabase/server";
import { Button } from "@/components/atlas/core/Button.jsx";
import { Card } from "@/components/atlas/layout/Card.jsx";
import { Badge } from "@/components/atlas/core/Badge.jsx";
import { Icon } from "@/components/atlas/core/Icon.jsx";
import { Sparkle } from "@/components/atlas/core/Sparkle.jsx";
import { Wordmark } from "@/components/app/Wordmark";
import { ThemeToggle } from "@/components/app/ThemeToggle";

export const dynamic = "force-dynamic";

export default async function LandingPage() {
  if (isSupabaseConfigured && (await getUser())) redirect("/dashboard");

  const stats = levelStats("N5");
  const path = getLevelPath();

  return (
    <main>
      <header style={{ borderBottom: "1px solid var(--border-subtle)" }}>
        <div className="page row" style={{ height: 84, justifyContent: "space-between", gap: 24 }}>
          <Wordmark size={24} />
          <div className="row" style={{ gap: 12 }}>
            <ThemeToggle />
            <Link href="/login" className="reset-link">
              <Button variant="primary" size="sm" shape="pill">
                Sign In
              </Button>
            </Link>
          </div>
        </div>
      </header>

      {/* ---- Hero ---------------------------------------------------------- */}
      <section className="page" style={{ paddingTop: 96, paddingBottom: 104, position: "relative" }}>
        <div
          aria-hidden
          style={{
            position: "absolute",
            top: 40,
            left: "45%",
            // Capped to the viewport: at 520px fixed it reached 682px on a
            // 360px screen, and only overflow-x:hidden was keeping that off
            // the page. Decorative, but nothing should rely on being clipped.
            width: "min(520px, 55vw)",
            height: "min(520px, 55vw)",
            background: "var(--glow-lime)",
            pointerEvents: "none",
          }}
        />
        <div style={{ position: "relative", maxWidth: 760 }}>
          <div className="row" style={{ gap: 10, marginBottom: 24 }}>
            <Sparkle size={18} color="var(--forest-800)" />
            <span className="eyebrow" style={{ color: "var(--forest-800)" }}>
              JLPT N5 · {stats.kanji} kanji
            </span>
          </div>

          <h1
            style={{
              margin: 0,
              fontSize: "var(--text-display-1)",
              letterSpacing: "var(--tracking-display)",
              lineHeight: "var(--leading-display)",
            }}
          >
            Remember Every N5 Kanji.
          </h1>

          <p style={{ marginTop: 28, maxWidth: 520, fontSize: "var(--text-body-lg)" }}>
            All {stats.kanji} JLPT N5 characters, across {stats.lessons} lessons of five. Each comes with
            its stroke order, its readings, and the {stats.words} words that fix those readings in
            place — because a kanji learned alone is a kanji forgotten.
          </p>

          <div className="row" style={{ gap: 12, marginTop: 36, flexWrap: "wrap" }}>
            <Link href="/login" className="reset-link">
              <Button variant="accent" size="lg" icon="chevron-right">
                Start Learning
              </Button>
            </Link>
            <Link href="/lessons" className="reset-link">
              <Button variant="outline" size="lg">
                Try a Lesson First
              </Button>
            </Link>
          </div>
          <p className="body-sm muted" style={{ marginTop: 16 }}>
            No account needed to try one. Your progress is only saved once you sign in.
          </p>
        </div>
      </section>

      {/* ---- Proof numbers ------------------------------------------------- */}
      <section style={{ background: "var(--forest-800)" }}>
        <div className="page row" style={{ paddingTop: 56, paddingBottom: 56, gap: 40, flexWrap: "wrap" }}>
          {[
            [String(stats.kanji), "N5 kanji"],
            [String(stats.lessons), "Lessons of five"],
            [String(stats.words), "Words that teach them"],
            ["8", "Review stages"],
          ].map(([value, label]) => (
            <div key={label}>
              <div
                style={{
                  fontSize: "var(--text-stat-md)",
                  fontWeight: "var(--weight-extrabold)",
                  letterSpacing: "var(--tracking-stat)",
                  color: "var(--lime-500)",
                  lineHeight: 1,
                }}
              >
                {value}
              </div>
              <div className="eyebrow" style={{ marginTop: 8, color: "var(--forest-200)" }}>
                {label}
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* ---- Features ------------------------------------------------------ */}
      <section className="page" style={{ paddingTop: 104, paddingBottom: 104 }}>
        <div style={{ maxWidth: 620, marginBottom: 48 }}>
          <p className="eyebrow">How it works</p>
          <h2
            style={{
              margin: "12px 0 0",
              fontSize: "var(--text-display-3)",
              letterSpacing: "var(--tracking-display)",
              lineHeight: "var(--leading-display)",
            }}
          >
            Three Ideas, No Ceremony.
          </h2>
        </div>

        <div className="grid grid-3">
          {[
            {
              icon: "grid-2x2",
              title: "Five kanji at a time.",
              body: "A lesson introduces five characters and nothing else. You meet each one, read the words built from it, then write it from memory before the next one starts.",
              tone: "cream" as const,
            },
            {
              icon: "file-text",
              title: "Stroke order, then your hand.",
              body: "Every character animates stroke by stroke, then you draw it on a ruled grid from memory. Recognising a kanji and being able to write it are different skills, and they are tracked separately.",
              tone: "sage" as const,
            },
            {
              icon: "zap",
              title: "Reviews find the gaps.",
              body: "Eight scheduling stages, from ten minutes to three months. Get a character right and it moves out of the way. Get it wrong and it comes back before you leave the session.",
              tone: "cream" as const,
            },
          ].map((f) => (
            <Card key={f.title} tone={f.tone} pad="lg" radius="lg">
              <div className="stack" style={{ gap: 20 }}>
                <div
                  className="row"
                  style={{
                    width: 54,
                    height: 54,
                    borderRadius: "var(--radius-full)",
                    background: "var(--lime-500)",
                    justifyContent: "center",
                  }}
                >
                  <Icon name={f.icon} size={26} color="var(--forest-800)" />
                </div>
                <h3 style={{ margin: 0, fontSize: "var(--text-heading-3)" }}>{f.title}</h3>
                <p className="body-sm" style={{ margin: 0, color: "var(--on-tint-body)" }}>
                  {f.body}
                </p>
              </div>
            </Card>
          ))}
        </div>
      </section>

      {/* ---- Levels -------------------------------------------------------- */}
      <section className="page" style={{ paddingBottom: 104 }}>
        <Card tone="cream" pad="lg" radius="lg">
          <div className="stack" style={{ gap: 28 }}>
            <div>
              <p className="eyebrow" style={{ color: "var(--on-tint-body)" }}>
                The roadmap
              </p>
              <h2 style={{ margin: "10px 0 0", fontSize: "var(--text-heading-1)" }}>
                N5 today. Four levels mapped behind it.
              </h2>
            </div>

            <div className="grid grid-4" style={{ gap: 12 }}>
              {path.map((l) => (
                <div
                  key={l.level}
                  style={{
                    padding: 20,
                    borderRadius: "var(--radius-md)",
                    background: l.available ? "var(--surface-inverse)" : "var(--surface-card)",
                  }}
                >
                  <div
                    style={{
                      fontSize: "var(--text-heading-2)",
                      fontWeight: "var(--weight-extrabold)",
                      letterSpacing: "var(--tracking-heading)",
                      color: l.available ? "var(--lime-500)" : "var(--text-heading)",
                    }}
                  >
                    {l.level}
                  </div>
                  <div
                    className="body-sm"
                    style={{
                      marginTop: 8,
                      color: l.available ? "var(--forest-200)" : "var(--text-muted)",
                    }}
                  >
                    {l.available ? `${l.kanji} kanji` : `~${l.kanjiTarget} kanji`}
                  </div>
                  <div style={{ marginTop: 14 }}>
                    <Badge tone={l.available ? "accent" : "sage"}>
                      {l.available ? "Available now" : "Planned"}
                    </Badge>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </Card>
      </section>

      <footer style={{ background: "var(--forest-800)" }}>
        <div
          className="page row"
          style={{ paddingTop: 40, paddingBottom: 40, justifyContent: "space-between", gap: 20, flexWrap: "wrap" }}
        >
          <Wordmark tone="inverse" size={20} />
          {/* KanjiVG is CC BY-SA 3.0 and requires attribution wherever the
              stroke data is used. See data/jlpt/STROKES-LICENSE.md. */}
          <span className="body-sm" style={{ color: "var(--forest-200)" }}>
            Kanji and vocabulary ship with the app. Stroke order from{" "}
            <a
              href="https://kanjivg.tagaini.net"
              target="_blank"
              rel="noopener noreferrer"
              style={{ color: "var(--lime-500)" }}
            >
              KanjiVG
            </a>
            , CC BY-SA 3.0.
          </span>
        </div>
      </footer>
    </main>
  );
}
