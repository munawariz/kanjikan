import Link from "next/link";
import { getLevelPath, getStories } from "@/lib/content";
import { Badge } from "@/components/atlas/core/Badge.jsx";
import { Icon } from "@/components/atlas/core/Icon.jsx";
import { Card } from "@/components/atlas/layout/Card.jsx";
import { RubyLine } from "@/components/app/StoryReader";
import { getLocale, getT } from "@/lib/i18n/server";

/**
 * Reading: whole stories, level by level, signed in or not.
 *
 * Like practice, nothing here is saved or counts towards mastery. Each card
 * leads with the level's kanji the story uses, since those are what it tests.
 */
export default async function ReadingPage() {
  const [t, locale] = await Promise.all([getT(), getLocale()]);
  const levels = getLevelPath(locale)
    .filter((l) => l.available)
    .map((l) => ({ ...l, stories: getStories(l.level, locale) }))
    .filter((l) => l.stories.length > 0);

  return (
    <div className="stack" style={{ gap: 48 }}>
      <header className="stack" style={{ gap: 16 }}>
        <p className="eyebrow">{t.reading.eyebrow}</p>
        <h1
          style={{
            margin: 0,
            fontSize: "var(--text-display-3)",
            letterSpacing: "var(--tracking-display)",
            lineHeight: "var(--leading-display)",
            maxWidth: 720,
          }}
        >
          {t.reading.heading}
        </h1>
        <p style={{ margin: 0, maxWidth: 600 }}>{t.reading.intro}</p>
      </header>

      {/* A level folds away, animated; see .fold in globals.css. The first
          level starts open: it is where most readers begin. */}
      {levels.map((level, li) => (
        <details key={level.level} className="fold" open={li === 0}>
          <summary className="fold-summary">
            <span className="stack" style={{ gap: 8, flex: 1, minWidth: 0 }}>
              <span className="eyebrow">{level.title}</span>
              <h2 style={{ margin: 0, fontSize: "var(--text-heading-1)" }}>
                {t.reading.levelHeading(level.level)}
              </h2>
              <span className="body-sm muted" style={{ maxWidth: 620 }}>
                {t.reading.levelIntro(level.level)} {t.reading.storyCount(level.stories.length)}
              </span>
            </span>
            <span className="fold-chevron" aria-hidden="true">
              <Icon name="chevron-down" size={22} />
            </span>
          </summary>

          <div className="fold-body">
            <div className="grid grid-3 grid-roomy" style={{ paddingTop: 24 }}>
              {level.stories.map((story, i) => (
                <Link key={story.slug} href={`/reading/${story.slug}`} className="card-link">
                  <Card tone={i % 2 === 0 ? "cream" : "sage"} pad="md" radius="lg" hover style={{ height: "100%" }}>
                    <div className="stack" style={{ gap: 16, height: "100%" }}>
                      <div className="row" style={{ justifyContent: "space-between", gap: 12 }}>
                        <span
                          style={{
                            fontFamily: "var(--font-mono)",
                            fontSize: "var(--text-body-sm)",
                            color: "var(--on-tint-body)",
                          }}
                        >
                          {String(story.order).padStart(2, "0")}
                        </span>
                        <Badge tone="soft">{t.reading.levelKanji(story.kanji.length, story.level)}</Badge>
                      </div>

                      <div className="stack" style={{ gap: 4, flex: 1 }}>
                        <p
                          className="story-text jp"
                          lang="ja"
                          style={{ margin: 0, fontSize: 24, fontWeight: 700, color: "var(--on-tint-heading)" }}
                        >
                          <RubyLine text={story.heading} path="title" />
                        </p>
                        <h3 style={{ margin: 0, fontSize: "var(--text-heading-4)" }}>{story.title}</h3>
                        <p className="body-sm" style={{ margin: "6px 0 0", color: "var(--on-tint-body)" }}>
                          {story.summary}
                        </p>
                      </div>

                      <div
                        className="jp"
                        lang="ja"
                        aria-label={t.reading.kanjiHeading(story.level)}
                        style={{
                          fontSize: 18,
                          lineHeight: 1.5,
                          letterSpacing: "0.12em",
                          color: "var(--on-tint-heading)",
                          overflowWrap: "anywhere",
                        }}
                      >
                        {story.kanji.join("")}
                      </div>

                      <p className="body-sm" style={{ margin: 0, color: "var(--on-tint-body)" }}>
                        {t.reading.length(story.length)}
                      </p>
                    </div>
                  </Card>
                </Link>
              ))}
            </div>
          </div>
        </details>
      ))}
    </div>
  );
}
