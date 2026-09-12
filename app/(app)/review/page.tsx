import Link from "next/link";
import { redirect } from "next/navigation";
import { getAllWords } from "@/lib/content";
import { getUser } from "@/lib/auth";
import { getReviewQueue, getWordProgress } from "@/lib/progress";
import { StudySession } from "@/components/app/StudySession";
import { Button } from "@/components/atlas/core/Button.jsx";
import { Card } from "@/components/atlas/layout/Card.jsx";
import { Sparkle } from "@/components/atlas/core/Sparkle.jsx";

export const dynamic = "force-dynamic";

const BATCH = 30;

export default async function ReviewPage() {
  const user = await getUser();
  if (!user) redirect("/login");

  const queue = await getReviewQueue(user.id, "N5", BATCH);

  if (queue.length === 0) {
    return (
      <div style={{ maxWidth: 620, margin: "0 auto" }}>
        <Card tone="cream" pad="lg" radius="lg">
          <div className="stack" style={{ gap: 20 }}>
            <div className="row" style={{ gap: 10 }}>
              <Sparkle size={16} color="var(--on-tint-heading)" />
              <span className="eyebrow" style={{ color: "var(--on-tint-heading)" }}>
                Nothing due
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
              Your review queue is empty.
            </h1>
            <p style={{ margin: 0, color: "var(--on-tint-body)", maxWidth: 440 }}>
              Words come back on a schedule that stretches as you get them right. Start a lesson to
              put new kanji and their vocabulary into the queue.
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

  const progress = await getWordProgress(user.id);
  const wordStages: Record<string, number> = {};
  for (const w of queue) {
    const p = progress.get(w.id);
    if (p) wordStages[w.id] = p.srs_stage;
  }

  return (
    <div style={{ maxWidth: 620, margin: "0 auto" }}>
      <StudySession
        mode="review"
        lessonSlug={null}
        lessonTitle="Review"
        kanji={[]}
        words={queue}
        // Distractors are drawn from the whole level so a review question is
        // not answerable by elimination within one lesson.
        pool={getAllWords()}
        kanjiStages={{}}
        wordStages={wordStages}
        seed={Date.now() % 2147483647}
      />
    </div>
  );
}
