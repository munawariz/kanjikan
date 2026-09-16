import Link from "next/link";
import { redirect } from "next/navigation";
import { getAllWords } from "@/lib/content";
import { getUser } from "@/lib/auth";
import { getProfile, getReviewQueue, getWordProgress, getWritingReviewQueue, studiesWriting } from "@/lib/progress";
import { StudySession } from "@/components/app/StudySession";
import { Button } from "@/components/atlas/core/Button.jsx";
import { Card } from "@/components/atlas/layout/Card.jsx";
import { Sparkle } from "@/components/atlas/core/Sparkle.jsx";
import { getLocale, getT } from "@/lib/i18n/server";

export const dynamic = "force-dynamic";

const BATCH = 30;
/** Writing takes far longer per card than a multiple-choice question. */
const WRITING_BATCH = 10;

export default async function ReviewPage() {
  const user = await getUser();
  if (!user) redirect("/login");
  const [t, locale] = await Promise.all([getT().then((m) => m.study.review), getLocale()]);

  const profile = await getProfile(user.id);
  const writing = studiesWriting(profile);
  const [queue, writingQueue] = await Promise.all([
    getReviewQueue(user.id, BATCH, locale),
    writing ? getWritingReviewQueue(user.id, WRITING_BATCH, locale) : [],
  ]);

  if (queue.length === 0 && writingQueue.length === 0) {
    return (
      <div style={{ maxWidth: 620, margin: "0 auto" }}>
        <Card tone="cream" pad="lg" radius="lg">
          <div className="stack" style={{ gap: 20 }}>
            <div className="row" style={{ gap: 10 }}>
              <Sparkle size={16} color="var(--on-tint-heading)" />
              <span className="eyebrow" style={{ color: "var(--on-tint-heading)" }}>
                {t.nothingDue}
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
              {t.empty}
            </h1>
            <p style={{ margin: 0, color: "var(--on-tint-body)", maxWidth: 440 }}>
              {writing ? t.emptyWriting : t.emptyReading}
            </p>
            <div className="row" style={{ gap: 12, flexWrap: "wrap" }}>
              <Link href="/lessons" className="reset-link">
                <Button variant="primary" size="lg" icon="chevron-right">
                  {t.browseLessons}
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
  const levels = new Set(queue.map((w) => w.level));

  return (
    <div style={{ maxWidth: 620, margin: "0 auto" }}>
      <StudySession
        mode="review"
        lessonSlug={null}
        lessonTitle={t.title}
        kanji={writingQueue}
        words={queue}
        // Distractors are drawn from the whole of each level being reviewed,
        // so a question is not answerable by elimination within one lesson,
        // and a learner still in N5 is not offered N4 words as options.
        pool={getAllWords(undefined, locale).filter((w) => levels.has(w.level))}
        wordStages={wordStages}
        seed={Date.now() % 2147483647}
      />
    </div>
  );
}
