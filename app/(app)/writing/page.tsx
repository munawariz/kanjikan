import Link from "next/link";
import { getWritingQueue } from "@/lib/progress";
import { StudySession } from "@/components/app/StudySession";
import { Button } from "@/components/atlas/core/Button.jsx";
import { Card } from "@/components/atlas/layout/Card.jsx";
import { Sparkle } from "@/components/atlas/core/Sparkle.jsx";

export const metadata = { title: "Writing practice — Kanjikan" };
export const dynamic = "force-dynamic";

export default async function WritingPage() {
  const queue = await getWritingQueue("N5", 12);

  if (queue.length === 0) {
    return (
      <div style={{ maxWidth: 620, margin: "0 auto" }}>
        <Card tone="cream" pad="lg" radius="lg">
          <div className="stack" style={{ gap: 20 }}>
            <div className="row" style={{ gap: 10 }}>
              <Sparkle size={16} color="var(--on-tint-heading)" />
              <span className="eyebrow" style={{ color: "var(--on-tint-heading)" }}>
                Nothing to write
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
              No characters are due for writing.
            </h1>
            <p style={{ margin: 0, color: "var(--on-tint-body)", maxWidth: 440 }}>
              Every lesson ends by writing each character from memory. Once a character has been
              written once, it comes back here on its own schedule.
            </p>
            <div className="row" style={{ gap: 12, flexWrap: "wrap" }}>
              <Link href="/lessons" className="reset-link">
                <Button variant="primary" size="lg" icon="chevron-right">
                  Browse Lessons
                </Button>
              </Link>
            </div>
          </div>
        </Card>
      </div>
    );
  }

  return (
    <div style={{ maxWidth: 620, margin: "0 auto" }}>
      <StudySession
        mode="writing"
        lessonSlug={null}
        lessonTitle="Writing practice"
        kanji={queue}
        words={[]}
        kanjiStages={{}}
        wordStages={{}}
        seed={Date.now() % 2147483647}
      />
    </div>
  );
}
