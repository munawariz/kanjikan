import Link from "next/link";
import { notFound } from "next/navigation";
import { getStory } from "@/lib/content";
import { Badge } from "@/components/atlas/core/Badge.jsx";
import { RubyLine, StoryReader } from "@/components/app/StoryReader";
import { getLocale, getT } from "@/lib/i18n/server";

export default async function StoryPage({ params }: { params: { slug: string } }) {
  const locale = await getLocale();
  const story = getStory(params.slug, locale);
  if (!story) notFound();

  const t = (await getT()).reading;

  return (
    <div className="stack" style={{ gap: 40, maxWidth: 860 }}>
      <div>
        <Link href="/reading" className="body-sm" style={{ textDecoration: "none" }}>
          {t.allStories}
        </Link>
      </div>

      <header className="stack" style={{ gap: 16 }}>
        <div className="row" style={{ gap: 12, flexWrap: "wrap" }}>
          <Badge tone="sage" uppercase>
            {t.storyBadge(story.level, String(story.order).padStart(2, "0"))}
          </Badge>
          <Badge tone="cream">{t.length(story.length)}</Badge>
        </div>
        <h1
          className="story-text jp-display"
          lang="ja"
          style={{ margin: 0, fontSize: "var(--text-display-3)", lineHeight: 1.6 }}
        >
          <RubyLine text={story.heading} path="title" />
        </h1>
        <p style={{ margin: 0, fontSize: "var(--text-heading-3)", fontWeight: "var(--weight-semibold)", color: "var(--text-heading)" }}>
          {story.title}
        </p>
        <p style={{ margin: 0, maxWidth: 620 }}>{story.summary}</p>
      </header>

      <StoryReader story={story} />
    </div>
  );
}
