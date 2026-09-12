import Link from "next/link";
import { redirect } from "next/navigation";
import { getKanjiChar, getLessons, levelStats } from "@/lib/content";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { getUser } from "@/lib/supabase/server";
import { Button } from "@/components/atlas/core/Button.jsx";
import { Card } from "@/components/atlas/layout/Card.jsx";
import { Wordmark } from "@/components/app/Wordmark";
import { ThemeToggle } from "@/components/app/ThemeToggle";
import { KanjiAnatomy } from "@/components/app/KanjiAnatomy";

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
  if (isSupabaseConfigured && (await getUser())) redirect("/dashboard");

  const stats = levelStats("N5");
  const first = getLessons("N5")[0];
  // A real entry from the content, so the example is exactly what a lesson shows.
  const example = getKanjiChar("休");

  return (
    <main>
      <header style={{ borderBottom: "1px solid var(--border-subtle)" }}>
        <div className="page row" style={{ height: 72, justifyContent: "space-between", gap: 16 }}>
          <Wordmark size={22} />
          <div className="row" style={{ gap: 12 }}>
            <ThemeToggle />
            <Link href="/login" className="reset-link">
              <Button variant="outline" size="sm" shape="pill">
                Sign In
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
              A free study aid for the JLPT N5 kanji
            </p>
            <h1
              style={{
                margin: 0,
                fontSize: "var(--text-display-3)",
                letterSpacing: "var(--tracking-display)",
                lineHeight: "var(--leading-display)",
              }}
            >
              For anyone who finds kanji hard to remember.
            </h1>
            <p style={{ margin: 0, fontSize: "var(--text-body-lg)" }}>
              If you have ever learned a kanji on Monday and lost it by Wednesday, you are not alone.
              Kanjikan goes slowly: five kanji a lesson. It shows how each one is built, gives you a
              short story to hang it on, teaches the everyday words that use it, and brings it back
              for review before you forget.
            </p>
            <p style={{ margin: 0 }}>
              You do not need an account to take the lessons. Sign in only if you want your progress
              remembered.
            </p>
            <div className="row" style={{ gap: 12, flexWrap: "wrap", marginTop: 4 }}>
              <Link href={`/lessons/${first.slug}`} className="reset-link">
                <Button variant="primary" size="lg" icon="chevron-right">
                  Start with Lesson 1
                </Button>
              </Link>
              <Link href="/lessons" className="reset-link">
                <Button variant="outline" size="lg">
                  See All Lessons
                </Button>
              </Link>
            </div>
          </section>

          {/* ---- How it tries to help ---------------------------------------- */}
          <section className="stack" style={{ gap: 24 }}>
            <h2 style={{ margin: 0, fontSize: "var(--text-heading-1)" }}>How it tries to help</h2>
            <ol className="stack" style={{ gap: 18, margin: 0, paddingLeft: 22 }}>
              {[
                [
                  "A few at a time.",
                  "Each lesson has five kanji, and each one is finished — seen, used in words, quizzed, then written — before the next one starts.",
                ],
                [
                  "Built from parts.",
                  "Most kanji are made of smaller pieces. Every new kanji shows its parts, what they mean, and a short story that ties them together, so it becomes something you can picture instead of a jumble of strokes.",
                ],
                [
                  "Words, not just characters.",
                  "Each kanji comes with a handful of real words that use it. Readings are much easier to keep when they belong to words you know.",
                ],
                [
                  "Writing by hand.",
                  "You watch the stroke order, then draw the kanji yourself from memory.",
                ],
                [
                  "Reviews before you forget.",
                  "If you sign in, what you get wrong comes back within minutes and what you know moves further out. A five-question daily quiz checks what has stuck.",
                ],
              ].map(([title, body]) => (
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
                <h2 style={{ margin: 0, fontSize: "var(--text-heading-2)" }}>What a new kanji looks like</h2>
                <p style={{ margin: 0 }}>This is how a lesson introduces 休, from lesson {example.lessonOrder}.</p>
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
            <h2 style={{ margin: 0, fontSize: "var(--text-heading-2)" }}>What is here, and what is not</h2>
            <ul className="stack" style={{ gap: 12, margin: 0, paddingLeft: 22 }}>
              <li>
                All {stats.kanji} N5 kanji, in {stats.lessons} lessons, with {stats.words} words that
                use them.
              </li>
              <li>N4 to N1 are not written yet.</li>
              <li>It is free. There are no ads, nothing to buy, and no premium version.</li>
              <li>
                An account is only a username and a password — no email address. That also means
                there is no password reset, so keep yours somewhere safe.
              </li>
            </ul>
          </section>

          {/* ---- A note on accuracy ------------------------------------------ */}
          <section>
            <Card tone="sage" pad="lg" radius="lg">
              <div className="stack" style={{ gap: 16 }}>
                <h2 style={{ margin: 0, fontSize: "var(--text-heading-2)", color: "var(--on-tint-heading)" }}>
                  A note on accuracy
                </h2>
                <p style={{ margin: 0, color: "var(--on-tint-heading)" }}>
                  Kanjikan was built with the help of AI — the app itself, and much of the learning
                  content too: the word lists, readings, meanings and memory stories.
                </p>
                <p style={{ margin: 0, color: "var(--on-tint-heading)" }}>
                  I made it, and I check what I can, but I am still learning Japanese myself. There is
                  only so much I can catch, and some of it is bound to be wrong. Please treat it as a
                  study aid rather than an authority, and check anything important against a
                  dictionary — especially before an exam.
                </p>
                <p style={{ margin: 0, color: "var(--on-tint-heading)" }}>
                  If you find a mistake, or would like to help correct or add lessons, please open an
                  issue on GitHub. Every correction makes it better for the next person who is
                  struggling with the same kanji.
                </p>
                <div className="row" style={{ gap: 12, flexWrap: "wrap", marginTop: 4 }}>
                  <a href={ISSUES_URL} target="_blank" rel="noopener noreferrer" className="reset-link">
                    <Button variant="primary" size="md" icon="arrow-up-right">
                      Open an Issue on GitHub
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
            Stroke order from{" "}
            <a href="https://kanjivg.tagaini.net" target="_blank" rel="noopener noreferrer">
              KanjiVG
            </a>
            , CC BY-SA 3.0 ·{" "}
            <a href={REPO_URL} target="_blank" rel="noopener noreferrer">
              Source on GitHub
            </a>
          </span>
        </div>
      </footer>
    </main>
  );
}
