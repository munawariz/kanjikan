import Link from "next/link";
import { redirect } from "next/navigation";
import { getKanjiChar, getLessons, getLevelPath, levelStats } from "@/lib/content";
import { isDatabaseConfigured } from "@/lib/db";
import { getUser } from "@/lib/auth";
import { Button } from "@/components/atlas/core/Button.jsx";
import { Card } from "@/components/atlas/layout/Card.jsx";
import { Wordmark } from "@/components/app/Wordmark";
import { ThemeToggle } from "@/components/app/ThemeToggle";
import { LanguageToggle } from "@/components/app/LanguageToggle";
import { KanjiAnatomy } from "@/components/app/KanjiAnatomy";
import { getLocale, getT } from "@/lib/i18n/server";

export const dynamic = "force-dynamic";

const REPO_URL = "https://github.com/munawariz/kanjikan";
const ISSUES_URL = `${REPO_URL}/issues`;

/**
 * The front door, written for someone who is finding kanji hard — not sold to
 * them. It says plainly what the app does and does not do, shows one real
 * kanji the way a lesson teaches it, and is upfront that the content was made
 * with AI and can only be checked so far.
 */
export default async function LandingPage() {
  if (isDatabaseConfigured && (await getUser())) redirect("/dashboard");

  const [t, locale] = await Promise.all([getT(), getLocale()]);
  const stats = levelStats();
  const levels = getLevelPath(locale);
  const built = levels.filter((l) => l.available);
  const unbuilt = levels.filter((l) => !l.available);
  const first = getLessons(undefined, locale)[0];
  // A real entry from the content, so the example is exactly what a lesson shows.
  const example = getKanjiChar("休", locale);

  return (
    <main>
      <header style={{ borderBottom: "1px solid var(--border-subtle)" }}>
        <div className="page row" style={{ height: 72, justifyContent: "space-between", gap: 16 }}>
          <Wordmark size={22} />
          <div className="row" style={{ gap: 12 }}>
            <LanguageToggle />
            <ThemeToggle />
            <Link href="/login" className="reset-link">
              <Button variant="outline" size="sm" shape="pill">
                {t.home.signIn}
              </Button>
            </Link>
          </div>
        </div>
      </header>

      <div className="page">
        <div className="stack" style={{ gap: 72, maxWidth: 720, paddingTop: 64, paddingBottom: 88 }}>
          {/* ---- What this is ------------------------------------------------ */}
          <section className="stack" style={{ gap: 20 }}>
            <p className="eyebrow" style={{ margin: 0 }}>
              {t.home.eyebrow(built.map((l) => l.level))}
            </p>
            <h1
              style={{
                margin: 0,
                fontSize: "var(--text-display-3)",
                letterSpacing: "var(--tracking-display)",
                lineHeight: "var(--leading-display)",
              }}
            >
              {t.home.title}
            </h1>
            <p style={{ margin: 0, fontSize: "var(--text-body-lg)" }}>
              {t.home.intro}
            </p>
            <p style={{ margin: 0 }}>
              {t.home.noAccount}
            </p>
            <div className="row" style={{ gap: 12, flexWrap: "wrap", marginTop: 4 }}>
              <Link href={`/lessons/${first.slug}`} className="reset-link">
                <Button variant="primary" size="lg" icon="chevron-right">
                  {t.home.startLesson1}
                </Button>
              </Link>
              <Link href="/lessons" className="reset-link">
                <Button variant="outline" size="lg">
                  {t.home.seeAllLessons}
                </Button>
              </Link>
            </div>
          </section>

          {/* ---- How it tries to help ---------------------------------------- */}
          <section className="stack" style={{ gap: 24 }}>
            <h2 style={{ margin: 0, fontSize: "var(--text-heading-1)" }}>{t.home.howTitle}</h2>
            <ol className="stack" style={{ gap: 18, margin: 0, paddingLeft: 22 }}>
              {t.home.how.map(([title, body]) => (
                <li key={title} style={{ paddingLeft: 6 }}>
                  <strong style={{ color: "var(--text-heading)" }}>{title}</strong> {body}
                </li>
              ))}
            </ol>
          </section>

          {/* ---- One real example -------------------------------------------- */}
          {example && (
            <section className="stack" style={{ gap: 20 }}>
              <div className="stack" style={{ gap: 8 }}>
                <h2 style={{ margin: 0, fontSize: "var(--text-heading-2)" }}>{t.home.exampleTitle}</h2>
                <p style={{ margin: 0 }}>{t.home.exampleIntro(example.char, example.lessonOrder)}</p>
              </div>
              <Card tone="white" pad="md" radius="lg" bordered>
                <div className="row" style={{ gap: 24, alignItems: "flex-start", flexWrap: "wrap" }}>
                  <div className="stack" style={{ gap: 6, alignItems: "center", minWidth: 96 }}>
                    <span className="jp" style={{ fontSize: 72, lineHeight: 1, color: "var(--text-heading)" }}>
                      {example.char}
                    </span>
                    <span className="body-sm" style={{ color: "var(--text-heading)" }}>
                      {example.meanings[0]}
                    </span>
                    <span className="jp body-sm muted">
                      {[...example.kunyomi, ...example.onyomi].join("・")}
                    </span>
                  </div>
                  <div style={{ flex: "1 1 280px", minWidth: 0 }}>
                    <KanjiAnatomy kanji={example} variant="teach" />
                  </div>
                </div>
              </Card>
            </section>
          )}

          {/* ---- What is here, and what is not ------------------------------- */}
          <section className="stack" style={{ gap: 20 }}>
            <h2 style={{ margin: 0, fontSize: "var(--text-heading-2)" }}>{t.home.hereTitle}</h2>
            <ul className="stack" style={{ gap: 12, margin: 0, paddingLeft: 22 }}>
              <li>{t.home.hereContent(built, stats.lessons, stats.words)}</li>
              {unbuilt.length > 0 && (
                <li>{t.home.hereUnbuilt(unbuilt.map((l) => l.level))}</li>
              )}
              <li>{t.home.hereFree}</li>
              <li>{t.home.hereAccount}</li>
            </ul>
          </section>

          {/* ---- A note on accuracy ------------------------------------------ */}
          <section>
            <Card tone="sage" pad="lg" radius="lg">
              <div className="stack" style={{ gap: 16 }}>
                <h2 style={{ margin: 0, fontSize: "var(--text-heading-2)", color: "var(--on-tint-heading)" }}>
                  {t.home.accuracyTitle}
                </h2>
                <p style={{ margin: 0, color: "var(--on-tint-heading)" }}>
                  {t.home.accuracy1}
                </p>
                <p style={{ margin: 0, color: "var(--on-tint-heading)" }}>
                  {t.home.accuracy2}
                </p>
                <p style={{ margin: 0, color: "var(--on-tint-heading)" }}>
                  {t.home.accuracy3}
                </p>
                <div className="row" style={{ gap: 12, flexWrap: "wrap", marginTop: 4 }}>
                  <a href={ISSUES_URL} target="_blank" rel="noopener noreferrer" className="reset-link">
                    <Button variant="primary" size="md" icon="arrow-up-right">
                      {t.home.openIssue}
                    </Button>
                  </a>
                </div>
              </div>
            </Card>
          </section>
        </div>
      </div>

      <footer style={{ borderTop: "1px solid var(--border-subtle)" }}>
        <div
          className="page row body-sm"
          style={{ paddingTop: 28, paddingBottom: 28, justifyContent: "space-between", gap: 16, flexWrap: "wrap" }}
        >
          <Wordmark size={18} />
          {/* KanjiVG is CC BY-SA 3.0 and requires attribution wherever the
              stroke data is used. See data/jlpt/STROKES-LICENSE.md. */}
          <span className="muted">
            {t.home.strokesFrom}{" "}
            <a href="https://kanjivg.tagaini.net" target="_blank" rel="noopener noreferrer">
              KanjiVG
            </a>
            {t.home.strokesLicence}{" "}
            <a href={REPO_URL} target="_blank" rel="noopener noreferrer">
              {t.home.source}
            </a>
          </span>
        </div>
      </footer>
    </main>
  );
}
